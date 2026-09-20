import type { AppState, AuditEvent, Home, Room } from "./types";

export function canAccessRoom(room: Room, userId: string): boolean {
  return room.visibility !== "private" || room.ownerId === userId;
}

export function canManageRoomVisibility(home: Home, room: Room, userId: string): boolean {
  return room.ownerId ? room.ownerId === userId : home.role === "owner";
}

export function auditRoomScope(rooms: Room[]): Pick<AuditEvent, "roomIds" | "privateOwnerId"> {
  const privateRoom = rooms.find(room => room.visibility === "private");
  return {
    roomIds: [...new Set(rooms.map(room => room.id))],
    ...(privateRoom ? { privateOwnerId: privateRoom.ownerId } : {})
  };
}

export function canReadAudit(event: AuditEvent, home: Home, userId: string): boolean {
  if (event.privateOwnerId && event.privateOwnerId !== userId) return false;
  // Old records contain free-text details without room IDs. Once privacy is
  // used, these cannot safely be attributed to a room and must stay hidden.
  if (!event.roomIds && home.legacyAuditRestricted && !["home", "member"].includes(event.entityType)) return false;
  return (event.roomIds || []).every(id => {
    const room = home.rooms.find(room => room.id === id);
    if (room) return canAccessRoom(room, userId);
    const privateOwner = home.deletedPrivateRoomOwners?.[id];
    return !privateOwner || privateOwner === userId;
  });
}

export function visibleHome(home: Home, userId: string): Home {
  const { deletedPrivateRoomOwners, legacyAuditRestricted, ...visible } = home;
  return { ...visible, rooms: home.rooms.filter(room => canAccessRoom(room, userId)) };
}

// Used by the local demo only; Azure performs the equivalent projection before
// sending data to the browser. Never persist this projection over a full home.
export function visibleState(state: AppState): AppState {
  const homes = state.homes.filter(home => home.memberIds.includes(state.currentUser.id));
  return {
    ...state,
    homes: homes.map(home => visibleHome(home, state.currentUser.id)),
    events: state.events.filter(event => {
      const home = homes.find(home => home.id === event.homeId);
      return home?.role === "owner" && canReadAudit(event, home, state.currentUser.id);
    })
  };
}
