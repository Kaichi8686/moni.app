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

type State = {
  members: Member[];
  assignments: Assignments;
  warnings: AssignWarning[];
  tab: Tab;
  lastAssignedAt: string | null;
  placeError: string | null;
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
  setTab: (tab: Tab) => void;
  clearPlaceError: () => void;
  /** シフト割当だけ消す（メンバー名簿は絶対に消さない） */
  clearAssignmentsOnly: () => void;
};

export const useBunkasaiShiftStore = create<State>()(
  persist(
    (set, get) => ({
      // 初期は空。localStorage に保存済みの名簿があればそのまま復元される
      members: [],
      assignments: emptyAssignments(),
      warnings: [],
      tab: "members",
      lastAssignedAt: null,
      placeError: null,

      addMember: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          members: [...s.members, { id: uid(), name: trimmed, ngSlotIds: [] }],
        }));
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
      },

      renameMember: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, name: trimmed } : m)),
        }));
      },

      toggleNg: (memberId, slotId) => {
        set((s) => ({
          members: s.members.map((m) => {
            if (m.id !== memberId) return m;
            const has = m.ngSlotIds.includes(slotId);
            return {
              ...m,
              ngSlotIds: has
                ? m.ngSlotIds.filter((id) => id !== slotId)
                : [...m.ngSlotIds, slotId],
            };
          }),
        }));
      },

      setNg: (memberId, slotIds) => {
        set((s) => ({
          members: s.members.map((m) =>
            m.id === memberId ? { ...m, ngSlotIds: [...slotIds] } : m,
          ),
        }));
      },

      runAutoAssign: () => {
        const { members } = get();
        // 名簿は触らず、割当結果だけ更新
        const result = autoAssign(members);
        set({
          assignments: result.assignments,
          warnings: result.warnings,
          lastAssignedAt: new Date().toISOString(),
          tab: "assign",
          placeError: null,
        });
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
      },

      moveMember: (fromSlot, toSlot, memberId) => {
        if (fromSlot === toSlot) return true;
        const s = get();
        // 移動元から外した仮状態で連続判定
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
        return true;
      },

      clearAssignments: () => {
        set({
          assignments: emptyAssignments(),
          warnings: [],
          lastAssignedAt: null,
          placeError: null,
        });
      },

      clearAssignmentsOnly: () => {
        get().clearAssignments();
      },

      setTab: (tab) => set({ tab, placeError: null }),

      clearPlaceError: () => set({ placeError: null }),
    }),
    {
      // 名簿を長く保持するキー（サンプル初期化で上書きしない）
      name: "bunkasai-shift-mock-v1",
      partialize: (s) => ({
        members: s.members,
        assignments: s.assignments,
        warnings: s.warnings,
        lastAssignedAt: s.lastAssignedAt,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        // 保存済み名簿があれば必ずそれを使う（初期の空配列で消さない）
        return {
          ...current,
          ...p,
          members: Array.isArray(p.members) ? p.members : current.members,
          assignments: p.assignments ?? current.assignments,
          warnings: Array.isArray(p.warnings) ? p.warnings : current.warnings,
          lastAssignedAt: p.lastAssignedAt ?? current.lastAssignedAt,
        };
      },
    },
  ),
);
