"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { ProjectRow, ProjectMemberRow } from "@/lib/projects/types";
import { isValidProjectUuid, normalizeProjectIdParam } from "@/lib/projects/validateProjectId";
import { copyProjectInviteUrl } from "@/lib/projects/inviteLink";
import type { Issue, IssueStatus, Member, Phase, Priority, Project } from "@/lib/workspace/types";
import {
  buildMembers,
  mapIssueRow,
  nestPhasesWithIssues,
  projectRowToWorkspace,
  type IssueRowDb,
  type PhaseRowDb,
  type ProfileLite,
} from "@/lib/workspace/mapRows";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import type { CalendarSchedule } from "@/components/projects/ProjectScheduleCalendar";

type ProjectDbRow = ProjectRow & {
  icon?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  linear_status?: string | null;
  lead_id?: string | null;
};

type Ctx = {
  projectId: string;
  loading: boolean;
  error: string;
  project: Project | null;
  phases: Phase[];
  issues: Issue[];
  schedules: CalendarSchedule[];
  scheduleSaving: boolean;
  uid: string | null;
  canEdit: boolean;
  reload: () => Promise<void>;
  createSchedule: (payload: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    attendees: string;
  }) => Promise<void>;
  createPhase: (input: {
    title: string;
    startDate: string;
    endDate: string;
    status: Phase["status"];
    color: string;
  }) => Promise<void>;
  movePhase: (phaseId: string, deltaDays: number) => Promise<void>;
  resizePhase: (phaseId: string, deltaDays: number) => Promise<void>;
  updateIssueStatus: (issueId: string, status: Issue["status"]) => Promise<void>;
  createIssue: (input: {
    title: string;
    description?: string;
    status: Issue["status"];
    priority: Issue["priority"];
    assigneeId?: string | null;
    dueDate?: string | null;
    phaseId?: string | null;
  }) => Promise<void>;
  updateIssue: (
    issueId: string,
    patch: {
      title?: string;
      description?: string | null;
      priority?: Priority;
      status?: IssueStatus;
      assigneeId?: string | null;
      dueDate?: string | null;
    },
  ) => Promise<void>;
};

const WorkspaceCtx = createContext<Ctx | null>(null);

export function useProjectWorkspace() {
  const v = useContext(WorkspaceCtx);
  if (!v) throw new Error("useProjectWorkspace must be used inside ProjectWorkspaceProvider");
  return v;
}

function isMissingTable(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("42p01") || m.includes("project_phases");
}

export function ProjectWorkspaceProvider({ projectId: rawId, children }: { projectId: string; children: ReactNode }) {
  const router = useRouter();
  const projectId = normalizeProjectIdParam(rawId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [schedules, setSchedules] = useState<CalendarSchedule[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const reload = useCallback(async () => {
    if (!supabase || !isValidProjectUuid(projectId)) {
      setError("無効なプロジェクトIDです。");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const client = supabase;
      const { data: session } = await client.auth.getSession();
      const userId = session?.session?.user.id ?? null;
      setUid(userId);

      const { data: prow, error: perr } = await client.from("projects").select("*").eq("id", projectId).single();
      if (perr || !prow) {
        setError(perr?.message ?? "プロジェクトを読み込めませんでした。");
        setProject(null);
        setPhases([]);
        setIssues([]);
        setSchedules([]);
        setCanEdit(false);
        return;
      }
      const row = prow as ProjectDbRow;

      const { data: mems } = await client.from("project_members").select("project_id,user_id,role").eq("project_id", projectId);
      const memberRows = (mems ?? []) as ProjectMemberRow[];
      const member = userId ? memberRows.find((m) => m.user_id === userId) : undefined;
      const editable = Boolean(userId && (row.owner_id === userId || member));
      setCanEdit(editable);

      const ids = [...new Set([row.owner_id, ...memberRows.map((m) => m.user_id)])];
      const { data: profs } = await client.from("profiles").select("id,display_name,avatar_url").in("id", ids);
      const profileMap: Record<string, ProfileLite> = {};
      for (const p of (profs ?? []) as ProfileLite[]) profileMap[p.id] = p;
      let members = buildMembers(memberRows, profileMap, row.owner_id);
      const memberIds = new Set(members.map((m) => m.id));
      if (!memberIds.has(row.owner_id)) {
        const po = profileMap[row.owner_id];
        const ownerMember: Member = {
          id: row.owner_id,
          name: po?.display_name?.trim() || "オーナー",
          avatarUrl: po?.avatar_url ?? undefined,
          role: "owner",
        };
        members = [ownerMember, ...members];
      }

      let phaseRows: PhaseRowDb[] = [];
      let issueRows: IssueRowDb[] = [];
      const { data: ph, error: phErr } = await client
        .from("project_phases")
        .select("*")
        .eq("project_id", projectId)
        .order("order", { ascending: true });
      if (phErr) {
        if (isMissingTable(phErr)) {
          setError(
            "Linearワークスペース用のDBが未適用です。Supabase で supabase/apply_linear_workspace.sql を実行してください。",
          );
        } else {
          setError(phErr.message);
        }
      } else {
        phaseRows = (ph ?? []) as PhaseRowDb[];
      }
      const { data: iss, error: issErr } = await client.from("project_issues").select("*").eq("project_id", projectId);
      if (!issErr) issueRows = (iss ?? []) as IssueRowDb[];
      const { data: sched } = await client
        .from("project_schedules")
        .select("id,title,description,starts_at,ends_at,attendees")
        .eq("project_id", projectId)
        .order("starts_at", { ascending: true });
      setSchedules((sched ?? []) as CalendarSchedule[]);
      const mappedIssues = issueRows.map(mapIssueRow);
      const nested = nestPhasesWithIssues(phaseRows, mappedIssues);
      setIssues(mappedIssues);
      setPhases(nested);
      setProject(projectRowToWorkspace(row, nested, mappedIssues, members));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createPhase = useCallback(
    async (input: { title: string; startDate: string; endDate: string; status: Phase["status"]; color: string }) => {
      if (!supabase || !canEdit) return;
      const maxOrder = phases.reduce((m, p) => Math.max(m, p.order), -1);
      const { error: e } = await supabase.from("project_phases").insert({
        project_id: projectId,
        title: input.title.trim(),
        start_date: input.startDate,
        end_date: input.endDate,
        status: input.status,
        color: input.color,
        order: maxOrder + 1,
      });
      if (e) throw new Error(e.message);
      await reload();
    },
    [canEdit, phases, projectId, reload],
  );

  const movePhase = useCallback(
    async (phaseId: string, deltaDays: number) => {
      if (!supabase || !canEdit || deltaDays === 0) return;
      const ph = phases.find((p) => p.id === phaseId);
      if (!ph) return;
      const s = addDays(new Date(ph.startDate), deltaDays);
      const e = addDays(new Date(ph.endDate), deltaDays);
      const { error: err } = await supabase
        .from("project_phases")
        .update({ start_date: s.toISOString(), end_date: e.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", phaseId);
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, phases, projectId, reload],
  );

  const resizePhase = useCallback(
    async (phaseId: string, deltaDays: number) => {
      if (!supabase || !canEdit || deltaDays === 0) return;
      const ph = phases.find((p) => p.id === phaseId);
      if (!ph) return;
      const e = addDays(new Date(ph.endDate), deltaDays);
      if (e.getTime() <= new Date(ph.startDate).getTime()) return;
      const { error: err } = await supabase
        .from("project_phases")
        .update({ end_date: e.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", phaseId);
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, phases, projectId, reload],
  );

  const updateIssueStatus = useCallback(
    async (issueId: string, status: Issue["status"]) => {
      if (!supabase || !canEdit) return;
      const { error: err } = await supabase
        .from("project_issues")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", issueId);
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, reload],
  );

  const createIssue = useCallback(
    async (input: {
      title: string;
      description?: string;
      status: Issue["status"];
      priority: Issue["priority"];
      assigneeId?: string | null;
      dueDate?: string | null;
      phaseId?: string | null;
    }) => {
      if (!supabase || !canEdit || !uid) return;
      const { error: err } = await supabase.from("project_issues").insert({
        project_id: projectId,
        phase_id: input.phaseId ?? null,
        title: input.title.trim(),
        description: (input.description ?? "").trim(),
        status: input.status,
        priority: input.priority,
        assignee_id: input.assigneeId ?? null,
        due_date: input.dueDate ?? null,
        labels: [],
      });
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, projectId, reload, uid],
  );

  const createSchedule = useCallback(
    async (payload: {
      title: string;
      description: string;
      startsAt: string;
      endsAt: string;
      attendees: string;
    }) => {
      if (!supabase || !canEdit || !uid || !payload.title.trim() || !payload.startsAt) return;
      setScheduleSaving(true);
      try {
        const attendees = payload.attendees.split(/[,、]/).map((x) => x.trim()).filter(Boolean);
        const { error: err } = await supabase.from("project_schedules").insert({
          project_id: projectId,
          title: payload.title.trim(),
          description: payload.description.trim(),
          starts_at: new Date(payload.startsAt).toISOString(),
          ends_at: payload.endsAt ? new Date(payload.endsAt).toISOString() : null,
          attendees,
          created_by: uid,
        });
        if (err) throw new Error(err.message);
        await reload();
      } finally {
        setScheduleSaving(false);
      }
    },
    [canEdit, projectId, reload, uid],
  );

  const updateIssue = useCallback(
    async (
      issueId: string,
      patch: {
        title?: string;
        description?: string | null;
        priority?: Priority;
        status?: IssueStatus;
        assigneeId?: string | null;
        dueDate?: string | null;
      },
    ) => {
      if (!supabase || !canEdit) return;
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.title !== undefined) row.title = patch.title.trim();
      if (patch.description !== undefined) row.description = patch.description === null ? "" : String(patch.description).trim();
      if (patch.priority !== undefined) row.priority = patch.priority;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.assigneeId !== undefined) row.assignee_id = patch.assigneeId;
      if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
      const { error: err } = await supabase.from("project_issues").update(row).eq("id", issueId);
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, reload],
  );

  const value = useMemo(
    () =>
      ({
        projectId,
        loading,
        error,
        project,
        phases,
        issues,
        schedules,
        scheduleSaving,
        uid,
        canEdit,
        reload,
        createPhase,
        movePhase,
        resizePhase,
        updateIssueStatus,
        createIssue,
        updateIssue,
        createSchedule,
      }) satisfies Ctx,
    [
      projectId,
      loading,
      error,
      project,
      phases,
      issues,
      schedules,
      scheduleSaving,
      uid,
      canEdit,
      reload,
      createPhase,
      movePhase,
      resizePhase,
      updateIssueStatus,
      createIssue,
      updateIssue,
      createSchedule,
    ],
  );

  const subtitle = project ? `${project.description?.slice(0, 40) ?? "探究"} · ${project.members.length}人` : "";

  return (
    <WorkspaceCtx.Provider value={value}>
      <div className="min-h-[100dvh] bg-[#FAFAFA] text-[#1A1A1A]">
        <header className="border-b border-[#E5E7EB] bg-white px-4 py-3">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="text-[13px] font-medium text-[#6B7280] hover:text-[#1A1A1A]"
                onClick={() => router.push("/projects")}
              >
                ← プロジェクト一覧
              </button>
              {project ? (
                <>
                  <span className="text-2xl">{project.icon ?? "📁"}</span>
                  <div className="min-w-0">
                    <h1 className="truncate text-lg font-semibold tracking-tight">{project.name}</h1>
                    <p className="truncate text-[12px] text-[#6B7280]">{subtitle}</p>
                  </div>
                </>
              ) : (
                <span className="text-lg font-semibold">読み込み中…</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition-all duration-150 hover:bg-[#F7F8F8]"
                onClick={() => void copyProjectInviteUrl(projectId)}
              >
                共有
              </button>
              <Link
                href={`/projects/${projectId}/members`}
                className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition-all duration-150 hover:bg-[#F7F8F8]"
              >
                設定
              </Link>
            </div>
          </div>
          <div className="mx-auto max-w-6xl">
            <ProjectTabs projectId={projectId} />
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-4">
          {error ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{error}</div>
          ) : null}
          {loading ? <p className="text-sm text-[#6B7280]">読み込み中…</p> : null}
          {children}
        </div>
      </div>
    </WorkspaceCtx.Provider>
  );
}
