import { reviewIdeaWithAi } from "@/lib/idea-league/aiReview";
import { promptForWeek } from "@/lib/idea-league/prompts";
import { saturdayWeekKey, leagueNow } from "@/lib/idea-league/calendar";
import type { LeagueAiReview } from "@/lib/idea-league/types";

export type FriendMatchMember = {
  userId: string;
  displayName: string;
  joinedAt: string;
  isHost: boolean;
  score: number;
  submission: {
    title: string;
    content: string;
    appeal: string | null;
    review: LeagueAiReview;
    submittedAt: string;
  } | null;
};

export type FriendMatchStatus = "lobby" | "playing" | "results";

export type FriendMatchRoom = {
  id: string;
  code: string;
  name: string;
  hostUserId: string;
  members: FriendMatchMember[];
  status: FriendMatchStatus;
  promptTitle: string;
  promptBody: string;
  round: number;
  createdAt: string;
  updatedAt: string;
};

type StoreShape = {
  rooms: Record<string, FriendMatchRoom>;
  byCode: Record<string, string>;
  activeByUser: Record<string, string>;
};

const STORAGE_KEY = "moni.friendMatch.v2";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function emptyStore(): StoreShape {
  return { rooms: {}, byCode: {}, activeByUser: {} };
}

function readStore(): StoreShape {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // one-time migrate from v1 lobby-only rooms
      const legacy = window.localStorage.getItem("moni.friendMatch.v1");
      if (!legacy) return emptyStore();
      const parsed = JSON.parse(legacy) as StoreShape;
      if (!parsed.rooms) return emptyStore();
      for (const room of Object.values(parsed.rooms)) {
        normalizeRoom(room);
      }
      writeStore(parsed);
      return parsed;
    }
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed.rooms || !parsed.byCode || !parsed.activeByUser) return emptyStore();
    for (const room of Object.values(parsed.rooms)) normalizeRoom(room);
    return parsed;
  } catch {
    return emptyStore();
  }
}

function normalizeRoom(room: FriendMatchRoom) {
  room.status ??= "lobby";
  room.round ??= 1;
  room.promptTitle ??= "";
  room.promptBody ??= "";
  for (const m of room.members) {
    m.score ??= 0;
    m.submission ??= null;
    m.isHost = m.userId === room.hostUserId;
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

function pickPrompt(seed: string) {
  return promptForWeek(seed || saturdayWeekKey(leagueNow()));
}

function getRoomOrThrow(store: StoreShape, roomId: string): FriendMatchRoom {
  const room = store.rooms[roomId];
  if (!room) throw new Error("ROOM_NOT_FOUND");
  normalizeRoom(room);
  return room;
}

export function getActiveFriendRoom(userId: string): FriendMatchRoom | null {
  const store = readStore();
  const roomId = store.activeByUser[userId];
  if (!roomId) return null;
  const room = store.rooms[roomId];
  if (!room) return null;
  normalizeRoom(room);
  return room;
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
  const prompt = pickPrompt(`${id}-1`);
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
        score: 0,
        submission: null,
      },
    ],
    status: "lobby",
    promptTitle: prompt.title,
    promptBody: prompt.body,
    round: 1,
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
  const room = getRoomOrThrow(store, roomId);

  const now = new Date().toISOString();
  const existing = room.members.find((m) => m.userId === input.userId);
  if (!existing) {
    if (room.members.length >= 8) throw new Error("ROOM_FULL");
    room.members.push({
      userId: input.userId,
      displayName: input.displayName.trim() || "Guest",
      joinedAt: now,
      isHost: false,
      score: 0,
      submission: null,
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
    normalizeRoom(room);
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

export function startFriendRound(input: { userId: string; roomId: string }): FriendMatchRoom {
  const store = readStore();
  const room = getRoomOrThrow(store, input.roomId);
  const me = room.members.find((m) => m.userId === input.userId);
  if (!me) throw new Error("NOT_IN_ROOM");
  if (room.hostUserId !== input.userId && room.members.length > 1) {
    throw new Error("HOST_ONLY");
  }

  const prompt = pickPrompt(`${room.id}-${room.round + (room.status === "results" ? 1 : 0)}`);
  if (room.status === "results") {
    room.round += 1;
  }
  room.promptTitle = prompt.title;
  room.promptBody = prompt.body;
  room.status = "playing";
  for (const m of room.members) {
    m.submission = null;
    // Keep cumulative score across rounds
  }
  room.updatedAt = new Date().toISOString();
  writeStore(store);
  return room;
}

export function submitFriendIdea(input: {
  userId: string;
  roomId: string;
  title: string;
  content: string;
  appeal?: string;
}): FriendMatchRoom {
  const title = input.title.trim().slice(0, 40);
  const content = input.content.trim();
  const appeal = input.appeal?.trim().slice(0, 140) || null;
  if (!title || !content) throw new Error("IDEA_REQUIRED");

  const store = readStore();
  const room = getRoomOrThrow(store, input.roomId);
  if (room.status === "lobby") {
    // Solo / first move: auto-start so creating a room is immediately playable
    room.status = "playing";
    if (!room.promptTitle) {
      const prompt = pickPrompt(`${room.id}-${room.round}`);
      room.promptTitle = prompt.title;
      room.promptBody = prompt.body;
    }
  }
  if (room.status !== "playing") throw new Error("NOT_PLAYING");

  const me = room.members.find((m) => m.userId === input.userId);
  if (!me) throw new Error("NOT_IN_ROOM");

  const review = reviewIdeaWithAi({ title, content, appeal });
  const prev = me.submission?.review.score ?? 0;
  me.score = Math.max(0, me.score - prev) + review.score;
  me.submission = {
    title,
    content,
    appeal,
    review,
    submittedAt: new Date().toISOString(),
  };
  room.updatedAt = new Date().toISOString();

  // When everyone submitted, flip to results
  if (room.members.every((m) => m.submission)) {
    room.status = "results";
  }

  writeStore(store);
  return room;
}

export function finishFriendRound(input: { userId: string; roomId: string }): FriendMatchRoom {
  const store = readStore();
  const room = getRoomOrThrow(store, input.roomId);
  const me = room.members.find((m) => m.userId === input.userId);
  if (!me) throw new Error("NOT_IN_ROOM");
  if (room.hostUserId !== input.userId && room.members.length > 1) {
    throw new Error("HOST_ONLY");
  }
  room.status = "results";
  room.updatedAt = new Date().toISOString();
  writeStore(store);
  return room;
}

export function rankedFriendMembers(room: FriendMatchRoom): FriendMatchMember[] {
  return [...room.members].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.joinedAt.localeCompare(b.joinedAt);
  });
}
