"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  autoAssign,
  canPlaceInSlot,
  dependentsOf,
  requiredUnit,
} from "./assign";
import { emptyAssignments } from "./schedule";
import type {
  AssignWarning,
  Assignments,
  Member,
  MemberDependency,
  SlotId,
} from "./types";
import {
  DEFAULT_MAX_SHIFTS,
  clampMaxShifts,
  normalizeMember,
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
  dependencies: MemberDependency[];
  serverUpdatedAt?: string | null;
};

type State = {
  room: string;
  members: Member[];
  assignments: Assignments;
  warnings: AssignWarning[];
  coreMemberIds: string[];
  dependencies: MemberDependency[];
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
  setMaxShifts: (id: string, maxShifts: number) => void;
  setAllMaxShifts: (maxShifts: number) => void;
  toggleNg: (memberId: string, slotId: SlotId) => void;
  toggleMust: (memberId: string, slotId: SlotId) => void;
  toggleCore: (memberId: string) => void;
  /** who には required がいないとダメ */
  addDependency: (who: string, required: string) => void;
  removeDependency: (depId: string) => void;
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
        dependencies: s.dependencies,
      }),
    });
    const data = await res.json();
    if (seq !== saveSeq) return;
    if (!res.ok || !data.ok) {
      s.setSyncStatus("error", data.error || "サーバー保存に失敗しました");
      return;
    }
    const snap = data.snapshot as SnapshotFields & { updatedAt: string };
    if (Array.isArray(snap.members) && snap.members.length > 0) {
      useBunkasaiShiftStore.setState({
        members: snap.members.map((m) => normalizeMember(m)),
        coreMemberIds: snap.coreMemberIds ?? s.coreMemberIds,
        dependencies: snap.dependencies ?? s.dependencies,
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
  return { coreMemberIds: s.coreMemberIds, dependencies: s.dependencies };
}

export const useBunkasaiShiftStore = create<State>()(
  persist(
    (set, get) => ({
      room: "main",
      members: [],
      assignments: emptyAssignments(),
      warnings: [],
      coreMemberIds: [],
      dependencies: [],
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
          members: [
            ...s.members,
            normalizeMember({
              id: uid(),
              name: trimmed,
              ngSlotIds: [],
              mustSlotIds: [],
              maxShifts: DEFAULT_MAX_SHIFTS,
            }),
          ],
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
            dependencies: s.dependencies.filter(
              (d) => d.memberId !== id && d.requiresId !== id,
            ),
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

      setMaxShifts: (id, maxShifts) => {
        const next = clampMaxShifts(maxShifts);
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, maxShifts: next } : m)),
        }));
        scheduleServerSave();
      },

      setAllMaxShifts: (maxShifts) => {
        const next = clampMaxShifts(maxShifts);
        set((s) => ({
          members: s.members.map((m) => ({ ...m, maxShifts: next })),
        }));
        scheduleServerSave();
      },

      toggleNg: (memberId, slotId) => {
        set((s) => ({
          members: s.members.map((m) => {
            if (m.id !== memberId) return m;
            const has = m.ngSlotIds.includes(slotId);
            if (has) {
              return { ...m, ngSlotIds: m.ngSlotIds.filter((x) => x !== slotId) };
            }
            return normalizeMember({
              ...m,
              ngSlotIds: [...m.ngSlotIds, slotId],
              // 必須と両立しないので外す
              mustSlotIds: m.mustSlotIds.filter((x) => x !== slotId),
            });
          }),
        }));
        scheduleServerSave();
      },

      toggleMust: (memberId, slotId) => {
        set((s) => ({
          members: s.members.map((m) => {
            if (m.id !== memberId) return m;
            const has = m.mustSlotIds.includes(slotId);
            if (has) {
              return { ...m, mustSlotIds: m.mustSlotIds.filter((x) => x !== slotId) };
            }
            return normalizeMember({
              ...m,
              mustSlotIds: [...m.mustSlotIds, slotId],
              ngSlotIds: m.ngSlotIds.filter((x) => x !== slotId),
            });
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

      addDependency: (who, required) => {
        if (!who || !required || who === required) return;
        set((s) => {
          if (!s.members.some((m) => m.id === who) || !s.members.some((m) => m.id === required)) {
            return s;
          }
          if (s.dependencies.some((d) => d.memberId === who)) {
            return {
              placeError: "その人にはすでに「いないとダメな人」が設定されています",
            };
          }
          return {
            dependencies: [
              ...s.dependencies,
              { id: uid(), memberId: who, requiresId: required },
            ],
            placeError: null,
          };
        });
        scheduleServerSave();
      },

      removeDependency: (depId) => {
        set((s) => ({ dependencies: s.dependencies.filter((d) => d.id !== depId) }));
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
        const unit = requiredUnit(memberId, s.dependencies);
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
        const member = s.members.find((m) => m.id === memberId);
        if (member?.mustSlotIds.includes(slotId)) {
          set({
            placeError: `${member.name} はこの時間帯が「必ず入る」設定のため外せません`,
          });
          return;
        }
        // 本人 + この人を必要としている人も外す（必須の人は外さない）
        const removeIds = new Set<string>([
          memberId,
          ...dependentsOf(memberId, s.dependencies),
        ]);
        for (const id of [...removeIds]) {
          const m = s.members.find((x) => x.id === id);
          if (m?.mustSlotIds.includes(slotId)) removeIds.delete(id);
        }
        set({
          assignments: {
            ...s.assignments,
            [slotId]: s.assignments[slotId].filter((id) => !removeIds.has(id)),
          },
          placeError: null,
        });
        scheduleServerSave();
      },

      moveMember: (fromSlot, toSlot, memberId) => {
        if (fromSlot === toSlot) return true;
        const s = get();
        const member = s.members.find((m) => m.id === memberId);
        if (member?.mustSlotIds.includes(fromSlot)) {
          set({
            placeError: `${member.name} はこの時間帯が「必ず入る」設定のため移動できません`,
          });
          return false;
        }
        const unit = requiredUnit(memberId, s.dependencies);
        const alsoRemove = new Set<string>([
          ...unit,
          ...dependentsOf(memberId, s.dependencies),
        ]);
        const provisional: Assignments = {
          ...s.assignments,
          [fromSlot]: s.assignments[fromSlot].filter((id) => !alsoRemove.has(id)),
        };
        const check = canPlaceInSlot(
          s.members,
          provisional,
          toSlot,
          memberId,
          assignOpts(s),
        );
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
          const raw =
            Array.isArray(snap.members) && snap.members.length > 0
              ? snap.members
              : s.members;
          const members = raw.map((m) =>
            normalizeMember({
              id: m.id,
              name: m.name,
              ngSlotIds: m.ngSlotIds,
              mustSlotIds: m.mustSlotIds,
              maxShifts: m.maxShifts,
            }),
          );
          const memberIds = new Set(members.map((m) => m.id));
          return {
            members,
            assignments: snap.assignments ?? s.assignments,
            warnings: snap.warnings ?? s.warnings,
            lastAssignedAt: snap.lastAssignedAt ?? s.lastAssignedAt,
            coreMemberIds: (snap.coreMemberIds ?? s.coreMemberIds).filter((id) =>
              memberIds.has(id),
            ),
            dependencies: (snap.dependencies ?? s.dependencies).filter(
              (d) => memberIds.has(d.memberId) && memberIds.has(d.requiresId),
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
        dependencies: s.dependencies,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State> & {
          pairs?: { id: string; memberIds: [string, string] }[];
        };
        const members = (
          Array.isArray(p.members) && p.members.length > 0 ? p.members : current.members
        ).map((m) => normalizeMember(m));
        let dependencies = Array.isArray(p.dependencies)
          ? p.dependencies
          : current.dependencies;
        if ((!dependencies || dependencies.length === 0) && Array.isArray(p.pairs)) {
          dependencies = p.pairs.map((pair) => ({
            id: pair.id,
            memberId: pair.memberIds[0],
            requiresId: pair.memberIds[1],
          }));
        }
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
          dependencies,
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

function memberSettingsScore(members: Member[]): number {
  let score = 0;
  for (const m of members) {
    score += (m.ngSlotIds?.length ?? 0) * 3;
    score += (m.mustSlotIds?.length ?? 0) * 4;
  }
  return score;
}

function mergeMemberLists(primary: Member[], secondary: Member[]): Member[] {
  const byId = new Map(secondary.map((m) => [m.id, m]));
  const byName = new Map(secondary.map((m) => [m.name.trim(), m]));
  return primary.map((raw) => {
    const base = normalizeMember(raw);
    const other = byId.get(base.id) ?? byName.get(base.name);
    if (!other) return base;
    const o = normalizeMember(other);
    return normalizeMember({
      ...base,
      ngSlotIds: base.ngSlotIds.length >= o.ngSlotIds.length ? base.ngSlotIds : o.ngSlotIds,
      mustSlotIds:
        base.mustSlotIds.length >= o.mustSlotIds.length ? base.mustSlotIds : o.mustSlotIds,
      maxShifts: base.maxShifts ?? o.maxShifts,
    });
  });
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

    const serverMembers = (server.members ?? []).map((m) => normalizeMember(m));
    const localMembers = local.members.map((m) => normalizeMember(m));
    const legacyMembers = (legacy ?? []).map((m) => normalizeMember(m));

    let bestMembers = serverMembers;
    let from: "server" | "local" | "legacy" = "server";

    // 人数が多い方を優先。同数なら NG/必須が多い方（端末の空設定で消さない）
    if (localMembers.length > bestMembers.length) {
      bestMembers = localMembers;
      from = "local";
    } else if (
      localMembers.length === bestMembers.length &&
      localMembers.length > 0 &&
      memberSettingsScore(localMembers) > memberSettingsScore(bestMembers)
    ) {
      bestMembers = mergeMemberLists(localMembers, bestMembers);
      from = "local";
    } else if (serverMembers.length > 0 && localMembers.length > 0) {
      bestMembers = mergeMemberLists(serverMembers, localMembers);
      from = "server";
    }

    if (legacyMembers.length > bestMembers.length) {
      bestMembers = legacyMembers;
      from = "legacy";
    } else if (
      legacyMembers.length === bestMembers.length &&
      legacyMembers.length > 0 &&
      memberSettingsScore(legacyMembers) > memberSettingsScore(bestMembers)
    ) {
      bestMembers = mergeMemberLists(legacyMembers, bestMembers);
      from = "legacy";
    }

    const serverScore = memberSettingsScore(serverMembers);
    const bestScore = memberSettingsScore(bestMembers);

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
        (server.coreMemberIds?.length ?? 0) > 0
          ? server.coreMemberIds ?? []
          : from === "local"
            ? local.coreMemberIds
            : [],
      dependencies:
        (server.dependencies?.length ?? 0) > 0
          ? server.dependencies ?? []
          : from === "local"
            ? local.dependencies
            : [],
      serverUpdatedAt: server.updatedAt,
    });

    // サーバーより設定が厚いときだけ昇格保存。薄い端末データで上書きしない
    if (serverMembers.length === 0 && bestMembers.length > 0) {
      scheduleServerSave(0);
    } else if (bestMembers.length > serverMembers.length || bestScore > serverScore) {
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
