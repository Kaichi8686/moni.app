import {
  OFFICE_CODEX_COMPLETE_BONUS,
  OFFICE_CODEX_FIRST_BONUS,
  OFFICE_SCENES,
  OFFICE_SCENE_LABEL_JA,
  type OfficeSceneId,
} from "@/lib/office/scenes";
import type { IncidentType } from "@/lib/office/types";

export const CODEX_TYPES: IncidentType[] = ["pinch", "chance", "people", "rival"];

export const CODEX_TYPE_LABEL_JA: Record<IncidentType, string> = {
  pinch: "ピンチ",
  chance: "チャンス",
  people: "人間関係",
  rival: "ライバル",
};

export type CodexCell = {
  scene: OfficeSceneId;
  type: IncidentType;
  firstSolvedAt: string;
  bestScore: number;
};

export type CodexUnlockResult = {
  cells: CodexCell[];
  isFirstClear: boolean;
  isComplete: boolean;
  bonus: number;
  cell: CodexCell;
};

export function emptyCodex(): CodexCell[] {
  return [];
}

export function parseCodex(raw: unknown): CodexCell[] {
  if (!Array.isArray(raw)) return [];
  const out: CodexCell[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const scene = String(row.scene ?? "") as OfficeSceneId;
    const type = String(row.type ?? "") as IncidentType;
    if (!(OFFICE_SCENES as readonly string[]).includes(scene)) continue;
    if (!CODEX_TYPES.includes(type)) continue;
    const bestScore = Math.max(0, Math.min(100, Math.round(Number(row.bestScore ?? row.best_score ?? 0))));
    const firstSolvedAt = String(row.firstSolvedAt ?? row.first_solved_at ?? new Date().toISOString());
    out.push({ scene, type, bestScore, firstSolvedAt });
  }
  return out;
}

export function findCodexCell(
  cells: CodexCell[],
  scene: OfficeSceneId,
  type: IncidentType,
): CodexCell | null {
  return cells.find((c) => c.scene === scene && c.type === type) ?? null;
}

export function isCodexComplete(cells: CodexCell[]): boolean {
  return cells.length >= OFFICE_SCENES.length * CODEX_TYPES.length;
}

/** クリア時の図鑑更新。初回クリア／コンプリートボーナスを返す */
export function unlockCodexCell(
  cells: CodexCell[],
  scene: OfficeSceneId,
  type: IncidentType,
  scoreTotal: number,
  now: Date = new Date(),
): CodexUnlockResult {
  const score = Math.max(0, Math.min(100, Math.round(scoreTotal)));
  const existing = findCodexCell(cells, scene, type);
  const wasComplete = isCodexComplete(cells);
  let nextCells: CodexCell[];
  let isFirstClear = false;
  let cell: CodexCell;

  if (!existing) {
    isFirstClear = true;
    cell = {
      scene,
      type,
      bestScore: score,
      firstSolvedAt: now.toISOString(),
    };
    nextCells = [...cells, cell];
  } else {
    cell = {
      ...existing,
      bestScore: Math.max(existing.bestScore, score),
    };
    nextCells = cells.map((c) => (c.scene === scene && c.type === type ? cell : c));
  }

  const nowComplete = isCodexComplete(nextCells);
  let bonus = 0;
  if (isFirstClear) bonus += OFFICE_CODEX_FIRST_BONUS;
  if (!wasComplete && nowComplete) bonus += OFFICE_CODEX_COMPLETE_BONUS;

  return {
    cells: nextCells,
    isFirstClear,
    isComplete: nowComplete,
    bonus,
    cell,
  };
}

export function codexProgress(cells: CodexCell[]): {
  unlocked: number;
  total: number;
  label: string;
} {
  const total = OFFICE_SCENES.length * CODEX_TYPES.length;
  const unlocked = cells.length;
  return {
    unlocked,
    total,
    label: `${unlocked}/${total}`,
  };
}

export function sceneLabel(scene: OfficeSceneId): string {
  return OFFICE_SCENE_LABEL_JA[scene] ?? scene;
}
