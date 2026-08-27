import { diffCalendarDaysFromTodayJapan } from "@/lib/projects/teamActivityStreak";
import type { Issue } from "@/lib/workspace/types";

export function filterActiveIssues(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.status !== "cancelled");
}

export function filterInProgressIssues(issues: Issue[]): Issue[] {
  return filterActiveIssues(issues).filter((i) => i.status === "in_progress" || i.status === "in_review");
}

export function filterOverdueIssues(issues: Issue[]): Issue[] {
  return filterActiveIssues(issues).filter((i) => {
    if (i.status === "done" || !i.dueDate) return false;
    const d = diffCalendarDaysFromTodayJapan(i.dueDate.slice(0, 10));
    return d !== null && d < 0;
  });
}

export function filterDueSoonIssues(issues: Issue[]): Issue[] {
  return filterActiveIssues(issues).filter((i) => {
    if (i.status === "done" || !i.dueDate) return false;
    const d = diffCalendarDaysFromTodayJapan(i.dueDate.slice(0, 10));
    return d !== null && d >= 0 && d <= 3;
  });
}

export function filterDueIssues(issues: Issue[]): Issue[] {
  return [...filterOverdueIssues(issues), ...filterDueSoonIssues(issues)];
}
