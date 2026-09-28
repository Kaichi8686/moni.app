import type { Issue, Member } from "@/lib/workspace/types";

/** 課題の担当ユーザーID一覧（複数対応・旧 assigneeId 互換） */
export function issueAssigneeIds(issue: Pick<Issue, "assigneeId" | "assigneeIds">): string[] {
  if (issue.assigneeIds && issue.assigneeIds.length > 0) {
    return [...new Set(issue.assigneeIds.filter(Boolean))];
  }
  if (issue.assigneeId) return [issue.assigneeId];
  return [];
}

export function isIssueAssignedTo(
  issue: Pick<Issue, "assigneeId" | "assigneeIds">,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return issueAssigneeIds(issue).includes(userId);
}

export function normalizeAssigneeIds(ids: string[] | null | undefined): string[] {
  if (!ids?.length) return [];
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
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
  issue: Pick<Issue, "assigneeId" | "assigneeIds">,
  nameByUserId: Record<string, string>,
): string[] {
  return issueAssigneeIds(issue).map((id) => nameByUserId[id]).filter(Boolean);
}

export function assigneeLabel(
  issue: Pick<Issue, "assigneeId" | "assigneeIds">,
  members: Member[],
  emptyLabel: string,
): string {
  const ids = issueAssigneeIds(issue);
  if (ids.length === 0) return emptyLabel;
  const names = ids.map((id) => members.find((m) => m.id === id)?.name).filter(Boolean) as string[];
  if (names.length === 0) return emptyLabel;
  return names.join("、");
}
