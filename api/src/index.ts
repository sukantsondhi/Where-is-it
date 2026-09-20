
import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { CosmosClient, type Container } from "@azure/cosmos";
import { photoDocument, photoId, type PhotoDoc } from "./photos";
import { applyCommand, flatten, type Command } from "../../src/domain";
import { auditRoomScope, canAccessRoom, canReadAudit, visibleHome } from "../../src/privacy";
import type { AppState, AuditEvent, Home, Person } from "../../src/types";
import { canAccept, emailId, newInvitation, publicPerson, requireEmailConfiguration, sendInvitation, type UserDoc } from "./invitations";
import { limitRequest } from "./limits";
type HomeDoc={id:string;homeId:string;kind:"home";ownerId:string;home:Home;_etag?:string};
let users:Container, inventory:Container;
function db(){
 if(!process.env.COSMOS_ENDPOINT||!process.env.COSMOS_KEY)throw new Error("Storage is not configured.");
 if(!users){const database=new CosmosClient({endpoint:process.env.COSMOS_ENDPOINT,key:process.env.COSMOS_KEY}).database(process.env.COSMOS_DATABASE||"where-is-it");users=database.container("users");inventory=database.container("inventory");}
 return {users,inventory};
}
function fail(status:number,message:string):never {throw Object.assign(new Error(message),{status});}
async function recordAdminIntent(actor:Person,targetId:string,action:string){
 await db().inventory.items.create({id:crypto.randomUUID(),homeId:"platform-admin",kind:"admin-audit",phase:"intent",actorId:actor.id,actorName:actor.name,targetId,action,timestamp:new Date().toISOString()});
}
async function readUser(id:string):Promise<Person|undefined>{try{const {resource}=await db().users.item(id,id).read<Person>();return resource ? publicPerson(resource) : undefined;}catch(e){if((e as {code:number}).code===404)return undefined;throw e;}}
async function identity(req:HttpRequest):Promise<Person>{
 // Trust ONLY the Azure Static Web Apps managed API ingress. Never deploy this handler
 // as a publicly reachable standalone Function: its header could be forged there.
 if(process.env.AUTH_BOUNDARY!=="swa-managed")fail(503,"Authentication boundary is not configured.");
 const raw=req.headers.get("x-ms-client-principal");if(!raw)fail(401,"Sign in with Microsoft.");
 let p:{identityProvider:string;userId:string;userRoles:string[];userDetails:string};
 try{p=JSON.parse(Buffer.from(raw!,"base64").toString("utf8"));}catch{fail(401,"Invalid identity.");}
 if(p!.identityProvider!=="aad"||!p!.userRoles?.includes("authenticated")||!p!.userId)fail(401,"Sign in with Microsoft.");
 await limitRequest(db().inventory,p!.userId,req.method==="GET"?"read":"write",req.method==="GET"?60:20,60_000);
 let user=await readUser(p!.userId);
 if(!user){
  const {resources}=await db().users.items.query<UserDoc>({query:"SELECT * FROM c WHERE c.swaId = @id",parameters:[{name:"@id",value:p!.userId}]}).fetchAll();
  if(resources.length===1)user=publicPerson(resources[0]);
 }
 if(req.params.route==="invitations/accept"&&req.method==="POST"){
  const body=await json(req);
  if(user)fail(409,"This Microsoft account already has platform access. Sign in with the invited account.");
  if(typeof body.email!=="string"||typeof p!.userDetails!=="string")fail(400,"Invalid invitation.");
  const id=emailId(body.email);
  const {resource:invited}=await db().users.item(id,id).read<UserDoc>();
  if(!invited||!canAccept(invited,body.token,p!.userDetails))fail(403,"Invitation is invalid, expired, or for a different email. Sign in with the invited Microsoft account or ask your administrator to resend it.");
  const accepted={...publicPerson(invited!),status:"active" as const,swaId:p!.userId};
  await recordAdminIntent(publicPerson(accepted),id,"invitation.accept");
  try{await db().users.item(id,id).replace(accepted,{accessCondition:{type:"IfMatch",condition:invited!._etag!}});}
  catch(e){if((e as {code:number}).code===412)fail(409,"Invitation changed or was already accepted. Please sign in again.");throw e;}
  user=publicPerson(accepted);
 }
 if(!user && p!.userId===process.env.BOOTSTRAP_USER_ID){
  user={id:p!.userId,name:process.env.BOOTSTRAP_NAME||"Owner",email:process.env.BOOTSTRAP_EMAIL||"",avatar:"SA",platformRole:"super-admin",status:"active"};
  await recordAdminIntent(user,user.id,"bootstrap.create");
  try{await db().users.items.create(user);}catch(e){if((e as {code:number}).code!==409)throw e;user=await readUser(p!.userId);}
 }
 if(!user||user.status!=="active")fail(403,"Your account needs platform administrator approval.");
 return user!;
}
async function homeDoc(id:string,user:Person):Promise<HomeDoc>{
 if(!id || id.length>100)fail(404,"Not found.");
 const {resource}=await db().inventory.item(id,id).read<HomeDoc>();
 if(!resource||resource.kind!=="home"||!resource.home.memberIds.includes(user.id))fail(404,"Not found.");
 resource!.home.role=resource!.ownerId===user.id?"owner":"member";
 return resource!;
}
async function snapshot(user:Person):Promise<AppState>{
 const {resources:docs}=await db().inventory.items.query<HomeDoc>({query:"SELECT * FROM c WHERE c.kind = 'home' AND ARRAY_CONTAINS(c.home.memberIds, @id)",parameters:[{name:"@id",value:user.id}]}).fetchAll();
 const homes=docs.map(d=>visibleHome({...d.home,role:d.ownerId===user.id?"owner" as const:"member" as const},user.id));
 const ids=[...new Set(homes.flatMap(h=>h.memberIds).concat(user.id))];
 const people=(await Promise.all(ids.map(readUser))).filter((u):u is Person=>!!u).map(u=>({...u,platformRole:u.id===user.id?u.platformRole:"user" as const}));
 const events:AuditEvent[]=[];
 for(const d of docs.filter(d=>d.ownerId===user.id)){
  const {resources}=await db().inventory.items.query<AuditEvent>({query:"SELECT TOP 500 * FROM c WHERE c.kind = 'audit' ORDER BY c.timestamp DESC"},{partitionKey:d.id}).fetchAll();
  events.push(...resources.filter(event=>canReadAudit(event,d.home,user.id)));
 }
 return {currentUser:user,homes,people,events:events.sort((a,b)=>b.timestamp.localeCompare(a.timestamp))};
}
function writeGuard(req:HttpRequest){
 if(req.headers.get("origin")!==process.env.APP_ORIGIN)fail(403,"Origin rejected.");
 if(!req.headers.get("content-type")?.startsWith("application/json"))fail(415,"JSON required.");
}
async function json(req:HttpRequest){const raw=await req.text();if(raw.length>1_000_000)fail(413,"Request too large.");try{return JSON.parse(raw);}catch{fail(400,"Invalid JSON.");}}
export async function handle(req:HttpRequest):Promise<HttpResponseInit>{
 const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
 try{
  if(req.method!=="GET")writeGuard(req);
  const user=await identity(req);const route=req.params.route||"";
  if(route==="invitations/accept"&&req.method==="POST")return {jsonBody:{ok:true},headers};
  if(route==="state"&&req.method==="GET")return {jsonBody:await snapshot(user),headers};
  if(route==="commands"&&req.method==="POST"){
   const cmd=await json(req) as Command;
   if(typeof cmd?.type!=="string"||!cmd.data && !cmd.type.endsWith("delete")){if(!cmd?.type)fail(400,"Invalid command.");}
   if(cmd.data && Object.values(cmd.data).some(v=>typeof v!=="string"))fail(400,"Invalid command fields.");
   if(cmd.type==="home.create"){
    const next=applyCommand({currentUser:user,people:[user],homes:[],events:[]},cmd),h=next.homes[0];
    const doc:HomeDoc={id:h.id,homeId:h.id,kind:"home",ownerId:user.id,home:h};
    const result=await db().inventory.items.batch([{operationType:"Create",resourceBody:JSON.parse(JSON.stringify(doc))},{operationType:"Create",resourceBody:{...next.events[0],kind:"audit",homeId:h.id}}],h.id);
    if(![200,201].includes(result.code ?? 500))fail(409,"Unable to create home. Retry the operation.");
   }else{
    const doc=await homeDoc(cmd.homeId||"",user);
    if(cmd.type==="member.add"){
     if(doc.ownerId!==user.id)fail(403,"Only the home owner can manage members.");
     const email=(cmd.data?.email||"").trim().toLowerCase();if(!email)fail(400,"Email is required.");
     const {resources}=await db().users.items.query<Person>({query:"SELECT * FROM c WHERE c.email = @email AND c.status = 'active'",parameters:[{name:"@email",value:email}]}).fetchAll();
     if(resources.length!==1)fail(400,"No active approved user matches that address.");
     cmd.data={userId:resources[0].id};
    }
    if(cmd.type.startsWith("member.")&&doc.ownerId!==user.id)fail(403,"Only the home owner can manage members.");
    if(cmd.type==="member.remove"&&cmd.data?.userId===doc.ownerId)fail(400,"The owner cannot be removed.");
    const next=applyCommand({currentUser:user,people:[user],homes:[doc.home],events:[]},cmd);
    const { _etag, ...saved }=doc;saved.home=next.homes[0];
    if(JSON.stringify(saved).length>1_400_000)fail(413,"This home reached its v1 inventory limit. Export it and split inventory across homes.");
    const removedPhoto=cmd.type==="item.delete"?flatten([doc.home]).find(r=>r.item.id===cmd.itemId)?.item.photoId:undefined;
    const result=await db().inventory.items.batch([{operationType:"Replace",id:doc.id,resourceBody:JSON.parse(JSON.stringify(saved)),ifMatch:_etag},{operationType:"Create",resourceBody:{...next.events[0],kind:"audit",homeId:doc.id}},...(removedPhoto?[{operationType:"Delete" as const,id:removedPhoto}]:[])],doc.id);
    if(![200,201].includes(result.code ?? 500))fail(409,"The home changed. Refresh and try again.");
   }
   return {jsonBody:await snapshot(user),headers};
  }
  if(route==="photos"&&["GET","POST"].includes(req.method)){
   const body=req.method==="POST"?await json(req):{homeId:req.query.get("homeId"),itemId:req.query.get("itemId")};
   const doc=await homeDoc(body.homeId,user);
   const row=flatten([doc.home]).find(r=>r.item.id===body.itemId);if(!row)fail(404,"Not found.");
   if(!canAccessRoom(row!.room,user.id))fail(404,"Not found.");
   if(req.method==="GET"){
    if(!row!.item.photoId)fail(404,"No photo.");
    const {resource:photo}=await db().inventory.item(row!.item.photoId!,doc.id).read<PhotoDoc>();
    if(!photo||photo.kind!=="photo"||photo.itemId!==row!.item.id)fail(404,"No photo.");
    return {headers,jsonBody:{data:photo!.data}};
   }
   let photo:PhotoDoc;
   try{photo=photoDocument(doc.id,row!.item.id,body.data);}catch(error){fail(400,(error as Error).message);}
   const stamp=new Date().toISOString();Object.assign(row!.item,{photoId:photoId(row!.item.id),updatedAt:stamp});row!.room.updatedAt=stamp;row!.location.updatedAt=stamp;doc.home.updatedAt=stamp;
   const {_etag,...saved}=doc;
   if(Buffer.byteLength(JSON.stringify(saved))+Buffer.byteLength(JSON.stringify(photo!))>1_800_000)fail(413,"This home and photo exceed the upload limit. Choose a smaller photo or split inventory across homes.");
   const result=await db().inventory.items.batch([{operationType:"Replace",id:doc.id,resourceBody:JSON.parse(JSON.stringify(saved)),ifMatch:_etag},{operationType:"Upsert",resourceBody:photo!},{operationType:"Create",resourceBody:{id:crypto.randomUUID(),homeId:doc.id,kind:"audit",actorId:user.id,actorName:user.name,action:"item.photo",detail:"Updated photo: "+row!.item.name,timestamp:stamp,entityType:"item",...auditRoomScope([row!.room])}}],doc.id);
   if(![200,201].includes(result.code ?? 500))fail(409,"The home changed. Refresh and retry the photo.");
   return {jsonBody:{ok:true},headers};
  }
  if(route==="admin/users"){
   if(user.platformRole==="user")fail(403,"Administrator access required.");
   if(req.method==="GET"){const {resources}=await db().users.items.readAll<Person>().fetchAll();return {jsonBody:resources.map(publicPerson),headers};}
   const body=await json(req);
   if(req.method==="POST"){
    if(typeof body.name!=="string"||!body.name.trim()||body.name.length>100||typeof body.email!=="string"||!/^\S+@\S+\.\S+$/.test(body.email.trim())||body.email.length>254)fail(400,"Valid name and email required.");
    if(!["user","co-admin"].includes(body.role)||body.role==="co-admin"&&user.platformRole!=="super-admin")fail(403,"Role not permitted.");
    const email=body.email.trim().toLowerCase(),id=emailId(email);
    const {resources:existing}=await db().users.items.query<UserDoc>({query:"SELECT * FROM c WHERE LOWER(c.email) = @email",parameters:[{name:"@email",value:email}]}).fetchAll();
    if(existing.some(p=>(p.status!=="invited"&&!(p.status==="disabled"&&!p.swaId))||p.id!==id))fail(409,"This email already has an account. Manage it in Administration.");
    const previous=existing[0];
    if(previous?.platformRole==="co-admin"&&user.platformRole!=="super-admin")fail(403,"This account is protected.");
    requireEmailConfiguration();
    await limitRequest(db().inventory,user.id,"invite",5,3_600_000);
    const {token,...invitation}=newInvitation();
    const invited:UserDoc={id,name:body.name.trim(),email,avatar:body.name.trim().slice(0,2).toUpperCase(),platformRole:body.role,status:"invited",...invitation};
    await recordAdminIntent(user,id,previous?"invitation.resend":"invitation.create");
    if(previous)await db().users.item(id,id).replace(invited,{accessCondition:{type:"IfMatch",condition:previous._etag!}});
    else await db().users.items.create(invited);
    await sendInvitation(email,token);
    return {jsonBody:{ok:true},headers};
   }
   if(req.method==="PATCH"){
    const {resource:target}=await db().users.item(body.id,body.id).read<UserDoc>();if(!target)fail(404,"Not found.");
    if(target!.platformRole==="super-admin"||target!.platformRole==="co-admin"&&user.platformRole!=="super-admin"||target!.id===user.id)fail(403,"This account is protected.");
    if(!["active","disabled"].includes(body.status))fail(400,"Invalid status.");
    if(body.status==="active"&&!target!.swaId&&target!.id.startsWith("email-"))fail(400,"Send a new invitation to activate this account.");
    await recordAdminIntent(user,target!.id,body.status==="active"?"account.enable":"account.disable");
    await db().users.item(target!.id,target!.id).replace({...target,status:body.status},{accessCondition:{type:"IfMatch",condition:target!._etag!}});return {jsonBody:{ok:true},headers};
   }
  }
  if(route==="admin/audit"&&req.method==="GET"){
   if(user.platformRole!=="super-admin")fail(403,"Super administrator access required.");
   const {resources}=await db().inventory.items.query({query:"SELECT TOP 500 * FROM c WHERE c.kind = 'admin-audit' ORDER BY c.timestamp DESC"},{partitionKey:"platform-admin"}).fetchAll();
   return {jsonBody:resources,headers};
  }
  fail(404,"Not found.");
 }catch(error){
  const e=error as {status?:number;code?:number;message?:string;retryAfter?:number};
  const status=e.status || (e.code===404?404:503);
  return {status,headers:{...headers,...(e.retryAfter?{"Retry-After":String(e.retryAfter)}:{})},jsonBody:{message:status>=500?"Service unavailable. Check Azure configuration.":e.status?e.message:e.code===404?"Not found.":"Request could not be completed."}};
 }
}
app.http("api",{route:"{*route}",methods:["GET","POST","PATCH"],authLevel:"anonymous",handler:handle});
