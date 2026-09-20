import type { AppState, AuditEvent, Home, Person } from "./types";

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

export const people: Person[] = [
  { id: "u-alex", name: "Alex Morgan", email: "alex@example.com", avatar: "AM", platformRole: "super-admin", status: "active" },
  { id: "u-jamie", name: "Jamie Morgan", email: "jamie@example.com", avatar: "JM", platformRole: "user", status: "active" },
  { id: "u-taylor", name: "Taylor Morgan", email: "taylor@example.com", avatar: "TM", platformRole: "user", status: "active" },
  { id: "u-nina", name: "Nina Patel", email: "nina@example.com", avatar: "NP", platformRole: "co-admin", status: "invited" }
];

export const homes: Home[] = [
  {
    id: "home-family",
    name: "Family Home",
    address: "Exampletown",
    role: "owner",
    accent: "#1769ff",
    createdAt: daysAgo(42),
    updatedAt: hoursAgo(0.4),
    createdBy: "Alex Morgan",
    memberIds: ["u-alex", "u-jamie", "u-taylor"],
    rooms: [
      {
        id: "room-bedroom",
        name: "Bedroom",
        icon: "bed",
        createdAt: daysAgo(40),
        updatedAt: hoursAgo(0.4),
        createdBy: "Alex Morgan",
        locations: [
          {
            id: "loc-desk",
            name: "Desk drawers",
            kind: "drawer",
            updatedAt: hoursAgo(0.4),
            items: [
              { id: "item-hdmi", name: "USB-C to HDMI adapter", note: "Grey Anker adapter", quantity: 1, category: "Tech", colour: "#397cff", createdAt: daysAgo(12), updatedAt: hoursAgo(0.4), createdBy: "Alex Morgan" },
              { id: "item-airtag", name: "Spare AirTag", note: "Battery replaced recently", quantity: 1, category: "Tech", colour: "#33a6a0", createdAt: daysAgo(18), updatedAt: daysAgo(4), createdBy: "Jamie Morgan" },
              { id: "item-cables", name: "Braided USB-C cables", note: "Two metres", quantity: 3, category: "Cables", colour: "#7a65e8", createdAt: daysAgo(20), updatedAt: daysAgo(7), createdBy: "Alex Morgan" }
            ]
          },
          {
            id: "loc-bedside",
            name: "Bedside cabinet",
            kind: "cabinet",
            updatedAt: daysAgo(2),
            items: [
              { id: "item-glasses", name: "Reading glasses", note: "Black frame", quantity: 1, category: "Personal", colour: "#f08050", createdAt: daysAgo(10), updatedAt: daysAgo(2), createdBy: "Alex Morgan" },
              { id: "item-charger", name: "MagSafe charger", note: "White one metre cable", quantity: 1, category: "Tech", colour: "#397cff", createdAt: daysAgo(8), updatedAt: daysAgo(2), createdBy: "Alex Morgan" }
            ]
          }
        ]
      },
      {
        id: "room-office",
        name: "Office",
        icon: "monitor",
        createdAt: daysAgo(35),
        updatedAt: hoursAgo(8),
        createdBy: "Alex Morgan",
        locations: [
          {
            id: "loc-tech-box",
            name: "Tech box",
            kind: "box",
            updatedAt: hoursAgo(8),
            items: [
              { id: "item-receiver", name: "Logitech USB receiver", note: "For MX Master", quantity: 1, category: "Tech", colour: "#397cff", createdAt: daysAgo(5), updatedAt: hoursAgo(8), createdBy: "Taylor Morgan" },
              { id: "item-ssd", name: "Portable SSD", note: "Samsung T7, 1 TB", quantity: 1, category: "Storage", colour: "#24a46d", createdAt: daysAgo(15), updatedAt: daysAgo(3), createdBy: "Alex Morgan" }
            ]
          }
        ]
      },
      { id: "room-kitchen", name: "Kitchen", icon: "utensils", createdAt: daysAgo(30), updatedAt: daysAgo(3), createdBy: "Jamie Morgan", locations: [{ id: "loc-utility", name: "Utility drawer", kind: "drawer", updatedAt: daysAgo(3), items: [{ id: "item-batteries", name: "AA batteries", note: "Rechargeable", quantity: 8, category: "Utility", colour: "#e3a128", createdAt: daysAgo(9), updatedAt: daysAgo(3), createdBy: "Jamie Morgan" }] }] },
      { id: "room-garage", name: "Garage", icon: "warehouse", createdAt: daysAgo(25), updatedAt: daysAgo(6), createdBy: "Taylor Morgan", locations: [{ id: "loc-tools", name: "Tool cabinet", kind: "cabinet", updatedAt: daysAgo(6), items: [{ id: "item-driver", name: "Precision screwdriver set", note: "Blue case", quantity: 1, category: "Tools", colour: "#48617a", createdAt: daysAgo(14), updatedAt: daysAgo(6), createdBy: "Taylor Morgan" }] }] }
    ]
  },
  {
    id: "home-parents",
    name: "Parents' House",
    address: "Exampletown",
    role: "member",
    accent: "#5a58d6",
    createdAt: daysAgo(90),
    updatedAt: daysAgo(1),
    createdBy: "Jamie Morgan",
    memberIds: ["u-alex", "u-jamie"],
    rooms: [
      { id: "room-loft", name: "Loft", icon: "archive", createdAt: daysAgo(70), updatedAt: daysAgo(1), createdBy: "Jamie Morgan", locations: [{ id: "loc-keepsakes", name: "Keepsake boxes", kind: "box", updatedAt: daysAgo(1), items: [{ id: "item-albums", name: "Family photo albums", note: "1998 to 2010", quantity: 4, category: "Keepsakes", colour: "#bf6882", createdAt: daysAgo(30), updatedAt: daysAgo(1), createdBy: "Jamie Morgan" }] }] }
    ]
  }
];

export const events: AuditEvent[] = [
  { id: "evt-1", homeId: "home-family", actorId: "u-alex", actorName: "Alex Morgan", action: "added", detail: "USB-C to HDMI adapter to Bedroom · Desk drawers", timestamp: hoursAgo(0.4), entityType: "item" },
  { id: "evt-2", homeId: "home-family", actorId: "u-taylor", actorName: "Taylor Morgan", action: "updated", detail: "Logitech USB receiver in Office · Tech box", timestamp: hoursAgo(8), entityType: "item" },
  { id: "evt-3", homeId: "home-family", actorId: "u-jamie", actorName: "Jamie Morgan", action: "added", detail: "AA batteries to Kitchen · Utility drawer", timestamp: daysAgo(3), entityType: "item" },
  { id: "evt-4", homeId: "home-family", actorId: "u-alex", actorName: "Alex Morgan", action: "invited", detail: "Taylor Morgan to Family Home", timestamp: daysAgo(7), entityType: "member" }
];

export const initialState: AppState = { currentUser: people[0], people, homes, events };
