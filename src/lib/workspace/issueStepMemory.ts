/** 課題タブで最後に見ていたステップを短時間だけ覚える（sessionStorage） */

export const ISSUE_STEP_MEMORY_TTL_MS = 60 * 60 * 1000; // 1時間離れたら「いまのステップ」へ

type IssueStepMemory = {
  phaseId: string | null;
  /** 課題タブ／ページを離れた時刻。閲覧中は null */
  leftAt: number | null;
};

function storageKey(projectId: string): string {
  return `moni:issueStepMemory:${projectId}`;
}

function readRaw(projectId: string): IssueStepMemory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IssueStepMemory>;
    if (parsed.phaseId !== null && typeof parsed.phaseId !== "string") return null;
    const leftAt =
      parsed.leftAt === null || parsed.leftAt === undefined
        ? null
        : typeof parsed.leftAt === "number" && Number.isFinite(parsed.leftAt)
          ? parsed.leftAt
          : null;
    return { phaseId: parsed.phaseId ?? null, leftAt };
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

/** いま見ているステップを覚える（閲覧中フラグ） */
export function rememberIssueStep(projectId: string, phaseId: string | null) {
  if (!projectId) return;
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
 * 短時間の離脱なら最後のステップを返す。
 * - undefined: 初回 or 長時間離脱 → 呼び出し側で「いまのステップ」
 * - null: ステップ未設定バケットを復元
 * - string: その phaseId を復元
 */
export function readRecentIssueStep(
  projectId: string,
  validPhaseIds: Set<string>,
  now = Date.now(),
  ttlMs = ISSUE_STEP_MEMORY_TTL_MS,
): string | null | undefined {
  if (!projectId) return undefined;
  const mem = readRaw(projectId);
  if (!mem) return undefined;
  if (mem.leftAt != null && now - mem.leftAt > ttlMs) return undefined;
  // leftAt が null（同一セッションで未離脱扱い）も短時間復元対象
  if (mem.phaseId === null) {
    // 未設定バケットは明示的に覚えているときだけ
    return null;
  }
  if (!validPhaseIds.has(mem.phaseId)) return undefined;
  return mem.phaseId;
}
