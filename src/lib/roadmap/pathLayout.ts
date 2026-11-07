/** 本線 vs 横置きマスの分割（RoadmapPath / CreateSpace 共通） */

export type PathLane = -1 | 0 | 1;

export type PathLayoutPhase = {
  id: string;
  order: number;
  sideOf?: string | null;
  lane?: number | null;
};

export function isMainPathPhase<T extends PathLayoutPhase>(phase: T): boolean {
  return !phase.sideOf;
}

export function normalizeLane(lane: number | null | undefined): PathLane {
  if (lane === -1 || lane === 1) return lane;
  return 0;
}

/** 本線（縦）と、親マス id → 横置きマス一覧 */
export function splitRoadmapPathLayout<T extends PathLayoutPhase>(phases: T[]): {
  main: T[];
  bySideOf: Map<string, T[]>;
} {
  const main = phases.filter(isMainPathPhase).sort((a, b) => a.order - b.order);
  const bySideOf = new Map<string, T[]>();
  for (const phase of phases) {
    if (!phase.sideOf) continue;
    const list = bySideOf.get(phase.sideOf) ?? [];
    list.push(phase);
    bySideOf.set(phase.sideOf, list);
  }
  for (const list of bySideOf.values()) {
    list.sort((a, b) => {
      const laneDiff = normalizeLane(a.lane) - normalizeLane(b.lane);
      if (laneDiff !== 0) return laneDiff;
      return a.order - b.order;
    });
  }
  return { main, bySideOf };
}

/** 親マスにぶら下がる横置きを左右ごとに slotIndex 付きで並べる（0が最内） */
export function sideSlotsForParent<T extends PathLayoutPhase>(
  sides: T[],
): Array<T & { lane: -1 | 1; slotIndex: number }> {
  const left = sides
    .filter((side) => normalizeLane(side.lane) === -1)
    .sort((a, b) => a.order - b.order);
  const right = sides
    .filter((side) => normalizeLane(side.lane) === 1)
    .sort((a, b) => a.order - b.order);
  return [
    ...left.map((side, slotIndex) => ({ ...side, lane: -1 as const, slotIndex })),
    ...right.map((side, slotIndex) => ({ ...side, lane: 1 as const, slotIndex })),
  ];
}

/** 1つの本線マスにぶら下げられる横マスの上限 */
export const ROADMAP_MAX_SIDES_PER_PARENT = 3;

export type SidePlacement = { lane: -1 | 1; slotIndex: number };

/**
 * 次の横マスの位置:
 * - 1個目: preferredLane（広い側）
 * - 2個目: 1個目と同じ側の外側
 * - 3個目: 2個目と逆側
 * - すでに3個ある親には置けない
 */
export function nextSidePlacement(
  sides: Array<{ sideOf: string; lane?: number | null; order: number }>,
  sideOf: string | null,
  preferredLane: -1 | 1,
): SidePlacement | null {
  if (!sideOf) {
    return { lane: preferredLane, slotIndex: 0 };
  }
  const mine = sides
    .filter((side) => side.sideOf === sideOf)
    .sort((a, b) => a.order - b.order);
  if (mine.length >= ROADMAP_MAX_SIDES_PER_PARENT) return null;

  if (mine.length === 0) {
    return { lane: preferredLane, slotIndex: 0 };
  }

  if (mine.length === 1) {
    const firstLane = normalizeLane(mine[0]?.lane);
    const lane: -1 | 1 = firstLane === -1 || firstLane === 1 ? firstLane : preferredLane;
    const slotIndex = mine.filter((side) => normalizeLane(side.lane) === lane).length;
    return { lane, slotIndex };
  }

  const secondLane = normalizeLane(mine[1]?.lane);
  const lane: -1 | 1 =
    secondLane === 1 ? -1 : secondLane === -1 ? 1 : preferredLane === 1 ? -1 : 1;
  const slotIndex = mine.filter((side) => normalizeLane(side.lane) === lane).length;
  return { lane, slotIndex };
}
