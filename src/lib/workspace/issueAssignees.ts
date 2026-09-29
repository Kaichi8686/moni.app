import type { Issue, Member } from "@/lib/workspace/types";

/** labels に埋める担当タグ（assignee_ids 未適用時のフォールバック） */
export const ASSIGNEE_LABEL_PREFIX = "assignee:";

/** 課題の担当ユーザーID一覧（複数対応・旧 assigneeId / labels 互換） */
export function issueAssigneeIds(
  issue: Pick<Issue, "assigneeId" | "assigneeIds" | "labels">,
): string[] {
  return resolveAssigneeIds(issue.assigneeIds, issue.assigneeId, issue.labels);
}

export function isIssueAssignedTo(
  issue: Pick<Issue, "assigneeId" | "assigneeIds" | "labels">,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  const uid = String(userId);
  // 自分が担当に含まれていればよい（単独担当に限らない）
  return issueAssigneeIds(issue).some((id) => String(id) === uid);
}

export function normalizeAssigneeIds(ids: string[] | null | undefined): string[] {
  if (!ids?.length) return [];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

export function assigneesFromLabels(labels: string[] | null | undefined): string[] {
  return normalizeAssigneeIds(
    (labels ?? [])
      .filter((label) => label.startsWith(ASSIGNEE_LABEL_PREFIX))
      .map((label) => label.slice(ASSIGNEE_LABEL_PREFIX.length)),
  );
}

/** labels の担当タグを差し替え（他ラベルは維持） */
export function withAssigneeLabels(labels: string[] | null | undefined, ids: string[] | null | undefined): string[] {
  const rest = (labels ?? []).filter((label) => !label.startsWith(ASSIGNEE_LABEL_PREFIX));
  const assigneeLabels = normalizeAssigneeIds(ids).map((id) => `${ASSIGNEE_LABEL_PREFIX}${id}`);
  return [...rest, ...assigneeLabels];
}

/**
 * DB / 互換フィールドから担当一覧を復元。
 * assignee_ids → labels タグ → assignee_id の順で集め、重複を除く。
 */
export function resolveAssigneeIds(
  assigneeIds: string[] | null | undefined,
  assigneeId?: string | null,
  labels?: string[] | null,
): string[] {
  const fromCol = normalizeAssigneeIds(assigneeIds);
  const fromLabels = assigneesFromLabels(labels);
  const fromSingle = assigneeId ? [String(assigneeId).trim()].filter(Boolean) : [];
  // 列があるときはそれを主にしつつ、labels / 単一列に残った分も落とさない
  return [...new Set([...fromCol, ...fromLabels, ...fromSingle])];
}

/** DB 書き込み用: 配列 + 互換の第1担当 */
export function assigneeWriteFields(ids: string[] | null | undefined): {
  assignee_ids: string[];
  assignee_id: string | null;
} {
  const assignee_ids = normalizeAssigneeIds(ids);
  return {
    assignee_ids,
    assignee_id: assignee_ids[0] ?? null,
  };
}

export function assigneeNames(
  issue: Pick<Issue, "assigneeId" | "assigneeIds" | "labels">,
  nameByUserId: Record<string, string>,
): string[] {
  return issueAssigneeIds(issue).map((id) => nameByUserId[id]).filter(Boolean);
}

export function assigneeLabel(
  issue: Pick<Issue, "assigneeId" | "assigneeIds" | "labels">,
  members: Member[],
  emptyLabel: string,
): string {
  const ids = issueAssigneeIds(issue);
  if (ids.length === 0) return emptyLabel;
  const names = ids.map((id) => members.find((m) => m.id === id)?.name).filter(Boolean) as string[];
  if (names.length === 0) return emptyLabel;
  return names.join("、");
}
