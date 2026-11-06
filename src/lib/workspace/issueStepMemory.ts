/** 課題タブで最後に見ていたステップを短時間だけ覚える（sessionStorage） */

export const ISSUE_STEP_MEMORY_TTL_MS = 60 * 60 * 1000; // 1時間離れたら「いまのステップ」へ

type IssueStepMemory = {
  /** 実ステップ id のみ。ステップ未設定は記憶しない（誤って未設定から始まるのを防ぐ） */
  phaseId: string;
  /** 課題タブ／ページを離れた時刻。閲覧中は null */
  leftAt: number | null;
};

function storageKey(projectId: string): string {
  return `moni:issueStepMemory:v2:${projectId}`;
}

function readRaw(projectId: string): IssueStepMemory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IssueStepMemory>;
    if (typeof parsed.phaseId !== "string" || !parsed.phaseId.trim()) return null;
    const leftAt =
      parsed.leftAt === null || parsed.leftAt === undefined
        ? null
        : typeof parsed.leftAt === "number" && Number.isFinite(parsed.leftAt)
          ? parsed.leftAt
          : null;
    return { phaseId: parsed.phaseId.trim(), leftAt };
  } catch {
    return null;
  }
}

function writeRaw(projectId: string, value: IssueStepMemory) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(projectId), JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

/** いま見ている実ステップを覚える。未設定バケットは記憶しない */
export function rememberIssueStep(projectId: string, phaseId: string | null) {
  if (!projectId || !phaseId) return;
  writeRaw(projectId, { phaseId, leftAt: null });
}

/** 課題タブを離れた／他サイトへ行った時刻を刻む */
export function markIssueStepLeft(projectId: string) {
  if (!projectId) return;
  const prev = readRaw(projectId);
  if (!prev) return;
  writeRaw(projectId, { ...prev, leftAt: Date.now() });
}

/**
 * 短時間の離脱なら最後の実ステップ id を返す。
 * undefined = 初回・長時間離脱・無効 → 呼び出し側で「いまのステップ」
 */
export function readRecentIssueStep(
  projectId: string,
  validPhaseIds: Set<string>,
  now = Date.now(),
  ttlMs = ISSUE_STEP_MEMORY_TTL_MS,
): string | undefined {
  if (!projectId) return undefined;
  const mem = readRaw(projectId);
  if (!mem) return undefined;
  if (mem.leftAt != null && now - mem.leftAt > ttlMs) return undefined;
  if (!validPhaseIds.has(mem.phaseId)) return undefined;
  return mem.phaseId;
}

/** Overview と同じく本線を優先して「いまのステップ」を決める */
export function resolveCurrentPhaseId(
  phases: { id: string; status: string; order: number; sideOf?: string | null }[],
): string | null {
  const sorted = [...phases].sort((a, b) => a.order - b.order);
  const main = sorted.filter((phase) => !phase.sideOf);
  const pool = main.length > 0 ? main : sorted;
  const inProgress = pool.find((item) => item.status === "in_progress");
  if (inProgress) return inProgress.id;
  const firstOpen = pool.find((item) => item.status !== "completed");
  if (firstOpen) return firstOpen.id;
  return pool[0]?.id ?? sorted[0]?.id ?? null;
}
