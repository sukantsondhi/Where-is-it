// Explicit opt-in live integration test. Only generated test records are removed.
// Run npm run test:integration with COSMOS_ENDPOINT/COSMOS_KEY set.
const assert = require('node:assert/strict');
const { CosmosClient } = require('../../api/node_modules/@azure/cosmos');
const { HttpRequest } = require('../../api/node_modules/@azure/functions');
const { handle } = require('../../api/dist/api/src/index.js');
const { photoDocument } = require('../../api/dist/api/src/photos.js');

async function main() {
 assert.ok(process.env.COSMOS_ENDPOINT && process.env.COSMOS_KEY, 'Cosmos settings required');
 process.env.AUTH_BOUNDARY = 'swa-managed';
 process.env.APP_ORIGIN = 'https://where-is-it-test.invalid';
 const db = new CosmosClient({endpoint:process.env.COSMOS_ENDPOINT,key:process.env.COSMOS_KEY}).database(process.env.COSMOS_DATABASE || 'where-is-it');
 const users = db.container('users'), inventory = db.container('inventory');
 const ownerId = 'test-'+crypto.randomUUID(), outsiderId = 'test-'+crypto.randomUUID();
 const userIds = [ownerId, outsiderId];
 async function request(route, method='GET', body, userId=ownerId, origin=process.env.APP_ORIGIN) {
  const headers = {'content-type':'application/json',origin};
  if(userId) headers['x-ms-client-principal'] = Buffer.from(JSON.stringify({identityProvider:'aad',userId,userRoles:['authenticated']})).toString('base64');
  return handle(new HttpRequest({url:process.env.APP_ORIGIN+'/api/'+route,method,params:{route:route.split('?')[0]},headers,...(body?{body:{string:JSON.stringify(body)}}:{})}));
 }
 async function command(body) {
  const result = await request('commands','POST',body);
  assert.equal(result.status || 200,200,JSON.stringify(result.jsonBody));
  return result.jsonBody;
 }
 try {
  assert.equal((await request('state','GET',undefined,null)).status,401);
  assert.equal((await request('state','GET',undefined,ownerId)).status,403);
  for(const id of userIds) await users.items.create({id,name:'Temporary integration test',email:id+'@example.invalid',avatar:'T',platformRole:'user',status:'active'});
  let state = await command({type:'home.create',data:{name:'Temporary integration test'}});
  const homeId = state.homes[0].id;
  state = await command({type:'room.create',homeId,data:{name:'Test room'}});
  const roomId = state.homes[0].rooms[0].id;
  state = await command({type:'location.create',homeId,roomId,data:{name:'Test drawer'}});
  const locationId = state.homes[0].rooms[0].locations[0].id;
  state = await command({type:'item.create',homeId,roomId,locationId,data:{name:'Test item'}});
  const itemId = state.homes[0].rooms[0].locations[0].items[0].id;
  const photoRoute = 'photos?homeId='+homeId+'&itemId='+itemId;
  const data = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
  assert.equal((await request(photoRoute)).status,404);
  assert.equal((await request('photos','POST',{homeId,itemId,data:'invalid'})).status,400);
  assert.equal((await request('photos','POST',{homeId,itemId,data},ownerId,'https://wrong.invalid')).status,403);
  const oversized = Buffer.alloc(650001); oversized.write('RIFF'); oversized.write('WEBP',8);
  assert.throws(()=>photoDocument(homeId,itemId,'data:image/webp;base64,'+oversized.toString('base64')),/oversized/);
  for(let i=0;i<2;i++) assert.equal((await request('photos','POST',{homeId,itemId,data})).jsonBody.ok,true);
  assert.equal((await request(photoRoute)).jsonBody.data,data);
  assert.equal((await request(photoRoute,'GET',undefined,outsiderId)).status,404);
  const snapshot = await request('state');
  assert.ok(!JSON.stringify(snapshot.jsonBody).includes('data:image/webp'));
  const {resources:photos} = await inventory.items.query({query:"SELECT * FROM c WHERE c.kind = 'photo'"},{partitionKey:homeId}).fetchAll();
  assert.equal(photos.length,1,'Replacing a photo must not leave old copies');
  await command({type:'item.delete',homeId,roomId,locationId,itemId});
  assert.equal((await request(photoRoute)).status,404);
  const {resources:remainingPhotos} = await inventory.items.query({query:"SELECT * FROM c WHERE c.kind = 'photo'"},{partitionKey:homeId}).fetchAll();
  assert.equal(remainingPhotos.length,0,'Item deletion must delete its photo');
  console.log('PASS: anonymous/unapproved access, home/item creation, photo validation, origin and membership checks, photo replacement and atomic deletion.');
 } finally {
  const {resources:homes} = await inventory.items.query({query:'SELECT c.id FROM c WHERE c.kind = @kind AND c.ownerId = @owner',parameters:[{name:'@kind',value:'home'},{name:'@owner',value:ownerId}]}).fetchAll();
  for(const home of homes) {
   const {resources:docs} = await inventory.items.query('SELECT c.id FROM c',{partitionKey:home.id}).fetchAll();
   for(const doc of docs) await inventory.item(doc.id,home.id).delete();
  }
  for(const id of userIds) { try { await users.item(id,id).delete(); } catch(e) { if(e.code!==404) throw e; } }
  console.log('Temporary test records removed.');
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
