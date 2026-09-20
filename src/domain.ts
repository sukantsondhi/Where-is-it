import type { AppState, Home, Room } from "./types";
import { auditRoomScope, canAccessRoom, canManageRoomVisibility } from "./privacy";
export interface Command { type: string; homeId?: string; roomId?: string; locationId?: string; itemId?: string; data?: Record<string, string>; }
export function applyCommand(input: AppState, cmd: Command): AppState {
  const s = structuredClone(input), user = s.currentUser, d = cmd.data || {};
  if (user.status !== "active") throw new Error("Account is not active.");
  const stamp = new Date().toISOString(), id = () => crypto.randomUUID();
  const name = () => { const n = (d.name || "").trim(); if (!n || n.length > 100) throw new Error("Use a name between 1 and 100 characters."); return n; };
  if (cmd.type === "home.create") {
    const home: Home = { id: id(), name: name(), address: (d.address || "").slice(0,150), role: "owner", accent: "#1769ff", createdAt: stamp, updatedAt: stamp, createdBy: user.name, memberIds: [user.id], rooms: [] };
    s.homes.unshift(home); cmd = { ...cmd, homeId: home.id };
  }
  const home = s.homes.find(h => h.id === cmd.homeId && h.memberIds.includes(user.id));
  if (!home) throw new Error("Home not found.");
  const room = home.rooms.find(r => r.id === cmd.roomId);
  if (room && !canAccessRoom(room,user.id)) throw Object.assign(new Error("Room not found."),{status:404});
  const auditRooms:Room[] = room ? [structuredClone(room)] : [];
  const loc = room?.locations.find(l => l.id === cmd.locationId);
  const item = loc?.items.find(i => i.id === cmd.itemId);
  let detail = home.name;
  switch (cmd.type) {
    case "home.create": break;
    case "home.rename": home.name = name(); detail = home.name; break;
    case "room.create": {
      const visibility=d.visibility || "household";
      if(visibility!=="household" && visibility!=="private")throw new Error("Choose household or private visibility.");
      const created:Room={id:id(),name:name(),icon:d.icon || "bed",createdAt:stamp,updatedAt:stamp,createdBy:user.name,ownerId:user.id,visibility,locations:[]};
      home.rooms.push(created);auditRooms.push(created);
      if(visibility==="private")home.legacyAuditRestricted=true;
      detail = name(); break;
    }
    case "room.visibility": {
      if(!room)throw new Error("Room not found.");
      if(!canManageRoomVisibility(home,room,user.id))throw Object.assign(new Error("Only the room owner can change its visibility."),{status:403});
      if(d.visibility!=="household" && d.visibility!=="private")throw new Error("Choose household or private visibility.");
      room.ownerId ||= user.id;
      room.visibility=d.visibility;
      if(d.visibility==="private")home.legacyAuditRestricted=true;
      auditRooms.push(room);detail="Changed room visibility: "+room.name;break;
    }
    case "room.rename": if (!room) throw new Error("Room not found."); detail = room.name + " → " + name(); room.name = name(); break;
    case "room.delete": if (!room) throw new Error("Room not found."); if (room.locations.length) throw new Error("Remove storage locations first."); if(room.visibility==="private"&&room.ownerId)home.deletedPrivateRoomOwners={...home.deletedPrivateRoomOwners,[room.id]:room.ownerId}; detail = room.name; home.rooms = home.rooms.filter(r => r.id !== room.id); break;
    case "location.create":
      if (!room) throw new Error("Room not found.");
      room.locations.push({id:id(),name:name(),kind:"drawer",updatedAt:stamp,items:[]}); detail = name(); break;
    case "location.rename": if (!loc) throw new Error("Location not found."); detail = loc.name + " → " + name(); loc.name = name(); break;
    case "location.delete": if (!loc || !room) throw new Error("Location not found."); if(loc.items.length) throw new Error("Remove or move items first."); detail=loc.name; room.locations=room.locations.filter(l=>l.id!==loc.id); break;
    case "item.create":
    case "item.update": {
      if (!loc) throw new Error("Location not found.");
      const quantity = Number(d.quantity || "1");
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) throw new Error("Quantity must be 1 to 9999.");
      if ((d.note || "").length > 1000) throw new Error("Notes must be under 1,000 characters.");
      const values = {name:name(),note:d.note || "",quantity,category:(d.category || "Other").slice(0,40),updatedAt:stamp};
      if (cmd.type === "item.update") { if (!item) throw new Error("Item not found."); Object.assign(item,values); }
      else loc.items.unshift({...values,id:id(),colour:"#397cff",createdAt:stamp,createdBy:user.name});
      detail = values.name + " · " + room!.name + " · " + loc.name; break;
    }
    case "item.move": {
      if (!loc || !item) throw new Error("Item not found.");
      const targetRoom=home.rooms.find(r=>r.locations.some(l=>l.id===d.target));
      if(targetRoom && !canAccessRoom(targetRoom,user.id))throw Object.assign(new Error("Location not found."),{status:404});
      const target=targetRoom?.locations.find(l=>l.id===d.target);
      if (!target || !targetRoom || target.id === loc.id) throw new Error("Choose another location in this home.");
      auditRooms.push(targetRoom);
      loc.items=loc.items.filter(i=>i.id!==item.id); target.items.push({...item,updatedAt:stamp}); target.updatedAt=stamp; targetRoom.updatedAt=stamp;
      detail=item.name+" · "+loc.name+" → "+target.name; break;
    }
    case "item.delete":
      if (!loc || !item) throw new Error("Item not found."); detail=item.name+" · "+loc.name;
      loc.items=loc.items.filter(i=>i.id!==item.id); break;
    case "member.add":
      if(home.role!=="owner") throw new Error("Only the home owner can manage members.");
      if(!d.userId || home.memberIds.includes(d.userId)) throw new Error("Member already added or invalid.");
      home.memberIds.push(d.userId); detail="Added a home member"; break;
    case "member.remove":
      if(home.role!=="owner" || d.userId===user.id) throw new Error("The owner cannot be removed.");
      home.memberIds=home.memberIds.filter(u=>u!==d.userId); detail="Removed a home member"; break;
    default: throw new Error("Unsupported action.");
  }
  home.updatedAt=stamp; if(room)room.updatedAt=stamp; if(loc)loc.updatedAt=stamp;
  s.events.unshift({id:id(),homeId:home.id,actorId:user.id,actorName:user.name,action:cmd.type,detail,timestamp:stamp,entityType:cmd.type.split(".")[0] as "item",...auditRoomScope(auditRooms)});
  return s;
}
export function flatten(homes: Home[]) {
  return homes.flatMap(home=>home.rooms.flatMap(room=>room.locations.flatMap(location=>location.items.map(item=>({home,room,location,item})))));
}
export type ItemRow = ReturnType<typeof flatten>[number];
