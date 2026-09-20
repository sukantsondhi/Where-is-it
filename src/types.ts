export type PlatformRole = "super-admin" | "co-admin" | "user";
export type HomeRole = "owner" | "member";

export interface Person {
  id: string;
  name: string;
  email: string;
  avatar: string;
  platformRole: PlatformRole;
  status: "active" | "invited" | "disabled";
}

export interface InventoryItem {
  id: string;
  photoId?: string;
  name: string;
  note: string;
  quantity: number;
  category: string;
  colour: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface StorageLocation {
  id: string;
  name: string;
  kind: "drawer" | "cabinet" | "shelf" | "box" | "other";
  items: InventoryItem[];
  updatedAt: string;
}

export interface Room {
  id: string;
  visibility?: "household" | "private";
  ownerId?: string;
  name: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  locations: StorageLocation[];
}

export interface Home {
  id: string;
  legacyAuditRestricted?: boolean;
  deletedPrivateRoomOwners?: Record<string, string>;
  name: string;
  address: string;
  role: HomeRole;
  accent: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  memberIds: string[];
  rooms: Room[];
}

export interface AuditEvent {
  id: string;
  roomIds?: string[];
  privateOwnerId?: string;
  homeId: string;
  actorId: string;
  actorName: string;
  action: string;
  detail: string;
  timestamp: string;
  entityType: "home" | "room" | "location" | "item" | "member";
}

export interface AppState {
  currentUser: Person;
  people: Person[];
  homes: Home[];
  events: AuditEvent[];
}
