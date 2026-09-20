
import test from "node:test";
import assert from "node:assert/strict";
import { applyCommand, flatten } from "../src/domain";
import { initialState } from "../src/data";
const command={type:"item.create",homeId:"home-family",roomId:"room-bedroom",locationId:"loc-desk",data:{name:"Test cable",quantity:"2"}};
test("creates item and audit together without mutating input",()=>{const n=flatten(initialState.homes).length;const next=applyCommand(initialState,command);assert.equal(flatten(next.homes).length,n+1);assert.equal(flatten(initialState.homes).length,n);assert.equal(next.events[0].actorId,initialState.currentUser.id);});
test("platform admin has no access to a home without membership",()=>{const s=structuredClone(initialState);s.homes[0].memberIds=[];assert.throws(()=>applyCommand(s,command),/not found/);});
test("member may edit inventory",()=>{const s=structuredClone(initialState);s.homes[0].role="member";assert.doesNotThrow(()=>applyCommand(s,command));});
test("member cannot add home members",()=>{const s=structuredClone(initialState);s.homes[0].role="member";assert.throws(()=>applyCommand(s,{type:"member.add",homeId:"home-family",data:{userId:"other"}}),/owner/);});
test("disabled user cannot mutate",()=>{const s=structuredClone(initialState);s.currentUser.status="disabled";assert.throws(()=>applyCommand(s,command),/active/);});
test("rejects cross-room location spoofing",()=>assert.throws(()=>applyCommand(initialState,{...command,roomId:"room-office"}),/not found/));
test("rejects invalid quantity",()=>assert.throws(()=>applyCommand(initialState,{...command,data:{name:"Cable",quantity:"-3"}}),/Quantity/));
test("cannot delete non-empty room",()=>assert.throws(()=>applyCommand(initialState,{type:"room.delete",homeId:"home-family",roomId:"room-bedroom"}),/first/));
test("move stays within the home and records history",()=>{const next=applyCommand(initialState,{...command,type:"item.move",itemId:"item-hdmi",data:{target:"loc-tech-box"}});const row=flatten(next.homes).find(r=>r.item.id==="item-hdmi");assert.equal(row?.location.id,"loc-tech-box");assert.equal(next.events[0].action,"item.move");});
test("rejects move across homes",()=>assert.throws(()=>applyCommand(initialState,{...command,type:"item.move",itemId:"item-hdmi",data:{target:"loc-keepsakes"}}),/another location/));
test("owner cannot remove themselves",()=>assert.throws(()=>applyCommand(initialState,{type:"member.remove",homeId:"home-family",data:{userId:initialState.currentUser.id}}),/owner/));
test("rename preserves QR identifier",()=>{const next=applyCommand(initialState,{...command,type:"location.rename",data:{name:"New drawer"}});assert.equal(next.homes[0].rooms[0].locations[0].id,"loc-desk");});
