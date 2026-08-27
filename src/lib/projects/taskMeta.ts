import type { BlockedReasonCode, ProjectTaskMeta, TodayThreeSlot } from "@/lib/projects/types";

const BLOCKED_CODES = new Set<BlockedReasonCode>([
  "unknown_how",
  "need_help",
  "missing_info",
  "no_time",
  "low_confidence",
]);

function parseEstimatedMinutes(raw: unknown): ProjectTaskMeta["estimatedMinutes"] | undefined {
  if (raw === 5 || raw === 15 || raw === 30 || raw === 60) return raw;
  return undefined;
}

function parseTodaySlot(raw: unknown): TodayThreeSlot | undefined {
  if (raw === "important" || raw === "quick" || raw === "consult") return raw;
  return undefined;
}

function parseBlockedReason(raw: unknown): BlockedReasonCode | undefined {
  if (typeof raw !== "string") return undefined;
  return BLOCKED_CODES.has(raw as BlockedReasonCode) ? (raw as BlockedReasonCode) : undefined;
}

export function parseTaskMeta(raw: unknown): ProjectTaskMeta {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  let inputKind: ProjectTaskMeta["inputKind"];
  if (o.inputKind === "choice" || o.inputKind === "text" || o.inputKind === "none") inputKind = o.inputKind;
  const choiceOptions = Array.isArray(o.choiceOptions)
    ? o.choiceOptions.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : undefined;
  const placeholder = typeof o.placeholder === "string" ? o.placeholder : undefined;
  const answer = typeof o.answer === "string" ? o.answer : undefined;
  let answerVisibility: ProjectTaskMeta["answerVisibility"];
  if (o.answerVisibility === "shared" || o.answerVisibility === "private") answerVisibility = o.answerVisibility;
  const answeredBy = typeof o.answeredBy === "string" ? o.answeredBy : undefined;
  const answeredAt = typeof o.answeredAt === "string" ? o.answeredAt : undefined;
  const estimatedMinutes = parseEstimatedMinutes(o.estimatedMinutes);
  const completionCriteria = typeof o.completionCriteria === "string" ? o.completionCriteria : undefined;
  const whyThisMatters = typeof o.whyThisMatters === "string" ? o.whyThisMatters : undefined;
  const lastReflection = typeof o.lastReflection === "string" ? o.lastReflection : undefined;
  const todaySlot = parseTodaySlot(o.todaySlot);
  const consultHint = typeof o.consultHint === "string" ? o.consultHint : undefined;
  const blockedReasonCode = parseBlockedReason(o.blockedReasonCode);
  let difficulty: ProjectTaskMeta["difficulty"];
  if (
    o.difficulty === "すぐできる" ||
    o.difficulty === "ちょっと勇気がいる" ||
    o.difficulty === "誰かと一緒にやろう"
  ) {
    difficulty = o.difficulty;
  }
  const fallback = typeof o.fallback === "string" ? o.fallback : undefined;
  let priorityLabel: ProjectTaskMeta["priorityLabel"];
  if (o.priorityLabel === "今日やるべき" || o.priorityLabel === "今週中にやる" || o.priorityLabel === "余裕があれば") {
    priorityLabel = o.priorityLabel;
  }
  return {
    inputKind,
    choiceOptions,
    placeholder,
    answer,
    answerVisibility,
    answeredBy,
    answeredAt,
    estimatedMinutes,
    completionCriteria,
    whyThisMatters,
    lastReflection,
    todaySlot,
    consultHint,
    blockedReasonCode,
    difficulty,
    fallback,
    priorityLabel,
  };
}

export function canViewTaskAnswer(
  meta: ProjectTaskMeta,
  viewerId: string | null,
  taskCreatedBy: string | null | undefined,
): boolean {
  if (!meta.answer?.trim()) return false;
  if (meta.answerVisibility !== "private") return true;
  if (!viewerId) return false;
  if (viewerId === taskCreatedBy) return true;
  if (viewerId === meta.answeredBy) return true;
  return false;
}

export function mergeTaskMeta(current: ProjectTaskMeta, patch: ProjectTaskMeta): ProjectTaskMeta {
  return { ...current, ...patch };
}

/** null でキーを削除（DB の meta 更新用）。未知キーは raw を維持 */
export type TaskMetaPatch = Partial<{ [K in keyof ProjectTaskMeta]: ProjectTaskMeta[K] | null }>;

export function applyTaskMetaPatch(raw: unknown, patch: TaskMetaPatch): Record<string, unknown> {
  const o: Record<string, unknown> =
    raw != null && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
  for (const key of Object.keys(patch) as (keyof TaskMetaPatch)[]) {
    const v = patch[key];
    if (v === null) {
      delete o[String(key)];
    } else if (v !== undefined) {
      o[String(key)] = v;
    }
  }
  return o;
}
