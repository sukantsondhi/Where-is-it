
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Archive, ArrowDownToLine, ArrowLeft, ArrowRight, BedDouble, Box, Check, ChevronRight, Home as HomeIcon, LayoutGrid, LogOut, Menu, Moon, MoreHorizontal, Package, Plus, QrCode, Search, ShieldCheck, Sun, Trash2, Users, X, Monitor, Utensils, Warehouse, Clock3, MapPin, Camera } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { AppState, Home, Room, StorageLocation } from "./types";
import { loadState, saveState } from "./storage";
import { applyCommand, flatten, type Command, type ItemRow } from "./domain";
import { api, isAzureMode } from "./api";
import { compressPhoto } from "./photos";

type View="homes"|"inventory"|"admin"|"profile";
type Modal={kind:string; row?:ItemRow; location?:StorageLocation; room?:Room};
type AdminEvent={id:string;actorId:string;actorName:string;targetId:string;action:string;timestamp:string};
const date=(s:string)=>new Date(s).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});
const count=(h:Home)=>flatten([h]).length;
const roomIcon=(name:string)=>name==="monitor"?Monitor:name==="utensils"?Utensils:name==="warehouse"?Warehouse:name==="archive"?Archive:BedDouble;
function Dialog({title,children,close}:{title:string;children:ReactNode;close:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal(); const el=ref.current;return()=>el?.close();},[]);
 return <dialog ref={ref} onCancel={close} onClick={e=>{if(e.target===e.currentTarget)close();}} aria-labelledby="dialog-title"><div className="dialog-head"><h2 id="dialog-title">{title}</h2><button className="icon-btn" aria-label="Close dialog" onClick={close}><X size={20}/></button></div>{children}</dialog>;
}
export default function App(){
 const [invitation,setInvitation]=useState(()=>{
  const fragment=new URLSearchParams(window.location.hash.slice(1));
  if(fragment.has("invite")){
   const value={token:fragment.get("invite"),email:fragment.get("email")};
   sessionStorage.setItem("where-invitation",JSON.stringify(value));
   window.history.replaceState(null,"",window.location.pathname+window.location.search);
   return value;
  }
  try{return JSON.parse(sessionStorage.getItem("where-invitation")||"null") as {token:string;email:string}|null;}catch{return null;}
 });
 const [inviteError,setInviteError]=useState("");
 const [state,setState]=useState<AppState>(()=>loadState());
 const [ready,setReady]=useState(!isAzureMode),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [view,setView]=useState<View>("homes"),[homeId,setHomeId]=useState(""),[roomId,setRoomId]=useState(""),[locationId,setLocationId]=useState("");
 const [query,setQuery]=useState(""),[category,setCategory]=useState("All"),[modal,setModal]=useState<Modal|null>(null),[notice,setNotice]=useState(""),[tab,setTab]=useState("rooms");
 const [dark,setDark]=useState(()=>localStorage.getItem("where-theme")==="dark"),[nav,setNav]=useState(false);
 const [adminUsers,setAdminUsers]=useState<AppState["people"]>([]),[photos,setPhotos]=useState<Record<string,string>>({});
 const home=state.homes.find(h=>h.id===homeId),room=home?.rooms.find(r=>r.id===roomId),location=room?.locations.find(l=>l.id===locationId);
 const all=flatten(state.homes), visible=all.filter(r=>(!homeId||r.home.id===homeId)&&(!roomId||r.room.id===roomId)&&(!locationId||r.location.id===locationId));
 const filtered=(view==="inventory"?all:visible).filter(r=>(category==="All"||r.item.category===category)&&[r.item.name,r.item.note,r.item.category,r.home.name,r.room.name,r.location.name].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
 const admin=state.currentUser.platformRole!=="user";
 useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light";localStorage.setItem("where-theme",dark?"dark":"light");},[dark]);
 useEffect(()=>{if(notice){const t=setTimeout(()=>setNotice(""),4000);return()=>clearTimeout(t);}},[notice]);
 useEffect(()=>{if(isAzureMode&&!invitation)api<AppState>("/state").then(s=>{setState(s);setReady(true);}).catch(e=>setError(e.message));},[invitation]);
 useEffect(()=>{
   const id=new URLSearchParams(window.location.search).get("location");
   if(id&&ready){const row=state.homes.flatMap(h=>h.rooms.flatMap(r=>r.locations.map(l=>({h,r,l})))).find(x=>x.l.id===id);
    if(row){setHomeId(row.h.id);setRoomId(row.r.id);setLocationId(id);}else setNotice("This location is unavailable or you do not have access.");}
 },[ready]);
 useEffect(()=>{if(view==="admin"&&admin){if(isAzureMode)api<AppState["people"]>("/admin/users").then(setAdminUsers).catch(e=>setNotice(e.message));else setAdminUsers(state.people);}},[view,state.people,admin]);
 async function run(cmd:Command){
   setBusy(true);
   try{
    const next=isAzureMode?await api<AppState>("/commands",{method:"POST",body:JSON.stringify(cmd)}):applyCommand(state,cmd);
    if(!isAzureMode)saveState(next);setState(next);setModal(null);setNotice("Saved. Everything is in its place.");return true;
   }catch(e){setNotice((e as Error).message);return false;}finally{setBusy(false);}
 }
 function goto(v:View){setView(v);setHomeId("");setRoomId("");setLocationId("");setQuery("");setCategory("All");setNav(false);}
 function openHome(h:Home){setHomeId(h.id);setRoomId("");setLocationId("");setTab("rooms");setQuery("");setCategory("All");}
 function openRoom(r:Room){setRoomId(r.id);setLocationId("");setQuery("");setCategory("All");}
 function exportData(){
  const data=home?[home]:state.homes;
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="where-is-it-inventory.json";a.click();URL.revokeObjectURL(url);
 }
 async function exportAdminAudit(){
  try{
   const events=await api<AdminEvent[]>("/admin/audit");
   const url=URL.createObjectURL(new Blob([JSON.stringify(events,null,2)],{type:"application/json"}));
   const a=document.createElement("a");a.href=url;a.download="where-is-it-platform-audit.json";a.click();URL.revokeObjectURL(url);
  }catch(e){setNotice((e as Error).message);}
 }
 async function photo(row:ItemRow,file:File){
  try{
    const data=await compressPhoto(file);
    if(isAzureMode) await api("/photos",{method:"POST",body:JSON.stringify({homeId:row.home.id,itemId:row.item.id,data})});
    else {
      localStorage.setItem("where-photo:"+row.item.id,data);
      const next=applyCommand(state,{type:"item.update",homeId:row.home.id,roomId:row.room.id,locationId:row.location.id,itemId:row.item.id,data:{name:row.item.name,note:row.item.note,quantity:String(row.item.quantity),category:row.item.category}});
      next.events[0].action="item.photo";next.events[0].detail="Updated photo: "+row.item.name;
      saveState(next);setState(next);
    }
    if(isAzureMode)setState(await api<AppState>("/state"));
    setPhotos(p=>({...p,[row.item.id]:data}));setNotice("Photo saved.");
  }catch(e){setNotice((e as Error).message);}
 }
 const imageFor=(row:ItemRow)=>photos[row.item.id]||(!isAzureMode?localStorage.getItem("where-photo:"+row.item.id):undefined);
 async function openItem(row:ItemRow){
  setModal({kind:"detail",row});
  if(isAzureMode)api<{data:string}>("/photos?homeId="+encodeURIComponent(row.home.id)+"&itemId="+encodeURIComponent(row.item.id)).then(p=>setPhotos(v=>({...v,[row.item.id]:p.data}))).catch(()=>{});
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!modal)return;
  const d=Object.fromEntries(new FormData(e.currentTarget)) as Record<string,string>;
  if(modal.kind==="member"){
   if(isAzureMode){await run({type:"member.add",homeId,data:{email:d.email}});}
   else {const p=state.people.find(p=>p.email.toLowerCase()===d.email.toLowerCase()&&p.status==="active");if(!p){setNotice("No active approved user matches that address.");return;}await run({type:"member.add",homeId,data:{userId:p.id}});}return;
  }
  if(modal.kind==="user"){
   setBusy(true);try{
    if(isAzureMode){await api("/admin/users",{method:"POST",body:JSON.stringify(d)});setAdminUsers(await api("/admin/users"));}
    else {const next={...state,people:[...state.people,{id:crypto.randomUUID(),name:d.name,email:d.email,avatar:d.name.slice(0,2).toUpperCase(),platformRole:d.role as "user"|"co-admin",status:"invited" as const}]};saveState(next);setState(next);}
    setModal(null);setNotice(isAzureMode?"Invitation email sent. The link expires in 7 days.":"Demo invitation saved. No email was sent.");
   }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}return;
  }
  await run({type:modal.kind,homeId:modal.row?.home.id||homeId,roomId:modal.row?.room.id||modal.room?.id||roomId,locationId:modal.row?.location.id||modal.location?.id||locationId,itemId:modal.row?.item.id,data:d});
 }
 if(invitation&&isAzureMode)return <main className="auth-page"><img src="/mark.svg" width="64" alt=""/><h1>You are invited.</h1><p>Sign in with the Microsoft account for {invitation.email}, then accept your invitation.</p><a className="primary" href="/.auth/login/aad?post_login_redirect_uri=/">Sign in with Microsoft</a><button className="secondary" disabled={busy} onClick={async()=>{setBusy(true);setInviteError("");try{await api("/invitations/accept",{method:"POST",body:JSON.stringify(invitation)});sessionStorage.removeItem("where-invitation");setInvitation(null);}catch(e){setInviteError((e as Error).message);}finally{setBusy(false);}}}>{busy?"Accepting...":"Accept invitation"}</button>{inviteError&&<p role="alert">{inviteError}</p>}<a href="/.auth/logout?post_logout_redirect_uri=/">Use a different Microsoft account</a><button className="text-btn" onClick={()=>{sessionStorage.removeItem("where-invitation");setInvitation(null);}}>Continue to platform sign-in</button></main>;
 if(!ready)return <main className="auth-page"><img src="/mark.svg" width="64" alt=""/><h1>Everything, in its place.</h1><p>{error||"Opening your homes…"}</p>{error&&<><a className="primary" href={"/.auth/login/aad?post_login_redirect_uri="+encodeURIComponent(window.location.pathname+window.location.search)}>Sign in with Microsoft <ArrowRight size={18}/></a><p className="muted">Invite-only. Ask your platform administrator for access.</p></>}</main>;
 const rowCards=(rows:ItemRow[])=><div className="item-grid">{rows.map(row=><button className="item-card" key={row.item.id} onClick={()=>openItem(row)}><div className="item-art" style={{"--item-colour":row.item.colour} as React.CSSProperties}>{imageFor(row)?<img src={imageFor(row)!} alt={row.item.name} loading="lazy"/>:<Package size={54} strokeWidth={1.25}/>}<span className="quantity">× {row.item.quantity}</span></div><div className="item-body"><span className="eyebrow">{row.item.category}</span><h3>{row.item.name}</h3><p>{row.room.name} <ChevronRight size={12}/> {row.location.name}</p></div></button>)}</div>;
 return <div className="app-shell">
 <a className="skip" href="#main">Skip to content</a>
 <aside className={"sidebar "+(nav?"is-open":"")}>
  <a className="brand" href="/" onClick={e=>{e.preventDefault();goto("homes");}}><img src="/mark.svg" alt="" width="39"/><span>Where is it<span className="brand-dot">.</span></span></a>
  <div className="workspace"><span className="workspace-icon"><HomeIcon size={20}/></span><div><strong>Personal workspace</strong><small>Less searching. More living.</small></div></div>
  <span className="nav-label">YOUR SPACE</span>
  <nav aria-label="Main navigation">{([{id:"homes",label:"My homes",icon:HomeIcon},{id:"inventory",label:"All items",icon:Package},{id:"profile",label:"Preferences",icon:Users}] as const).map(n=><button key={n.id} onClick={()=>goto(n.id)} className={view===n.id?"active":""}><n.icon size={20}/>{n.label}{n.id==="inventory"&&<span className="nav-count">{all.length}</span>}</button>)}</nav>
  {admin&&<><span className="nav-label">PLATFORM</span><nav><button className={view==="admin"?"active":""} onClick={()=>goto("admin")}><ShieldCheck size={20}/>Administration</button></nav></>}
  <div className="sidebar-bottom"><div className="privacy"><ShieldCheck size={23}/><strong>Your home. Your circle.</strong><p>Only people you add can see what’s inside.</p></div><button className="account" onClick={()=>goto("profile")}><span className="avatar">{state.currentUser.avatar}</span><span><strong>{state.currentUser.name}</strong><small>{admin?"Platform admin":"Member"}</small></span><MoreHorizontal size={18}/></button></div>
 </aside>
 {nav&&<button className="nav-scrim" aria-label="Close navigation" onClick={()=>setNav(false)}/>}
 <div className="main-shell">
  <header className="topbar"><button className="icon-btn mobile-only" aria-label="Open navigation" onClick={()=>setNav(true)}><Menu/></button><div className="breadcrumb"><button onClick={()=>goto("homes")}>Workspace</button><ChevronRight size={14}/><span>{view==="homes"?(home?.name||"My homes"):view==="inventory"?"All items":view==="admin"?"Administration":"Preferences"}</span></div><div className="top-actions"><span className="mode-badge"><span/>{isAzureMode?"Private workspace":"Local demo"}</span><button className="icon-btn" aria-label={dark?"Use light theme":"Use dark theme"} onClick={()=>setDark(!dark)}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button></div></header>
  <main id="main">
  {!isAzureMode&&<div className="demo-strip">Explore the demo <span>Fictional inventory · changes stay in this browser · not a secure account</span><a href="https://github.com/sukantsondhi/Where-is-it/blob/main/docs/AZURE_SETUP.md" target="_blank" rel="noreferrer">Connect Azure <ArrowRight size={14}/></a></div>}
  {view==="homes"&&!home&&<>
   <section className="hero"><div><span className="eyebrow">A LITTLE ORDER. A LOT OF PEACE.</span><h1>Less “where is it?”<br/><span>More “found it.”</span></h1><p>A home for everything you call yours.<br/>Find it, share it, and get on with your day.</p><button className="primary" onClick={()=>setModal({kind:"home.create"})}><Plus size={18}/>Create a home</button></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="floating-tag"><Check size={15}/> Right where you left it</div><div className="cabinet"><div className="cabinet-top"/><div className="drawer"><i/></div><div className="drawer"><i/></div><div className="drawer open"><i/></div></div><div className="floating-box"><Box size={38}/></div><div className="location-chip"><MapPin size={18}/><span>Bedroom <small>Desk drawers</small></span></div></div></section>
   <SearchBar query={query} setQuery={setQuery}/>{query.trim()&&<><p className="muted">{filtered.length} items found across your homes</p>{rowCards(filtered)}{!filtered.length&&<Empty title="No matching items." text="Try a different name, category or location."/>}</>}
   <div className="stats"><div><HomeIcon/><strong>{state.homes.length}</strong><span>Shared homes</span></div><div><LayoutGrid/><strong>{state.homes.reduce((n,h)=>n+h.rooms.length,0)}</strong><span>Rooms mapped</span></div><div><Package/><strong>{all.length}</strong><span>Things found a home</span></div></div>
   <div className="section-heading"><div><h2>Your homes <span className="count-badge">{state.homes.length}</span></h2><p>Your places, and the people you share them with.</p></div><button className="text-btn" onClick={()=>setModal({kind:"home.create"})}><Plus size={17}/>New home</button></div>
   <div className="home-grid">{state.homes.map((h,i)=><button className="home-card" key={h.id} onClick={()=>openHome(h)}><div className={"home-cover cover-"+i}><div className="house-art"><HomeIcon size={100} strokeWidth={0.85}/><div className="house-ground"/></div><span className="role-badge">{h.role==="owner"?"Your home":"Shared with you"}</span></div><div className="home-body"><div className="spread"><h3>{h.name}</h3><ArrowRight size={20}/></div><p className="muted">{h.address||"A place for your favourite things"}</p><div className="home-metrics"><span><LayoutGrid size={15}/>{h.rooms.length} rooms</span><span><Package size={15}/>{count(h)} items</span></div><footer><div className="avatar-stack">{h.memberIds.slice(0,3).map((id,i)=><span key={id} className={"avatar small av-"+i}>{state.people.find(p=>p.id===id)?.avatar||"M"}</span>)}<small>{h.memberIds.length} members</small></div><small>Updated {new Date(h.updatedAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</small></footer></div></button>)}<button className="new-home-card" onClick={()=>setModal({kind:"home.create"})}><span><Plus size={27}/></span><h3>Another place to call home?</h3><p>Create a home and invite your people.</p></button></div>
   <div className="section-heading"><div><h2>Recently added</h2><p>The newest things in your space.</p></div><button className="text-btn" onClick={()=>goto("inventory")}>View all items <ArrowRight size={17}/></button></div>{!query.trim()&&rowCards([...all].sort((a,b)=>b.item.createdAt.localeCompare(a.item.createdAt)).slice(0,4))}
  </>}
  {view==="homes"&&home&&<>
   <button className="back-link" onClick={()=>{setQuery("");locationId?setLocationId(""):roomId?setRoomId(""):setHomeId("");}}><ArrowLeft size={16}/>{locationId?room?.name:roomId?home.name:"All homes"}</button>
   <div className="page-heading"><div><span className="eyebrow">{room?home.name:"YOUR SHARED SPACE"}</span><h1>{location?.name||room?.name||home.name}</h1><p>{room?"Created by "+room.createdBy+" · "+date(room.createdAt):"Created by "+home.createdBy+" · "+date(home.createdAt)}</p><small className="muted">Last updated {date(location?.updatedAt||room?.updatedAt||home.updatedAt)}</small></div><div className="button-group">{location&&<button className="secondary" onClick={()=>setModal({kind:"qr",location})}><QrCode size={18}/>QR label</button>}<button className="secondary" onClick={()=>setModal({kind:location?"location.rename":room?"room.rename":"home.rename",location,room})}>Rename</button><button className="primary" onClick={()=>setModal({kind:location?"item.create":room?"location.create":"room.create"})}><Plus size={18}/>{location?"Add item":room?"Add storage":"Add room"}</button></div></div>
   <SearchBar query={query} setQuery={setQuery}/><p className="muted">Search items in {location?.name||room?.name||home.name} and all locations inside it.</p>
   {query.trim()&&!location&&<><p className="muted">{filtered.length} items found</p>{rowCards(filtered)}{!filtered.length&&<Empty title="No matching items." text="Try a different name, category or location."/>}</>}
   {!room&&<div className="tabs" role="tablist" aria-label="Home sections">{["rooms","members",...(home.role==="owner"?["logs"]:[])].map(t=><button role="tab" aria-selected={tab===t} className={tab===t?"active":""} key={t} onClick={()=>setTab(t)}>{t==="logs"?"Activity log":t[0].toUpperCase()+t.slice(1)}</button>)}</div>}
   {(!room&&tab==="rooms")&&<div className="room-grid">{home.rooms.map(r=>{const Icon=roomIcon(r.icon);return <button className="room-card" key={r.id} onClick={()=>openRoom(r)}><span className="room-icon"><Icon size={28}/></span><h3>{r.name}</h3><p>{r.locations.length} storage locations · {r.locations.reduce((n,l)=>n+l.items.length,0)} items</p><small>By {r.createdBy}<br/>Updated {date(r.updatedAt)}</small><ArrowRight className="room-arrow" size={20}/></button>;})}<button className="room-card add-card" onClick={()=>setModal({kind:"room.create"})}><Plus size={26}/><h3>Add a room</h3><p>Give your things a place to start.</p></button></div>}
   {room&&!location&&<><div className="room-grid">{room.locations.map(l=><div className="room-card" key={l.id}><button className="card-open" onClick={()=>{setLocationId(l.id);setQuery("");}}><span className="room-icon"><Archive size={28}/></span><h3>{l.name}</h3><p>{l.items.length} items</p></button><div className="spread"><button className="text-btn" onClick={()=>setModal({kind:"qr",location:l})}><QrCode size={15}/>Print label</button><button className="icon-btn" aria-label={"Delete "+l.name} onClick={()=>setModal({kind:"location.delete",location:l})}><Trash2 size={15}/></button></div></div>)}</div>{!room.locations.length&&<Empty title="Every room starts somewhere." text="Add your first drawer, shelf or storage box."/>}<button className="danger-link" onClick={()=>setModal({kind:"room.delete",room})}>Delete empty room</button></>}
   {location&&<>{rowCards(filtered)}{!filtered.length&&<Empty title="Nothing here just yet." text="Add an item, or try another search."/>}<button className="danger-link" onClick={()=>setModal({kind:"location.delete",location})}>Delete empty storage location</button></>}
   {!room&&tab==="members"&&<section className="panel"><div className="section-heading"><div><h2>People in this home</h2><p>Members can manage rooms, locations and items.</p></div>{home.role==="owner"&&<button className="primary" onClick={()=>setModal({kind:"member"})}><Plus size={17}/>Add member</button>}</div>{home.memberIds.map(id=>{const p=state.people.find(p=>p.id===id);return <div className="person-row" key={id}><span className="avatar">{p?.avatar||"M"}</span><div><strong>{p?.name||"Home member"}</strong><small>{p?.email}</small></div>{home.role==="owner"&&id!==state.currentUser.id&&<button className="icon-btn" aria-label={"Remove "+(p?.name||"member")} onClick={()=>setModal({kind:"member.remove",row:undefined,location:{id,name:p?.name||"Member"} as StorageLocation})}><X size={18}/></button>}</div>;})}</section>}
   {!room&&tab==="logs"&&home.role==="owner"&&<section className="panel"><div className="section-heading"><div><h2>A clear picture of what changed</h2><p>Owner-only history. Members cannot access this log.</p></div></div>{state.events.filter(e=>e.homeId===home.id).map(e=><div className="activity-row" key={e.id}><span className="activity-dot"><Clock3 size={17}/></span><div><strong>{e.actorName} <span className="muted">{e.action.replace("."," · ")}</span></strong><p>{e.detail}</p><small>{date(e.timestamp)}</small></div></div>)}</section>}
  </>}
  {view==="inventory"&&<><div className="page-heading"><div><span className="eyebrow">YOUR WORLD, CATALOGUED</span><h1>Find your thing.</h1><p>Search every room, drawer and home you belong to.</p></div><button className="secondary" onClick={exportData}><ArrowDownToLine size={17}/>Export JSON</button></div><SearchBar query={query} setQuery={setQuery}/><div className="filter-chips">{["All",...new Set(all.map(r=>r.item.category))].map(c=><button key={c} className={c===category?"active":""} onClick={()=>setCategory(c)}>{c}</button>)}</div><p className="muted">{filtered.length} items found</p>{rowCards(filtered)}{!filtered.length&&<Empty title="Not found. Not forgotten." text="Try a different name, category or location."/>}</>}
  {view==="admin"&&isAzureMode&&state.currentUser.platformRole==="super-admin"&&<button className="secondary" onClick={exportAdminAudit}><ArrowDownToLine size={17}/>Download admin change attempts</button>}
  {view==="admin"&&admin&&<><div className="page-heading"><div><span className="eyebrow">PLATFORM ACCESS</span><h1>A considered guest list.</h1><p>Manage who can use Where is it. Household contents remain private.</p></div><button className="primary" onClick={()=>setModal({kind:"user"})}><Plus size={17}/>Invite user</button></div><div className="security-banner"><ShieldCheck/><div><strong>Admin access is not home access.</strong><p>This area manages platform accounts only. You cannot browse other people’s homes.</p></div></div><section className="panel">{adminUsers.map(p=><div className="person-row" key={p.id}><span className="avatar">{p.avatar}</span><div><strong>{p.name}</strong><small>{p.email}</small></div><span className="pill">{p.platformRole}</span><small>{p.status}</small>{p.platformRole!=="super-admin"&&(state.currentUser.platformRole==="super-admin"||p.platformRole==="user")&&<button className="secondary compact" disabled={busy} onClick={async()=>{setBusy(true);try{if(isAzureMode){await api("/admin/users",{method:"PATCH",body:JSON.stringify({id:p.id,status:p.status==="disabled"?"active":"disabled"})});setAdminUsers(await api("/admin/users"));}else{const next={...state,people:state.people.map(u=>u.id===p.id?{...u,status:(p.status==="disabled"?"active":"disabled") as "active"|"disabled"}:u)};saveState(next);setState(next);}}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}}>{p.status==="disabled"?"Enable":"Disable"}</button>}</div>)}</section></>}
  {view==="profile"&&<><div className="page-heading"><div><span className="eyebrow">MAKE YOURSELF AT HOME</span><h1>Your preferences.</h1><p>The little details that make this space yours.</p></div></div><section className="panel preferences"><div className="person-row"><span className="avatar">{state.currentUser.avatar}</span><div><strong>{state.currentUser.name}</strong><small>{state.currentUser.email}</small></div></div><div className="setting"><div><strong>Appearance</strong><p>Choose a calm light or midnight blue workspace.</p></div><button className="secondary" onClick={()=>setDark(!dark)}>{dark?<Sun size={18}/>:<Moon size={18}/>} {dark?"Light mode":"Dark mode"}</button></div><div className="setting"><div><strong>Your inventory, portable</strong><p>Download the homes you have access to as JSON. Photos are not included.</p></div><button className="secondary" onClick={exportData}><ArrowDownToLine size={18}/>Export</button></div><div className="setting"><div><strong>{isAzureMode?"Microsoft account":"Demo workspace"}</strong><p>{isAzureMode?"Your identity is managed by Microsoft Entra.":"This demo has no authentication. Do not store sensitive information here."}</p></div>{isAzureMode&&<a className="secondary" href="/.auth/logout"><LogOut size={18}/>Sign out</a>}</div></section></>}
  <footer className="page-footer"><span>Where is it<span className="brand-dot">.</span></span><small>A little less searching. A little more living.</small></footer>
  </main>
 </div>
 {notice&&<div className="toast" role="status"><Check size={18}/>{notice}</div>}
 {modal&&<Dialog title={modal.kind==="detail"?modal.row!.item.name:modal.kind==="qr"?"A label that leads the way":modal.kind==="member"?"Invite into your home":modal.kind==="user"?"Invite to the platform":modal.kind.endsWith("delete")?"Remove this entry?":modal.kind==="member.remove"?"Remove home member?":modal.kind.endsWith("rename")?"Give it a new name":modal.kind==="item.move"?"Move to a new place":modal.kind==="item.update"?"Edit item":modal.kind==="item.create"?"A home for something new":modal.kind==="room.create"?"Create a room":modal.kind==="location.create"?"Add a storage location":"Create your home"} close={()=>!busy&&setModal(null)}>
  {modal.kind==="detail"&&modal.row&&<div className="detail"><div className="detail-art">{imageFor(modal.row)?<img src={imageFor(modal.row)!} alt={modal.row.item.name}/>:<Package size={90} strokeWidth={1}/>}</div><span className="pill">{modal.row.item.category} · Quantity {modal.row.item.quantity}</span><p>{modal.row.item.note||"No notes added."}</p><div className="location-path"><MapPin size={19}/>{modal.row.home.name} → {modal.row.room.name} → {modal.row.location.name}</div><small className="muted">Added by {modal.row.item.createdBy}<br/>{date(modal.row.item.createdAt)}<br/>Updated {date(modal.row.item.updatedAt)}</small><div className="button-group"><button className="primary" onClick={()=>setModal({...modal,kind:"item.update"})}>Edit item</button><button className="secondary" onClick={()=>setModal({...modal,kind:"item.move"})}>Move</button><button className="icon-btn danger" aria-label="Delete item" onClick={()=>setModal({...modal,kind:"item.delete"})}><Trash2 size={20}/></button></div><label className="photo-upload"><Camera size={18}/>Add or replace photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{if(e.target.files?.[0])void photo(modal.row!,e.target.files[0]);}}/></label></div>}
  {modal.kind==="qr"&&modal.location&&<div className="qr-content"><div id="qr-print"><img className="print-logo" src="/mark.svg" width="34" alt=""/><h3>{modal.location.name}</h3><QRCodeSVG value={window.location.origin+"/?location="+encodeURIComponent(modal.location.id)} size={220} level="M" marginSize={4}/><p>Where is it · Scan to see inside</p></div><p className="muted">This label stays the same when you rename the location. Members must sign in to open it in Azure mode.</p><button className="primary" onClick={()=>window.print()}><QrCode size={18}/>Print label</button><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+"/?location="+encodeURIComponent(modal.location!.id));setNotice("Location link copied.");}catch{setNotice("Clipboard unavailable. Use the QR label instead.");}}}>Copy link</button></div>}
  {(modal.kind.endsWith("delete")||modal.kind==="member.remove")&&<div className="form-body"><p>{modal.kind==="member.remove"?"This person will lose access to the home.":"This removes the entry. Item deletions are recorded in the owner’s log but are not currently restorable."}</p><div className="form-actions"><button className="secondary" onClick={()=>setModal(null)}>Cancel</button><button className="danger-button" disabled={busy} onClick={()=>run({type:modal.kind,homeId:modal.row?.home.id||homeId,roomId:modal.row?.room.id||modal.room?.id||roomId,locationId:modal.row?.location.id||modal.location?.id||locationId,itemId:modal.row?.item.id,data:modal.kind==="member.remove"?{userId:modal.location!.id}:{}})}>Remove</button></div></div>}
  {!["detail","qr","member.remove"].includes(modal.kind)&&!modal.kind.endsWith("delete")&&<form onSubmit={submit} className="form-body">
   {modal.kind==="item.move"?<label>New storage location<select required name="target" defaultValue=""><option value="" disabled>Choose a location</option>{modal.row!.home.rooms.flatMap(r=>r.locations.filter(l=>l.id!==modal.row!.location.id).map(l=><option key={l.id} value={l.id}>{r.name} → {l.name}</option>))}</select></label>:modal.kind==="member"?<><p className="muted">Enter the exact email of an active, approved platform user.</p><label>Email address<input name="email" type="email" required placeholder="person@example.com"/></label></>:<>
   <label>{modal.kind==="user"?"Full name":"Name"}<input name="name" autoFocus required maxLength={100} defaultValue={modal.kind==="item.update"?modal.row?.item.name:modal.kind.endsWith("rename")?(modal.location?.name||modal.room?.name||home?.name):""} placeholder={modal.kind==="home.create"?"e.g. Family Home":modal.kind==="room.create"?"e.g. Bedroom":modal.kind==="location.create"?"e.g. Top desk drawer":"Give it a clear name"}/></label>
   {modal.kind==="home.create"&&<label>Area or description <span className="muted">(optional)</span><input name="address" maxLength={150} placeholder="e.g. Exampletown"/></label>}
   {modal.kind==="room.create"&&<label>Room style<select name="icon"><option value="bed">Bedroom</option><option value="monitor">Office</option><option value="utensils">Kitchen</option><option value="warehouse">Garage</option><option value="archive">Storage / other</option></select></label>}
   {["item.create","item.update"].includes(modal.kind)&&<><div className="form-columns"><label>Quantity<input type="number" name="quantity" min="1" max="9999" required defaultValue={modal.row?.item.quantity||1}/></label><label>Category<input name="category" maxLength={40} defaultValue={modal.row?.item.category||"Other"} list="categories"/><datalist id="categories">{["Tech","Cables","Personal","Tools","Utility","Storage","Keepsakes"].map(c=><option key={c}>{c}</option>)}</datalist></label></div><label>Notes<textarea name="note" maxLength={1000} defaultValue={modal.row?.item.note} placeholder="Colour, brand, or anything that helps you recognise it." rows={3}/></label><p className="muted">Save the item, then open it to add a photo.</p></>}
   {modal.kind==="user"&&<><p className="muted">We will email a link valid for 7 days. They can sign in with the Microsoft account for this email address. To resend an invitation, enter the same email again.</p>{!isAzureMode&&<p className="muted">Demo only: no email will be sent.</p>}<label>Email<input name="email" required type="email" maxLength={254}/></label><label>Platform role<select name="role"><option value="user">User</option>{state.currentUser.platformRole==="super-admin"&&<option value="co-admin">Co-admin</option>}</select></label></>}
   </>}
   <div className="form-actions"><button type="button" className="secondary" onClick={()=>setModal(null)}>Cancel</button><button className="primary" disabled={busy}>{busy?"Saving…":modal.kind==="user"?"Send invitation":"Save"}<ArrowRight size={17}/></button></div>
  </form>}
 </Dialog>}
 </div>;
}
function SearchBar({query,setQuery}:{query:string;setQuery:(s:string)=>void}){return <div className="search-bar"><Search size={21}/><input aria-label="Search inventory" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try “adapter”, “batteries” or “bedroom”…"/>{query&&<button className="icon-btn" aria-label="Clear search" onClick={()=>setQuery("")}><X size={18}/></button>}</div>;}
function Empty({title,text}:{title:string;text:string}){return <div className="empty"><Box size={44} strokeWidth={1.2}/><h2>{title}</h2><p>{text}</p></div>;}
