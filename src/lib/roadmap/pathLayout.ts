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
