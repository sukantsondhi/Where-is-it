const test = require('node:test');
const assert = require('node:assert/strict');
const { CosmosClient } = require('../api/node_modules/@azure/cosmos');
const { HttpRequest } = require('../api/node_modules/@azure/functions');
const { emailId } = require('../api/dist/api/src/invitations.js');
const { EmailClient } = require('../api/node_modules/@azure/communication-email');

test('invitation delivery, account binding, access controls and replay protection', async () => {
 const records = new Map(); let version = 0, delivery, rejectDelivery = false, rejectAudit = false;
 const key = (id, partition=id) => partition === id ? id : partition+'|'+id;
 const save = value => { const result = {...value, _etag: String(++version)}; records.set(key(value.id,value.homeId || value.id), result); return {resource: result}; };
 const container = {
  item: (id, partition=id) => ({
   read: async () => ({resource: records.get(key(id,partition))}),
   replace: async (value, options) => {
    if (options?.accessCondition?.condition !== records.get(key(id,partition))?._etag) throw {code: 412};
    return save(value);
   }
  }),
  items: {
   create: async value => { if (value.kind==='admin-audit'&&rejectAudit) throw {code:503}; if (records.has(key(value.id,value.homeId || value.id))) throw {code:409}; return save(value); },
   readAll: () => ({fetchAll: async () => ({resources: [...records.values()].filter(p=>p.platformRole)})}),
   query: ({query, parameters}) => ({fetchAll: async () => ({resources: query.includes('ARRAY_CONTAINS') ? [] : query.includes('admin-audit') ? [...records.values()].filter(p=>p.kind==='admin-audit') : [...records.values()].filter(p =>
    query.includes('c.swaId') ? p.swaId === parameters[0].value : p.email?.toLowerCase() === parameters[0].value)})})
  }
 };
 const originalDatabase = CosmosClient.prototype.database, originalFetch = global.fetch;
 CosmosClient.prototype.database = () => ({container: () => container});
 global.fetch = async (_url, options) => { delivery = JSON.parse(options.body); return {ok: !rejectDelivery}; };
 Object.assign(process.env, {AUTH_BOUNDARY:'swa-managed', COSMOS_ENDPOINT:'https://test.invalid', COSMOS_KEY:'dGVzdA==', APP_ORIGIN:'https://app.invalid', RESEND_API_KEY:'test', INVITE_FROM:'invites@example.com'});
 const {handle} = require('../api/dist/api/src/index.js');
 const person = (id, platformRole) => ({id, platformRole, email:id+'@example.com', name:id, avatar:'T', status:'active'});
 save(person('admin', 'super-admin')); save(person('coadmin', 'co-admin')); save(person('ordinary', 'user'));
 const request = (route, body, id='admin', email=id+'@example.com', method='POST', origin=process.env.APP_ORIGIN) => handle(new HttpRequest({
  url:process.env.APP_ORIGIN+'/api/'+route, method, params:{route},
  headers:{origin, 'content-type':'application/json', 'x-ms-client-principal':Buffer.from(JSON.stringify({identityProvider:'aad', userId:id, userDetails:email, userRoles:['authenticated']})).toString('base64')},
  ...(body ? {body:{string:JSON.stringify(body)}} : {})
 }));
 const input = {name:'Invitee', email:'invitee@example.com', role:'user'};
 const invite = () => request('admin/users', input);
 const token = () => new URLSearchParams(new URL(delivery.text.match(/https:\/\/\S+/)[0]).hash.slice(1)).get('invite');
 try {
  assert.equal((await request('admin/users',input,'ordinary')).status,403);
  assert.equal((await request('admin/users',{...input,role:'co-admin'},'coadmin')).status,403);
  assert.equal((await invite()).jsonBody.ok,true);
  assert.deepEqual(delivery.to,[input.email]);
  const firstToken=token(), id=emailId(input.email);
  assert.equal(records.get(id).status,'invited');
  assert.ok(!JSON.stringify(records.get(id)).includes(firstToken));
  const listing = await request('admin/users',undefined,'admin',undefined,'GET');
  assert.ok(!JSON.stringify(listing.jsonBody).includes('tokenHash'));
  assert.equal((await request('invitations/accept',{email:input.email,token:firstToken},'new','wrong@example.com')).status,403);
  assert.equal((await invite()).jsonBody.ok,true);
  assert.equal((await request('invitations/accept',{email:input.email,token:firstToken},'new',input.email)).status,403);
  const currentToken=token();
  assert.equal((await request('admin/users',{id,status:'disabled'},'admin',undefined,'PATCH')).jsonBody.ok,true);
  assert.equal((await request('invitations/accept',{email:input.email,token:currentToken},'new',input.email)).status,403);
  assert.equal((await request('admin/users',{id,status:'active'},'admin',undefined,'PATCH')).status,400);
  records.get(id).status='invited';
  records.get(id).expiresAt=Date.now()-1;
  assert.equal((await request('invitations/accept',{email:input.email,token:currentToken},'new',input.email)).status,403);
  records.get(id).expiresAt=Date.now()+60000;
  assert.equal((await request('invitations/accept',{email:input.email,token:currentToken},'new',input.email,'POST','https://evil.invalid')).status,403);
  assert.equal((await request('invitations/accept',{email:input.email,token:currentToken},'new',input.email)).jsonBody.ok,true);
  assert.equal(records.get(id).swaId,'new');
  assert.equal(records.get(id).tokenHash,undefined);
  const signedIn = await request('state',undefined,'new',input.email,'GET');
  assert.equal(signedIn.jsonBody.currentUser.id,id);
  assert.ok(!JSON.stringify(signedIn.jsonBody).includes('swaId'));
  assert.equal((await request('invitations/accept',{email:input.email,token:currentToken},'new',input.email)).status,409);
  assert.equal((await invite()).status,409);
  assert.equal((await request('admin/users',{id,status:'disabled'},'admin',undefined,'PATCH')).jsonBody.ok,true);
  assert.equal((await request('admin/users',undefined,'new',input.email,'GET')).status,403);
  assert.equal((await request('admin/audit',undefined,'coadmin',undefined,'GET')).status,403);
  const audit=(await request('admin/audit',undefined,'admin',undefined,'GET')).jsonBody;
  assert.ok(audit.some(event=>event.action==='invitation.create'&&event.targetId===id));
  assert.ok(audit.some(event=>event.action==='account.disable'&&event.targetId===id));
  rejectAudit=true;
  assert.equal((await request('admin/users',{id:'ordinary',status:'disabled'},'admin',undefined,'PATCH')).status,503);
  assert.equal(records.get('ordinary').status,'active');
  rejectAudit=false;
  rejectDelivery=true;
  assert.equal((await request('admin/users',{...input,email:'retry@example.com'})).status,400);
  assert.equal(records.get(emailId('retry@example.com')).status,'invited');
  assert.equal((await request('admin/users',{...input,email:'retry2@example.com'})).status,400);
  assert.equal((await request('admin/users',{...input,email:'retry3@example.com'})).status,400);
  const limitedInvite=await request('admin/users',{...input,email:'retry4@example.com'});
  assert.equal(limitedInvite.status,429);
  assert.ok(Number(limitedInvite.headers['Retry-After'])>0);
  let limitedRead;
  for(let i=0;i<60;i++) limitedRead=await request('state',undefined,'admin',undefined,'GET');
  assert.equal(limitedRead.status,429);
 } finally { CosmosClient.prototype.database=originalDatabase; global.fetch=originalFetch; }
});

test('Azure email sender uses the configured domain and handles failed sends safely', async () => {
 const {sendInvitation, requireEmailConfiguration} = require('../api/dist/api/src/invitations.js');
 const originalSend = EmailClient.prototype.beginSend;
 const originalEnvironment = {...process.env};
 let message, status='Succeeded';
 Object.assign(process.env, {ACS_EMAIL_CONNECTION_STRING:'endpoint=https://test.communication.azure.com/;accesskey=dGVzdA==', INVITE_FROM:'DoNotReply@example.azurecomm.net', APP_ORIGIN:'https://app.invalid'});
 EmailClient.prototype.beginSend = async value => {message=value; return {pollUntilDone:async()=>({status})};};
 try {
  await sendInvitation('guest@example.com','a'.repeat(64));
  assert.equal(message.senderAddress,process.env.INVITE_FROM);
  assert.deepEqual(message.recipients.to,[{address:'guest@example.com'}]);
  const link=new URL(message.content.plainText.match(/https:\/\/\S+/)[0]);
  assert.equal(new URLSearchParams(link.hash.slice(1)).get('invite'),'a'.repeat(64));
  assert.equal(link.search,'');
  status='Failed';
  await assert.rejects(sendInvitation('guest@example.com','b'.repeat(64)),/could not be confirmed/);
  EmailClient.prototype.beginSend=async()=>{throw new Error('secret details');};
  await assert.rejects(sendInvitation('guest@example.com','b'.repeat(64)),error=>!error.message.includes('secret details'));
  delete process.env.ACS_EMAIL_CONNECTION_STRING;delete process.env.RESEND_API_KEY;
  assert.throws(requireEmailConfiguration,/Configure ACS_EMAIL_CONNECTION_STRING/);
 } finally {
  EmailClient.prototype.beginSend=originalSend;
  for(const key of ['ACS_EMAIL_CONNECTION_STRING','RESEND_API_KEY','INVITE_FROM','APP_ORIGIN']) {
   if(originalEnvironment[key]===undefined)delete process.env[key];else process.env[key]=originalEnvironment[key];
  }
 }
});
