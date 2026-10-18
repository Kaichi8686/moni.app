"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { autoAssign } from "./assign";
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
  addMember: (name: string) => void;
  removeMember: (id: string) => void;
  renameMember: (id: string, name: string) => void;
  toggleNg: (memberId: string, slotId: SlotId) => void;
  setNg: (memberId: string, slotIds: SlotId[]) => void;
  runAutoAssign: () => void;
  addToSlot: (slotId: SlotId, memberId: string) => void;
  removeFromSlot: (slotId: SlotId, memberId: string) => void;
  moveMember: (fromSlot: SlotId, toSlot: SlotId, memberId: string) => void;
  clearAssignments: () => void;
  setTab: (tab: Tab) => void;
  resetAll: () => void;
};

const SAMPLE_NAMES = [
  "あかり",
  "いずみ",
  "うえだ",
  "えりか",
  "おおはら",
  "かな",
  "きたむら",
  "くどう",
  "けんと",
  "こばやし",
  "さいとう",
  "しおん",
  "すがわら",
  "せりな",
  "たかはし",
  "ちひろ",
  "つじ",
  "てらだ",
  "とうま",
  "なお",
  "にしだ",
  "ぬま",
  "ねもと",
  "のぐち",
  "はっとり",
  "ひなた",
  "ふじわら",
];

function sampleMembers(): Member[] {
  return SAMPLE_NAMES.map((name) => ({
    id: uid(),
    name,
    ngSlotIds: [],
  }));
}

export const useBunkasaiShiftStore = create<State>()(
  persist(
    (set, get) => ({
      members: sampleMembers(),
      assignments: emptyAssignments(),
      warnings: [],
      tab: "members",
      lastAssignedAt: null,

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
        const result = autoAssign(members);
        set({
          assignments: result.assignments,
          warnings: result.warnings,
          lastAssignedAt: new Date().toISOString(),
          tab: "assign",
        });
      },

      addToSlot: (slotId, memberId) => {
        set((s) => {
          const member = s.members.find((m) => m.id === memberId);
          if (!member) return s;
          if (member.ngSlotIds.includes(slotId)) return s;
          const current = s.assignments[slotId];
          if (current.includes(memberId)) return s;
          return {
            assignments: {
              ...s.assignments,
              [slotId]: [...current, memberId],
            },
            warnings: s.warnings.filter((w) => w.slotId !== slotId),
          };
        });
      },

      removeFromSlot: (slotId, memberId) => {
        set((s) => ({
          assignments: {
            ...s.assignments,
            [slotId]: s.assignments[slotId].filter((id) => id !== memberId),
          },
        }));
      },

      moveMember: (fromSlot, toSlot, memberId) => {
        if (fromSlot === toSlot) return;
        const { addToSlot, removeFromSlot, members } = get();
        const member = members.find((m) => m.id === memberId);
        if (!member || member.ngSlotIds.includes(toSlot)) return;
        removeFromSlot(fromSlot, memberId);
        addToSlot(toSlot, memberId);
      },

      clearAssignments: () => {
        set({ assignments: emptyAssignments(), warnings: [], lastAssignedAt: null });
      },

      setTab: (tab) => set({ tab }),

      resetAll: () => {
        set({
          members: sampleMembers(),
          assignments: emptyAssignments(),
          warnings: [],
          lastAssignedAt: null,
          tab: "members",
        });
      },
    }),
    {
      name: "bunkasai-shift-mock-v1",
      partialize: (s) => ({
        members: s.members,
        assignments: s.assignments,
        warnings: s.warnings,
        lastAssignedAt: s.lastAssignedAt,
      }),
    },
  ),
);
