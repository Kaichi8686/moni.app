"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { autoAssign, canPlaceInSlot, unitForMember } from "./assign";
import { emptyAssignments } from "./schedule";
import type {
  AssignWarning,
  Assignments,
  Member,
  MemberPair,
  SlotId,
} from "./types";

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type Tab = "members" | "assign" | "export";

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error";

type SnapshotFields = {
  members: Member[];
  assignments: Assignments;
  warnings: AssignWarning[];
  lastAssignedAt: string | null;
  coreMemberIds: string[];
  pairs: MemberPair[];
  serverUpdatedAt?: string | null;
};

type State = {
  room: string;
  members: Member[];
  assignments: Assignments;
  warnings: AssignWarning[];
  coreMemberIds: string[];
  pairs: MemberPair[];
  tab: Tab;
  lastAssignedAt: string | null;
  placeError: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  serverUpdatedAt: string | null;
  hydratedFromServer: boolean;

  addMember: (name: string) => void;
  removeMember: (id: string) => void;
  renameMember: (id: string, name: string) => void;
  toggleNg: (memberId: string, slotId: SlotId) => void;
  toggleCore: (memberId: string) => void;
  addPair: (a: string, b: string) => void;
  removePair: (pairId: string) => void;
  runAutoAssign: () => void;
  addToSlot: (slotId: SlotId, memberId: string) => boolean;
  removeFromSlot: (slotId: SlotId, memberId: string) => void;
  moveMember: (fromSlot: SlotId, toSlot: SlotId, memberId: string) => boolean;
  clearAssignments: () => void;
  clearAssignmentsOnly: () => void;
  setTab: (tab: Tab) => void;
  clearPlaceError: () => void;
  replaceSnapshot: (snap: SnapshotFields) => void;
  setSyncStatus: (status: SyncStatus, error?: string | null) => void;
  markHydratedFromServer: () => void;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveSeq = 0;

async function pushToServer(): Promise<void> {
  const s = useBunkasaiShiftStore.getState();
  const seq = ++saveSeq;
  s.setSyncStatus("saving");
  try {
    const res = await fetch(`/api/bunkasai-shift?room=${encodeURIComponent(s.room)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: s.room,
        members: s.members,
        assignments: s.assignments,
        warnings: s.warnings,
        lastAssignedAt: s.lastAssignedAt,
        coreMemberIds: s.coreMemberIds,
        pairs: s.pairs,
      }),
    });
    const data = await res.json();
    if (seq !== saveSeq) return;
    if (!res.ok || !data.ok) {
      s.setSyncStatus("error", data.error || "サーバー保存に失敗しました");
      return;
    }
    // サーバーが名簿を守った結果を反映（空上書き防止後の正式データ）
    const snap = data.snapshot as SnapshotFields & { updatedAt: string };
    if (Array.isArray(snap.members) && snap.members.length > 0) {
      useBunkasaiShiftStore.setState({
        members: snap.members,
        coreMemberIds: snap.coreMemberIds ?? s.coreMemberIds,
        pairs: snap.pairs ?? s.pairs,
        syncStatus: "saved",
        syncError: null,
        serverUpdatedAt: snap.updatedAt,
      });
    } else {
      useBunkasaiShiftStore.setState({
        syncStatus: "saved",
        syncError: null,
        serverUpdatedAt: snap.updatedAt,
      });
    }
  } catch {
    if (seq !== saveSeq) return;
    s.setSyncStatus("error", "通信に失敗しました（名簿は端末にも残しています）");
  }
}

export function scheduleServerSave(delayMs = 350): void {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void pushToServer();
  }, delayMs);
}

function assignOpts(s: State) {
  return { coreMemberIds: s.coreMemberIds, pairs: s.pairs };
}

export const useBunkasaiShiftStore = create<State>()(
  persist(
    (set, get) => ({
      room: "main",
      members: [],
      assignments: emptyAssignments(),
      warnings: [],
      coreMemberIds: [],
      pairs: [],
      tab: "members",
      lastAssignedAt: null,
      placeError: null,
      syncStatus: "idle",
      syncError: null,
      serverUpdatedAt: null,
      hydratedFromServer: false,

      addMember: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          members: [...s.members, { id: uid(), name: trimmed, ngSlotIds: [] }],
        }));
        scheduleServerSave();
      },

      removeMember: (id) => {
        set((s) => {
          const next = emptyAssignments();
          for (const [slotId, ids] of Object.entries(s.assignments) as [SlotId, string[]][]) {
            next[slotId] = ids.filter((mid) => mid !== id);
          }
          return {
            members: s.members.filter((m) => m.id !== id),
            assignments: next,
            coreMemberIds: s.coreMemberIds.filter((x) => x !== id),
            pairs: s.pairs.filter((p) => !p.memberIds.includes(id)),
          };
        });
        scheduleServerSave();
      },

      renameMember: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, name: trimmed } : m)),
        }));
        scheduleServerSave();
      },

      toggleNg: (memberId, slotId) => {
        set((s) => ({
          members: s.members.map((m) => {
            if (m.id !== memberId) return m;
            const has = m.ngSlotIds.includes(slotId);
            return {
              ...m,
              ngSlotIds: has
                ? m.ngSlotIds.filter((x) => x !== slotId)
                : [...m.ngSlotIds, slotId],
            };
          }),
        }));
        scheduleServerSave();
      },

      toggleCore: (memberId) => {
        set((s) => {
          const has = s.coreMemberIds.includes(memberId);
          return {
            coreMemberIds: has
              ? s.coreMemberIds.filter((id) => id !== memberId)
              : [...s.coreMemberIds, memberId],
          };
        });
        scheduleServerSave();
      },

      addPair: (a, b) => {
        if (!a || !b || a === b) return;
        set((s) => {
          if (s.pairs.some((p) => p.memberIds.includes(a) || p.memberIds.includes(b))) {
            return { placeError: "すでにペアに含まれているメンバーです" };
          }
          if (!s.members.some((m) => m.id === a) || !s.members.some((m) => m.id === b)) {
            return s;
          }
          return {
            pairs: [
              ...s.pairs,
              { id: uid(), memberIds: [a, b] as [string, string] },
            ],
            placeError: null,
          };
        });
        scheduleServerSave();
      },

      removePair: (pairId) => {
        set((s) => ({ pairs: s.pairs.filter((p) => p.id !== pairId) }));
        scheduleServerSave();
      },

      runAutoAssign: () => {
        const s = get();
        const result = autoAssign(s.members, Date.now(), assignOpts(s));
        set({
          assignments: result.assignments,
          warnings: result.warnings,
          lastAssignedAt: new Date().toISOString(),
          tab: "assign",
          placeError: null,
        });
        scheduleServerSave(100);
      },

      addToSlot: (slotId, memberId) => {
        const s = get();
        const opts = assignOpts(s);
        const check = canPlaceInSlot(s.members, s.assignments, slotId, memberId, opts);
        if (!check.ok) {
          set({ placeError: check.reason });
          return false;
        }
        const unit = unitForMember(memberId, s.pairs);
        const nextIds = [...s.assignments[slotId]];
        for (const id of unit) {
          if (!nextIds.includes(id)) nextIds.push(id);
        }
        set({
          assignments: { ...s.assignments, [slotId]: nextIds },
          warnings: s.warnings.filter((w) => w.slotId !== slotId),
          placeError: null,
        });
        scheduleServerSave();
        return true;
      },

      removeFromSlot: (slotId, memberId) => {
        const s = get();
        const unit = new Set(unitForMember(memberId, s.pairs));
        set({
          assignments: {
            ...s.assignments,
            [slotId]: s.assignments[slotId].filter((id) => !unit.has(id)),
          },
          placeError: null,
        });
        scheduleServerSave();
      },

      moveMember: (fromSlot, toSlot, memberId) => {
        if (fromSlot === toSlot) return true;
        const s = get();
        const unit = unitForMember(memberId, s.pairs);
        const unitSet = new Set(unit);
        const provisional: Assignments = {
          ...s.assignments,
          [fromSlot]: s.assignments[fromSlot].filter((id) => !unitSet.has(id)),
        };
        const check = canPlaceInSlot(s.members, provisional, toSlot, memberId, assignOpts(s));
        if (!check.ok) {
          set({ placeError: check.reason });
          return false;
        }
        const nextTo = [...provisional[toSlot]];
        for (const id of unit) {
          if (!nextTo.includes(id)) nextTo.push(id);
        }
        set({
          assignments: { ...provisional, [toSlot]: nextTo },
          placeError: null,
        });
        scheduleServerSave();
        return true;
      },

      clearAssignments: () => {
        set({
          assignments: emptyAssignments(),
          warnings: [],
          lastAssignedAt: null,
          placeError: null,
        });
        scheduleServerSave();
      },

      clearAssignmentsOnly: () => {
        get().clearAssignments();
      },

      setTab: (tab) => set({ tab, placeError: null }),

      clearPlaceError: () => set({ placeError: null }),

      replaceSnapshot: (snap) => {
        set((s) => {
          // 空名簿で既存名簿を潰さない
          const members =
            Array.isArray(snap.members) && snap.members.length > 0
              ? snap.members
              : s.members;
          const memberIds = new Set(members.map((m) => m.id));
          return {
            members,
            assignments: snap.assignments ?? s.assignments,
            warnings: snap.warnings ?? s.warnings,
            lastAssignedAt: snap.lastAssignedAt ?? s.lastAssignedAt,
            coreMemberIds: (snap.coreMemberIds ?? s.coreMemberIds).filter((id) =>
              memberIds.has(id),
            ),
            pairs: (snap.pairs ?? s.pairs).filter(
              (p) => memberIds.has(p.memberIds[0]) && memberIds.has(p.memberIds[1]),
            ),
            serverUpdatedAt: snap.serverUpdatedAt ?? s.serverUpdatedAt,
            placeError: null,
          };
        });
      },

      setSyncStatus: (status, error = null) => {
        set({ syncStatus: status, syncError: error });
      },

      markHydratedFromServer: () => set({ hydratedFromServer: true }),
    }),
    {
      name: "bunkasai-shift-mock-v2",
      partialize: (s) => ({
        room: s.room,
        members: s.members,
        assignments: s.assignments,
        warnings: s.warnings,
        lastAssignedAt: s.lastAssignedAt,
        serverUpdatedAt: s.serverUpdatedAt,
        coreMemberIds: s.coreMemberIds,
        pairs: s.pairs,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const members =
          Array.isArray(p.members) && p.members.length > 0 ? p.members : current.members;
        return {
          ...current,
          ...p,
          members,
          assignments: p.assignments ?? current.assignments,
          warnings: Array.isArray(p.warnings) ? p.warnings : current.warnings,
          lastAssignedAt: p.lastAssignedAt ?? current.lastAssignedAt,
          room: typeof p.room === "string" && p.room ? p.room : current.room,
          coreMemberIds: Array.isArray(p.coreMemberIds)
            ? p.coreMemberIds
            : current.coreMemberIds,
          pairs: Array.isArray(p.pairs) ? p.pairs : current.pairs,
        };
      },
    },
  ),
);

export function readLegacyLocalMembers(): Member[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("bunkasai-shift-mock-v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { members?: Member[] } };
    const members = parsed.state?.members;
    return Array.isArray(members) && members.length > 0 ? members : null;
  } catch {
    return null;
  }
}

export async function hydrateFromServer(): Promise<void> {
  const store = useBunkasaiShiftStore.getState();
  store.setSyncStatus("loading");
  try {
    const res = await fetch(`/api/bunkasai-shift?room=${encodeURIComponent(store.room)}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      store.setSyncStatus("error", data.error || "読み込み失敗");
      store.markHydratedFromServer();
      return;
    }

    const server = data.snapshot as SnapshotFields & { updatedAt: string };
    const local = useBunkasaiShiftStore.getState();
    const legacy = readLegacyLocalMembers();

    let bestMembers = server.members ?? [];
    let from: "server" | "local" | "legacy" = "server";

    if (local.members.length > bestMembers.length) {
      bestMembers = local.members;
      from = "local";
    }
    if (legacy && legacy.length > bestMembers.length) {
      bestMembers = legacy;
      from = "legacy";
    }

    // 同人数ならサーバー優先（トンネル切替後の正本）
    if (from === "local" && server.members.length === local.members.length && server.members.length > 0) {
      bestMembers = server.members;
      from = "server";
    }

    store.replaceSnapshot({
      members: bestMembers,
      assignments:
        from === "server"
          ? server.assignments
          : from === "local"
            ? local.assignments
            : emptyAssignments(),
      warnings:
        from === "server" ? server.warnings : from === "local" ? local.warnings : [],
      lastAssignedAt:
        from === "server"
          ? server.lastAssignedAt
          : from === "local"
            ? local.lastAssignedAt
            : null,
      coreMemberIds:
        from === "server"
          ? server.coreMemberIds ?? []
          : from === "local"
            ? local.coreMemberIds
            : [],
      pairs:
        from === "server" ? server.pairs ?? [] : from === "local" ? local.pairs : [],
      serverUpdatedAt: server.updatedAt,
    });

    if (server.members.length === 0 && bestMembers.length > 0) {
      scheduleServerSave(0);
    } else if (from !== "server" && bestMembers.length > server.members.length) {
      scheduleServerSave(0);
    } else {
      store.setSyncStatus("saved");
    }

    store.markHydratedFromServer();
  } catch {
    store.setSyncStatus("error", "サーバーに接続できませんでした（端末の名簿は残しています）");
    store.markHydratedFromServer();
  }
}
