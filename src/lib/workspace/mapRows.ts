import type { Issue, IssueStatus, Member, Phase, Priority, Project, ProjectStatus } from "@/lib/workspace/types";
import type { ProjectRow, ProjectMemberRow } from "@/lib/projects/types";

export type PhaseRowDb = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string;
  color: string;
  order: number;
  created_at: string;
  updated_at: string;
};

export type IssueRowDb = {
  id: string;
  project_id: string;
  phase_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  due_date: string | null;
  labels: string[] | null;
  created_at: string;
  updated_at: string;
};

export type ProfileLite = { id: string; display_name: string | null; avatar_url: string | null };

function mapMemberRole(r: ProjectMemberRow["role"]): Member["role"] {
  if (r === "owner") return "owner";
  if (r === "member") return "member";
  return "member";
}

export function buildMembers(
  memberRows: ProjectMemberRow[],
  profiles: Record<string, ProfileLite>,
  ownerId: string,
): Member[] {
  return memberRows.map((m) => {
    const p = profiles[m.user_id];
    return {
      id: m.user_id,
      name: p?.display_name?.trim() || "メンバー",
      avatarUrl: p?.avatar_url ?? undefined,
      role: m.user_id === ownerId ? "owner" : mapMemberRole(m.role),
    };
  });
}

export function mapIssueRow(row: IssueRowDb): Issue {
  return {
    id: row.id,
    title: row.title,
    status: row.status as IssueStatus,
    priority: row.priority as Priority,
    assigneeId: row.assignee_id ?? undefined,
    projectId: row.project_id,
    phaseId: row.phase_id ?? undefined,
    dueDate: row.due_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    description: row.description ?? undefined,
    labels: row.labels ?? [],
  };
}

export function nestPhasesWithIssues(phaseRows: PhaseRowDb[], issues: Issue[]): Phase[] {
  const byPhase = new Map<string, Issue[]>();
  for (const ph of phaseRows) byPhase.set(ph.id, []);
  for (const iss of issues) {
    if (iss.phaseId && byPhase.has(iss.phaseId)) {
      byPhase.get(iss.phaseId)!.push(iss);
    }
  }
  return phaseRows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as ProjectStatus,
    startDate: row.start_date,
    endDate: row.end_date,
    color: row.color,
    order: row.order,
    issues: byPhase.get(row.id) ?? [],
  }));
}

export function projectRowToWorkspace(
  row: ProjectRow & {
    icon?: string | null;
    start_date?: string | null;
    target_date?: string | null;
    linear_status?: string | null;
    lead_id?: string | null;
  },
  phases: Phase[],
  issues: Issue[],
  members: Member[],
): Project {
  const now = new Date().toISOString();
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    icon: row.icon ?? undefined,
    status: (row.linear_status as ProjectStatus) || "planned",
    startDate: row.start_date ?? row.created_at,
    targetDate: row.target_date ?? row.created_at,
    members,
    phases,
    leadId: row.lead_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function issueDoneRatio(issues: Issue[]): number {
  if (issues.length === 0) return 0;
  const done = issues.filter((i) => i.status === "done").length;
  return Math.round((done / issues.length) * 100);
}

/** 直近14日の完了数から日あたり速度を推定し、残件から予測完了日 */
export function estimateCompletionDate(issues: Issue[]): string | undefined {
  const open = issues.filter((i) => i.status !== "done" && i.status !== "cancelled");
  if (open.length === 0) return undefined;
  const cutoff = Date.now() - 14 * 86400000;
  const recentlyDone = issues.filter((i) => i.status === "done" && new Date(i.updatedAt).getTime() >= cutoff);
  const velocity = recentlyDone.length / 14;
  if (velocity <= 0) {
    const d = new Date();
    d.setDate(d.getDate() + Math.max(7, open.length * 2));
    return d.toISOString();
  }
  const days = Math.ceil(open.length / velocity);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
