import type { Issue } from "@/lib/workspace/types";

function isClosed(status: Issue["status"]): boolean {
  return status === "done" || status === "cancelled";
}

function dueKey(iso?: string): string | null {
  if (!iso?.trim()) return null;
  return iso.slice(0, 10);
}

/** 未完了を先に、期限が近い順。期限なしは未完了の末尾。完了・中止は最後。 */
export function sortIssuesByDueDate(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const aClosed = isClosed(a.status);
    const bClosed = isClosed(b.status);
    if (aClosed !== bClosed) return aClosed ? 1 : -1;

    const aKey = dueKey(a.dueDate);
    const bKey = dueKey(b.dueDate);
    if (aKey && bKey && aKey !== bKey) return aKey.localeCompare(bKey);
    if (aKey && !bKey) return -1;
    if (!aKey && bKey) return 1;

    return a.title.localeCompare(b.title, "ja");
  });
}
