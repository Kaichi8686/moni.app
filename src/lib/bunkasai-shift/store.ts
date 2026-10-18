"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { autoAssign, canPlaceInSlot } from "./assign";
import { emptyAssignments } from "./schedule";
import type { AssignWarning, Assignments, Member, SlotId } from "./types";

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type Tab = "members" | "assign" | "export";

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error";

type State = {
  room: string;
  members: Member[];
  assignments: Assignments;
  warnings: AssignWarning[];
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
  setNg: (memberId: string, slotIds: SlotId[]) => void;
  runAutoAssign: () => void;
  addToSlot: (slotId: SlotId, memberId: string) => boolean;
  removeFromSlot: (slotId: SlotId, memberId: string) => void;
  moveMember: (fromSlot: SlotId, toSlot: SlotId, memberId: string) => boolean;
  clearAssignments: () => void;
  clearAssignmentsOnly: () => void;
  setTab: (tab: Tab) => void;
  clearPlaceError: () => void;
  replaceSnapshot: (snap: {
    members: Member[];
    assignments: Assignments;
    warnings: AssignWarning[];
    lastAssignedAt: string | null;
    serverUpdatedAt?: string | null;
  }) => void;
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
      }),
    });
    const data = await res.json();
    if (seq !== saveSeq) return;
    if (!res.ok || !data.ok) {
      s.setSyncStatus("error", data.error || "サーバー保存に失敗しました");
      return;
    }
    useBunkasaiShiftStore.setState({
      syncStatus: "saved",
      syncError: null,
      serverUpdatedAt: data.snapshot.updatedAt,
    });
  } catch {
    if (seq !== saveSeq) return;
    s.setSyncStatus("error", "通信に失敗しました（名簿は端末にも残しています）");
  }
}

/** 変更のたびサーバーへ保存（トンネルURLが変わっても残す） */
export function scheduleServerSave(delayMs = 350): void {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void pushToServer();
  }, delayMs);
}

export const useBunkasaiShiftStore = create<State>()(
  persist(
    (set, get) => ({
      room: "main",
      members: [],
      assignments: emptyAssignments(),
      warnings: [],
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

      setNg: (memberId, slotIds) => {
        set((s) => ({
          members: s.members.map((m) =>
            m.id === memberId ? { ...m, ngSlotIds: [...slotIds] } : m,
          ),
        }));
        scheduleServerSave();
      },

      runAutoAssign: () => {
        const { members } = get();
        const result = autoAssign(members);
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
        const check = canPlaceInSlot(s.members, s.assignments, slotId, memberId);
        if (!check.ok) {
          set({ placeError: check.reason });
          return false;
        }
        set({
          assignments: {
            ...s.assignments,
            [slotId]: [...s.assignments[slotId], memberId],
          },
          warnings: s.warnings.filter((w) => w.slotId !== slotId),
          placeError: null,
        });
        scheduleServerSave();
        return true;
      },

      removeFromSlot: (slotId, memberId) => {
        set((s) => ({
          assignments: {
            ...s.assignments,
            [slotId]: s.assignments[slotId].filter((id) => id !== memberId),
          },
          placeError: null,
        }));
        scheduleServerSave();
      },

      moveMember: (fromSlot, toSlot, memberId) => {
        if (fromSlot === toSlot) return true;
        const s = get();
        const provisional: Assignments = {
          ...s.assignments,
          [fromSlot]: s.assignments[fromSlot].filter((id) => id !== memberId),
        };
        const check = canPlaceInSlot(s.members, provisional, toSlot, memberId);
        if (!check.ok) {
          set({ placeError: check.reason });
          return false;
        }
        set({
          assignments: {
            ...provisional,
            [toSlot]: [...provisional[toSlot], memberId],
          },
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
        set({
          members: snap.members,
          assignments: snap.assignments,
          warnings: snap.warnings,
          lastAssignedAt: snap.lastAssignedAt,
          serverUpdatedAt: snap.serverUpdatedAt ?? null,
          placeError: null,
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
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const members = Array.isArray(p.members) ? p.members : current.members;
        return {
          ...current,
          ...p,
          members,
          // 名簿があるローカル状態を空で潰さない
          assignments: p.assignments ?? current.assignments,
          warnings: Array.isArray(p.warnings) ? p.warnings : current.warnings,
          lastAssignedAt: p.lastAssignedAt ?? current.lastAssignedAt,
          room: typeof p.room === "string" && p.room ? p.room : current.room,
        };
      },
    },
  ),
);

/** 旧キーからも名簿を拾う（バージョン移行） */
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

    const server = data.snapshot as {
      members: Member[];
      assignments: Assignments;
      warnings: AssignWarning[];
      lastAssignedAt: string | null;
      updatedAt: string;
    };

    const local = useBunkasaiShiftStore.getState();
    const legacy = readLegacyLocalMembers();

    // 多い方・新しい方を優先（トンネル切替で空画面になるのを防ぐ）
    let bestMembers = server.members;
    let bestAssignments = server.assignments;
    let bestWarnings = server.warnings;
    let bestLast = server.lastAssignedAt;
    let from = "server";

    if (local.members.length > bestMembers.length) {
      bestMembers = local.members;
      bestAssignments = local.assignments;
      bestWarnings = local.warnings;
      bestLast = local.lastAssignedAt;
      from = "local";
    }
    if (legacy && legacy.length > bestMembers.length) {
      bestMembers = legacy;
      from = "legacy";
    }

    store.replaceSnapshot({
      members: bestMembers,
      assignments: from === "local" ? bestAssignments : from === "server" ? server.assignments : emptyAssignments(),
      warnings: from === "local" ? bestWarnings : from === "server" ? server.warnings : [],
      lastAssignedAt: from === "local" ? bestLast : from === "server" ? server.lastAssignedAt : null,
      serverUpdatedAt: server.updatedAt,
    });

    // サーバーが空で端末に名簿があるなら即アップロード
    if (server.members.length === 0 && bestMembers.length > 0) {
      scheduleServerSave(0);
    } else if (from !== "server" && bestMembers.length >= server.members.length) {
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
