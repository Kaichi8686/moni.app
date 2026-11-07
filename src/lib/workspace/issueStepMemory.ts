/** 課題タブで最後に見ていた画面（ステップ / ジャンル一覧 / 課題）を短時間覚える（sessionStorage） */

import { isTaskGenre } from "@/lib/workspace/issueWork";

export const ISSUE_STEP_MEMORY_TTL_MS = 60 * 60 * 1000; // 1時間離れたら「いまのステップ」へ

export type RememberedIssueScreen =
  | { kind: "step"; phaseId: string | null }
  | { kind: "genre"; phaseId: string | null; genre: string }
  | { kind: "task"; phaseId: string | null; genre: string; issueId: string };

type IssueScreenMemory = RememberedIssueScreen & {
  /** 課題タブ／ページを離れた時刻。閲覧中は null */
  leftAt: number | null;
};

function storageKey(projectId: string): string {
  return `moni:issueScreenMemory:v1:${projectId}`;
}

/** 旧キー（ステップのみ）— 移行後に削除 */
function legacyStorageKey(projectId: string): string {
  return `moni:issueStepMemory:v2:${projectId}`;
}

function parsePhaseId(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

function parseRememberedScreen(parsed: Record<string, unknown>): RememberedIssueScreen | null {
  const phaseId = parsePhaseId(parsed.phaseId);
  if (phaseId === undefined) return null;

  const kind = parsed.kind;
  if (kind === "genre") {
    const genre = typeof parsed.genre === "string" ? parsed.genre : "";
    if (!isTaskGenre(genre)) return null;
    return { kind: "genre", phaseId, genre };
  }
  if (kind === "task") {
    const genre = typeof parsed.genre === "string" ? parsed.genre : "";
    const issueId = typeof parsed.issueId === "string" ? parsed.issueId.trim() : "";
    if (!isTaskGenre(genre) || !issueId) return null;
    return { kind: "task", phaseId, genre, issueId };
  }
  // kind 省略 / "step" / 旧形式
  if (kind === "step" || kind === undefined || kind === null) {
    // 旧形式は実ステップ id のみ。未設定は記憶しない
    if (phaseId === null) return null;
    return { kind: "step", phaseId };
  }
  return null;
}

function readRaw(projectId: string): IssueScreenMemory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.sessionStorage.getItem(storageKey(projectId)) ??
      window.sessionStorage.getItem(legacyStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const screen = parseRememberedScreen(parsed);
    if (!screen) return null;
    const leftAt =
      parsed.leftAt === null || parsed.leftAt === undefined
        ? null
        : typeof parsed.leftAt === "number" && Number.isFinite(parsed.leftAt)
          ? parsed.leftAt
          : null;
    return { ...screen, leftAt };
  } catch {
    return null;
  }
}

function writeRaw(projectId: string, value: IssueScreenMemory) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(projectId), JSON.stringify(value));
    window.sessionStorage.removeItem(legacyStorageKey(projectId));
  } catch {
    /* ignore quota / private mode */
  }
}

/** いま見ている画面を覚える */
export function rememberIssueScreen(projectId: string, screen: RememberedIssueScreen) {
  if (!projectId) return;
  writeRaw(projectId, { ...screen, leftAt: null });
}

/**
 * @deprecated rememberIssueScreen を使う。互換のため残す。
 * いま見ている実ステップを覚える。未設定バケットは記憶しない。
 */
export function rememberIssueStep(projectId: string, phaseId: string | null) {
  if (!projectId || !phaseId) return;
  rememberIssueScreen(projectId, { kind: "step", phaseId });
}

/** 課題タブを離れた／他サイトへ行った時刻を刻む */
export function markIssueStepLeft(projectId: string) {
  if (!projectId) return;
  const prev = readRaw(projectId);
  if (!prev) return;
  writeRaw(projectId, { ...prev, leftAt: Date.now() });
}

/**
 * 短時間の離脱なら最後の画面を返す。
 * undefined = 初回・長時間離脱・無効 → 呼び出し側で「いまのステップ」
 */
export function readRecentIssueScreen(
  projectId: string,
  opts: {
    validPhaseIds: Set<string>;
    issueIds?: Set<string>;
    now?: number;
    ttlMs?: number;
  },
): RememberedIssueScreen | undefined {
  if (!projectId) return undefined;
  const { validPhaseIds, issueIds, now = Date.now(), ttlMs = ISSUE_STEP_MEMORY_TTL_MS } = opts;
  const mem = readRaw(projectId);
  if (!mem) return undefined;
  if (mem.leftAt != null && now - mem.leftAt > ttlMs) return undefined;

  const phaseOk = mem.phaseId === null || validPhaseIds.has(mem.phaseId);
  if (!phaseOk) return undefined;

  if (mem.kind === "task") {
    if (issueIds && !issueIds.has(mem.issueId)) {
      // 課題が消えていたらジャンル一覧へフォールバック
      return { kind: "genre", phaseId: mem.phaseId, genre: mem.genre };
    }
    return { kind: "task", phaseId: mem.phaseId, genre: mem.genre, issueId: mem.issueId };
  }
  if (mem.kind === "genre") {
    return { kind: "genre", phaseId: mem.phaseId, genre: mem.genre };
  }
  if (mem.phaseId === null) return undefined;
  return { kind: "step", phaseId: mem.phaseId };
}

/**
 * @deprecated readRecentIssueScreen を使う。互換のため残す。
 */
export function readRecentIssueStep(
  projectId: string,
  validPhaseIds: Set<string>,
  now = Date.now(),
  ttlMs = ISSUE_STEP_MEMORY_TTL_MS,
): string | undefined {
  const screen = readRecentIssueScreen(projectId, { validPhaseIds, now, ttlMs });
  if (!screen || screen.phaseId === null) return undefined;
  return screen.phaseId;
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
