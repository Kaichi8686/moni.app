export type FriendMatchMember = {
  userId: string;
  displayName: string;
  joinedAt: string;
  isHost: boolean;
};

export type FriendMatchRoom = {
  id: string;
  code: string;
  name: string;
  hostUserId: string;
  members: FriendMatchMember[];
  createdAt: string;
  updatedAt: string;
};

type StoreShape = {
  rooms: Record<string, FriendMatchRoom>;
  /** code (upper) → room id */
  byCode: Record<string, string>;
  /** userId → active room id */
  activeByUser: Record<string, string>;
};

const STORAGE_KEY = "moni.friendMatch.v1";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function emptyStore(): StoreShape {
  return { rooms: {}, byCode: {}, activeByUser: {} };
}

function readStore(): StoreShape {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed.rooms || !parsed.byCode || !parsed.activeByUser) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoreShape): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeInviteCode(store: StoreShape): string {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]!;
    }
    if (!store.byCode[code]) return code;
  }
  return `M${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

export function getActiveFriendRoom(userId: string): FriendMatchRoom | null {
  const store = readStore();
  const roomId = store.activeByUser[userId];
  if (!roomId) return null;
  return store.rooms[roomId] ?? null;
}

export function createFriendRoom(input: {
  userId: string;
  displayName: string;
  name: string;
}): FriendMatchRoom {
  const name = input.name.trim().slice(0, 40);
  if (!name) throw new Error("ROOM_NAME_REQUIRED");

  const store = readStore();
  const now = new Date().toISOString();
  const code = makeInviteCode(store);
  const id = makeId("fr");
  const room: FriendMatchRoom = {
    id,
    code,
    name,
    hostUserId: input.userId,
    members: [
      {
        userId: input.userId,
        displayName: input.displayName.trim() || "Host",
        joinedAt: now,
        isHost: true,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  store.rooms[id] = room;
  store.byCode[code] = id;
  store.activeByUser[input.userId] = id;
  writeStore(store);
  return room;
}

export function joinFriendRoom(input: {
  userId: string;
  displayName: string;
  code: string;
}): FriendMatchRoom {
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (code.length < 4) throw new Error("CODE_INVALID");

  const store = readStore();
  const roomId = store.byCode[code];
  if (!roomId) throw new Error("ROOM_NOT_FOUND");
  const room = store.rooms[roomId];
  if (!room) throw new Error("ROOM_NOT_FOUND");

  const now = new Date().toISOString();
  const existing = room.members.find((m) => m.userId === input.userId);
  if (!existing) {
    if (room.members.length >= 8) throw new Error("ROOM_FULL");
    room.members.push({
      userId: input.userId,
      displayName: input.displayName.trim() || "Guest",
      joinedAt: now,
      isHost: false,
    });
  } else {
    existing.displayName = input.displayName.trim() || existing.displayName;
  }
  room.updatedAt = now;
  store.activeByUser[input.userId] = room.id;
  writeStore(store);
  return room;
}

export function leaveFriendRoom(userId: string): void {
  const store = readStore();
  const roomId = store.activeByUser[userId];
  if (!roomId) return;
  const room = store.rooms[roomId];
  if (room) {
    room.members = room.members.filter((m) => m.userId !== userId);
    room.updatedAt = new Date().toISOString();
    if (room.members.length === 0) {
      delete store.rooms[roomId];
      delete store.byCode[room.code];
    } else if (room.hostUserId === userId) {
      const nextHost = room.members[0]!;
      room.hostUserId = nextHost.userId;
      nextHost.isHost = true;
    }
  }
  delete store.activeByUser[userId];
  writeStore(store);
}

export function refreshFriendRoom(roomId: string): FriendMatchRoom | null {
  const store = readStore();
  return store.rooms[roomId] ?? null;
}
