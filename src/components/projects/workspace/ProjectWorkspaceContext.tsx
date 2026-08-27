"use client";

import { Calendar, LayoutGrid, Menu, Settings, Share2, Sparkles, Trash2, Users, Radio } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addDays } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { ProjectRow, ProjectMemberRow } from "@/lib/projects/types";
import {
  mergeCoachingContext,
  parseCoachingContext,
  type CoachingContext,
} from "@/lib/projects/coachingContext";
import { buildSituationWorkspacePhaseRows } from "@/lib/projects/situationWorkspacePhases";
import type { UserSituation } from "@/lib/projects/userSituation";
import { isValidProjectUuid, normalizeProjectIdParam } from "@/lib/projects/validateProjectId";
import { logProjectActivity } from "@/lib/projects/projectActivity";
import { recordUserActivity } from "@/lib/gamification/recordUserActivity";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { clearLastProjectIfMatches, rememberLastProject } from "@/lib/workspace/lastProject";
import { ProjectMobileNavSheet } from "@/components/projects/ProjectMobileNavSheet";
import { ProjectInviteBellPanel } from "@/components/projects/ProjectInviteBellPanel";
import type { Issue, IssueStatus, IssueWorkflow, Member, Phase, Priority, Project } from "@/lib/workspace/types";
import { applyIssueDueDatesForProject } from "@/lib/workspace/applyIssueDueDates";
import { dueIsoForNewIssueInPhase, hasMeaningfulTargetDate } from "@/lib/workspace/issueDueSchedule";
import {
  buildWorkflowForMilestone,
  defaultWorkflowIfMissing,
  embedWorkflowInDescription,
} from "@/lib/workspace/issueWorkflow";
import { simplifyIssueText } from "@/lib/workspace/issuePlainLanguage";
import {
  projectIssueContextFromWorkspace,
  type ProjectIssueContext,
} from "@/lib/workspace/personalizeProjectIssues";
import {
  buildMembers,
  mapIssueRow,
  nestPhasesWithIssues,
  projectRowToWorkspace,
  type IssueRowDb,
  type PhaseRowDb,
  type ProfileLite,
} from "@/lib/workspace/mapRows";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { ProjectSettingsModal, type ProjectSettingsMeta } from "@/components/projects/workspace/ProjectSettingsModal";
import type { CalendarSchedule } from "@/components/projects/ProjectScheduleCalendar";
import { ProjectDeleteVotePanel } from "@/components/projects/workspace/ProjectDeleteVotePanel";
import {
  busyDateKeysFromSchedules,
  encodeScheduleDescription,
  isBusySchedule,
  type ScheduleKind,
} from "@/lib/workspace/busyScheduleDays";

function mapScheduleRow(row: {
  id: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  attendees?: string[] | null;
  kind?: string | null;
}): CalendarSchedule {
  const description = row.description ?? "";
  const kind: ScheduleKind = isBusySchedule({ kind: row.kind as ScheduleKind | undefined, description })
    ? "busy"
    : "event";
  return {
    id: row.id,
    title: row.title,
    description,
    starts_at: row.starts_at,
    ends_at: row.ends_at ?? null,
    attendees: row.attendees ?? null,
    kind,
  };
}

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
  projectContext: ProjectIssueContext | null;
  coachingContext: CoachingContext;
  phases: Phase[];
  issues: Issue[];
  schedules: CalendarSchedule[];
  scheduleSaving: boolean;
  uid: string | null;
  canEdit: boolean;
  isOwner: boolean;
  deleteProject: () => Promise<void>;
  reload: () => Promise<void>;
  createSchedule: (payload: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    attendees: string;
    kind?: "event" | "busy";
  }) => Promise<void>;
  deleteSchedule: (scheduleId: string) => Promise<void>;
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
  saveCoachingContext: (patch: Partial<CoachingContext>) => Promise<void>;
  seedPhasesFromSituation: (situation: UserSituation) => Promise<void>;
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
  updateIssueWorkflow: (issueId: string, workflow: IssueWorkflow) => Promise<void>;
  /** 答えを保存して課題を完了にする */
  completeIssue: (issueId: string, completionAnswer: string) => Promise<void>;
  /** 完成日を保存し、未完了課題の期限を配分する */
  setProjectCompletionDate: (
    targetDateYmd: string,
    options?: { startDateYmd?: string },
  ) => Promise<{ issuesUpdated: number }>;
  /** 子画面（例: ドキュメント編集）が戻るを処理したら true */
  registerBackHandler: (handler: (() => boolean) | null) => void;
  goBack: () => void;
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
  const { tx } = useI18n();
  const projectId = normalizeProjectIdParam(rawId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [headerNotice, setHeaderNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [inviteBellOpen, setInviteBellOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const [deleteProjectConfirmOpen, setDeleteProjectConfirmOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [projectMeta, setProjectMeta] = useState<ProjectSettingsMeta | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [projectContext, setProjectContext] = useState<ProjectIssueContext | null>(null);
  const [coachingContext, setCoachingContext] = useState<CoachingContext>({});
  const [phases, setPhases] = useState<Phase[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [schedules, setSchedules] = useState<CalendarSchedule[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const backHandlerRef = useRef<(() => boolean) | null>(null);

  const registerBackHandler = useCallback((handler: (() => boolean) | null) => {
    backHandlerRef.current = handler;
  }, []);

  const goBack = useCallback(() => {
    if (backHandlerRef.current?.()) return;
    router.push(HOME_PROJECTS_HREF);
  }, [router]);

  useEffect(() => {
    if (!actionMenuOpen) return;
    function onPointer(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActionMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [actionMenuOpen]);
  const [canEdit, setCanEdit] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

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
        setProjectMeta(null);
        setProjectContext(null);
        setCoachingContext({});
        setPhases([]);
        setIssues([]);
        setSchedules([]);
        setCanEdit(false);
        setIsOwner(false);
        return;
      }
      const row = prow as ProjectDbRow;

      const { data: mems } = await client.from("project_members").select("project_id,user_id,role").eq("project_id", projectId);
      const memberRows = (mems ?? []) as ProjectMemberRow[];
      const member = userId ? memberRows.find((m) => m.user_id === userId) : undefined;
      const owner = Boolean(userId && row.owner_id === userId);
      const editable = Boolean(userId && (owner || member));
      setCanEdit(editable);
      setIsOwner(owner);

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
      const { data: sched, error: schedErr } = await client
        .from("project_schedules")
        .select("id,title,description,starts_at,ends_at,attendees,kind")
        .eq("project_id", projectId)
        .order("starts_at", { ascending: true });
      if (schedErr) {
        const { data: schedFallback } = await client
          .from("project_schedules")
          .select("id,title,description,starts_at,ends_at,attendees")
          .eq("project_id", projectId)
          .order("starts_at", { ascending: true });
        setSchedules((schedFallback ?? []).map(mapScheduleRow));
      } else {
        setSchedules((sched ?? []).map(mapScheduleRow));
      }
      const mappedIssues = issueRows.map(mapIssueRow);
      const nested = nestPhasesWithIssues(phaseRows, mappedIssues);
      setIssues(mappedIssues);
      setPhases(nested);
      const wsProject = projectRowToWorkspace(row, nested, mappedIssues, members);
      const meta = {
        thumbnail_url: row.thumbnail_url ?? null,
        category: row.category ?? "",
        business_type: row.business_type ?? null,
        recruitment_target: row.recruitment_target ?? "",
        recruitment_message: row.recruitment_message ?? "",
        visibility: row.visibility ?? "public",
      };
      setProject(wsProject);
      setProjectMeta(meta);
      setProjectContext(projectIssueContextFromWorkspace(wsProject, meta));
      setCoachingContext(parseCoachingContext(row.coaching_context));
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
      const issue = issues.find((i) => i.id === issueId);
      const updatedAt = new Date().toISOString();
      const { error: err } = await supabase
        .from("project_issues")
        .update({ status, updated_at: updatedAt })
        .eq("id", issueId);
      if (err) throw new Error(err.message);
      setIssues((prev) => prev.map((i) => (i.id === issueId ? { ...i, status, updatedAt } : i)));
      if (status === "done" && uid && issue) {
        void logProjectActivity(supabase, {
          projectId,
          userId: uid,
          kind: "issue_done",
          body: `課題を完了: ${issue.title}`,
        });
        void recordUserActivity(supabase, uid).catch(() => undefined);
      }
    },
    [canEdit, issues, projectId, uid],
  );

  const saveCoachingContext = useCallback(
    async (patch: Partial<CoachingContext>) => {
      if (!supabase || !canEdit) return;
      const next = mergeCoachingContext(coachingContext, patch);
      const { error: err } = await supabase
        .from("projects")
        .update({ coaching_context: next, updated_at: new Date().toISOString() })
        .eq("id", projectId);
      if (err) throw new Error(err.message);
      setCoachingContext(next);
    },
    [canEdit, coachingContext, projectId],
  );

  const seedPhasesFromSituation = useCallback(
    async (situation: UserSituation) => {
      if (!supabase || !canEdit) return;
      if (phases.length > 0) throw new Error("すでにフェーズがあります。");
      const rows = buildSituationWorkspacePhaseRows(projectId, situation);
      const { error: err } = await supabase.from("project_phases").insert(rows);
      if (err) throw new Error(err.message);
      await saveCoachingContext({ userSituation: situation, onboardingDoneAt: new Date().toISOString() });
      await reload();
    },
    [canEdit, phases.length, projectId, reload, saveCoachingContext],
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
      const phase = input.phaseId ? phases.find((p) => p.id === input.phaseId) : undefined;
      const title = simplifyIssueText(input.title.trim());
      const workflow = buildWorkflowForMilestone({
        milestoneTitle: title,
        phaseTitle: phase?.title ?? "段階",
        phaseGoal: phase?.description,
        projectName: project?.name,
        projectAudience: projectContext?.audience,
      });

      let dueDate = input.dueDate ?? null;
      if (
        !dueDate &&
        project &&
        phase &&
        hasMeaningfulTargetDate(project.targetDate, project.startDate)
      ) {
        const openInPhase = issues.filter(
          (i) =>
            i.phaseId === phase.id &&
            i.status !== "done" &&
            i.status !== "cancelled",
        );
        dueDate = dueIsoForNewIssueInPhase({
          projectStart: project.startDate,
          projectTarget: project.targetDate,
          phaseStart: phase.startDate,
          phaseEnd: phase.endDate,
          indexInPhase: openInPhase.length,
          countInPhase: openInPhase.length + 1,
          blockedDateKeys: busyDateKeysFromSchedules(schedules),
        });
      }

      const row: Record<string, unknown> = {
        project_id: projectId,
        phase_id: input.phaseId ?? null,
        title,
        description: (input.description ?? "").trim(),
        status: input.status,
        priority: input.priority,
        assignee_id: input.assigneeId ?? null,
        due_date: dueDate,
        labels: input.phaseId ? ["roadmap"] : [],
        workflow_json: workflow,
      };
      let { error: err } = await supabase.from("project_issues").insert(row);
      if (err?.message?.toLowerCase().includes("workflow_json")) {
        const desc = embedWorkflowInDescription(String(row.description ?? ""), workflow);
        ({ error: err } = await supabase.from("project_issues").insert({ ...row, description: desc, workflow_json: undefined }));
      }
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, issues, phases, project, projectContext, projectId, reload, schedules, uid],
  );

  const createSchedule = useCallback(
    async (payload: {
      title: string;
      description: string;
      startsAt: string;
      endsAt: string;
      attendees: string;
      kind?: "event" | "busy";
    }) => {
      if (!supabase || !canEdit || !uid || !payload.title.trim() || !payload.startsAt) return;
      setScheduleSaving(true);
      try {
        const kind: ScheduleKind = payload.kind === "busy" ? "busy" : "event";
        const attendees =
          kind === "busy" ? [] : payload.attendees.split(/[,、]/).map((x) => x.trim()).filter(Boolean);
        const description = encodeScheduleDescription(kind, payload.description);
        const startsAt = new Date(payload.startsAt).toISOString();
        const endsAt = payload.endsAt ? new Date(payload.endsAt).toISOString() : null;
        const baseRow = {
          project_id: projectId,
          title: payload.title.trim(),
          description,
          starts_at: startsAt,
          ends_at: endsAt,
          attendees,
          created_by: uid,
        };
        let { error: err } = await supabase.from("project_schedules").insert({ ...baseRow, kind });
        if (err && /kind|column/i.test(err.message)) {
          ({ error: err } = await supabase.from("project_schedules").insert(baseRow));
        }
        if (err) throw new Error(err.message);

        if (kind === "busy" && project && hasMeaningfulTargetDate(project.targetDate, project.startDate)) {
          const nextSchedules: CalendarSchedule[] = [
            ...schedules,
            {
              id: "pending-busy",
              title: payload.title.trim(),
              description,
              starts_at: startsAt,
              ends_at: endsAt,
              attendees,
              kind: "busy",
            },
          ];
          await applyIssueDueDatesForProject({
            projectId,
            projectStart: project.startDate,
            projectTarget: project.targetDate,
            phases,
            issues,
            blockedDateKeys: busyDateKeysFromSchedules(nextSchedules),
          });
        }
        await reload();
      } finally {
        setScheduleSaving(false);
      }
    },
    [canEdit, issues, phases, project, projectId, reload, schedules, uid],
  );

  const deleteSchedule = useCallback(
    async (scheduleId: string) => {
      if (!supabase || !canEdit || !scheduleId) return;
      setScheduleSaving(true);
      try {
        const removed = schedules.find((s) => s.id === scheduleId);
        const { error: err } = await supabase
          .from("project_schedules")
          .delete()
          .eq("id", scheduleId)
          .eq("project_id", projectId);
        if (err) throw new Error(err.message);

        if (
          removed &&
          isBusySchedule(removed) &&
          project &&
          hasMeaningfulTargetDate(project.targetDate, project.startDate)
        ) {
          const nextSchedules = schedules.filter((s) => s.id !== scheduleId);
          await applyIssueDueDatesForProject({
            projectId,
            projectStart: project.startDate,
            projectTarget: project.targetDate,
            phases,
            issues,
            blockedDateKeys: busyDateKeysFromSchedules(nextSchedules),
          });
        }
        await reload();
      } finally {
        setScheduleSaving(false);
      }
    },
    [canEdit, issues, phases, project, projectId, reload, schedules],
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
      if (patch.title !== undefined) row.title = simplifyIssueText(patch.title.trim());
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

  const setProjectCompletionDate = useCallback(
    async (targetDateYmd: string, options?: { startDateYmd?: string }) => {
      if (!supabase || !canEdit || !project) return { issuesUpdated: 0 };
      const targetKey = targetDateYmd.trim().slice(0, 10);
      if (!targetKey) return { issuesUpdated: 0 };
      const targetIso = `${targetKey}T00:00:00.000Z`;
      const startKey = (options?.startDateYmd?.trim() || project.startDate.slice(0, 10)).slice(0, 10);
      const startIso = `${startKey}T00:00:00.000Z`;
      const { error: err } = await supabase
        .from("projects")
        .update({
          target_date: targetIso,
          start_date: startIso,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      if (err) throw new Error(err.message);

      const issuesUpdated = await applyIssueDueDatesForProject({
        projectId,
        projectStart: startIso,
        projectTarget: targetIso,
        phases,
        issues,
        blockedDateKeys: busyDateKeysFromSchedules(schedules),
      });
      await reload();
      return { issuesUpdated };
    },
    [canEdit, issues, phases, project, projectId, reload, schedules],
  );

  const completeIssue = useCallback(
    async (issueId: string, completionAnswer: string) => {
      if (!supabase || !canEdit) return;
      const issue = issues.find((i) => i.id === issueId);
      if (!issue) return;
      const phase = issue.phaseId ? phases.find((p) => p.id === issue.phaseId) : undefined;
      const base = defaultWorkflowIfMissing(issue, phase?.title, phase?.description);
      const trimmed = completionAnswer.trim();
      const steps = base.steps.map((s) =>
        s.id === "complete" ? { ...s, done: true, note: s.note || trimmed.slice(0, 200) } : s,
      );
      const workflow: IssueWorkflow = {
        ...base,
        steps,
        currentStepId: "complete",
        completionAnswer: trimmed,
      };
      const row: Record<string, unknown> = {
        status: "done",
        updated_at: new Date().toISOString(),
        workflow_json: workflow,
      };
      let { error: err } = await supabase.from("project_issues").update(row).eq("id", issueId);
      if (err?.message?.toLowerCase().includes("workflow_json")) {
        const desc = embedWorkflowInDescription(issue.description ?? "", workflow);
        ({ error: err } = await supabase
          .from("project_issues")
          .update({ ...row, description: desc, workflow_json: undefined })
          .eq("id", issueId));
      }
      if (err) throw new Error(err.message);
      if (uid) {
        void logProjectActivity(supabase, {
          projectId,
          userId: uid,
          kind: "issue_done",
          body: `課題を完了: ${issue.title}`,
        });
        void recordUserActivity(supabase, uid).catch(() => undefined);
      }
      await reload();
    },
    [canEdit, issues, phases, projectId, reload, uid],
  );

  const deleteProject = useCallback(async () => {
    if (!supabase || !isOwner || !project) return;
    const { error: err } = await supabase.from("projects").delete().eq("id", projectId);
    if (err) throw new Error(err.message);
    clearLastProjectIfMatches(projectId);
    router.push(HOME_PROJECTS_HREF);
  }, [isOwner, project, projectId, router]);

  const confirmDeleteProject = useCallback(async () => {
    setDeletingProject(true);
    try {
      await deleteProject();
      setDeleteProjectConfirmOpen(false);
    } catch (e) {
      setHeaderNotice(e instanceof Error ? e.message : "プロジェクトの削除に失敗しました");
      window.setTimeout(() => setHeaderNotice(""), 4000);
    } finally {
      setDeletingProject(false);
    }
  }, [deleteProject]);

  const updateIssueWorkflow = useCallback(
    async (issueId: string, workflow: IssueWorkflow) => {
      if (!supabase || !canEdit) return;
      const issue = issues.find((i) => i.id === issueId);
      const baseDesc = issue?.description ?? "";
      const updatedAt = new Date().toISOString();
      const row: Record<string, unknown> = {
        updated_at: updatedAt,
        workflow_json: workflow,
      };
      let nextDescription = baseDesc;
      let { error: err } = await supabase.from("project_issues").update(row).eq("id", issueId);
      if (err?.message?.toLowerCase().includes("workflow_json")) {
        nextDescription = embedWorkflowInDescription(baseDesc, workflow);
        row.description = nextDescription;
        delete row.workflow_json;
        ({ error: err } = await supabase.from("project_issues").update(row).eq("id", issueId));
      }
      if (err) throw new Error(err.message);
      // Avoid full reload — it remounts the sheet and makes typing shake.
      setIssues((prev) =>
        prev.map((i) =>
          i.id === issueId
            ? {
                ...i,
                workflow,
                description: nextDescription,
                updatedAt,
              }
            : i,
        ),
      );
    },
    [canEdit, issues],
  );

  const value = useMemo(
    () =>
      ({
        projectId,
        loading,
        error,
        project,
        projectContext,
        coachingContext,
        phases,
        issues,
        schedules,
        scheduleSaving,
        uid,
        canEdit,
        isOwner,
        deleteProject,
        reload,
        createPhase,
        movePhase,
        resizePhase,
        updateIssueStatus,
        createIssue,
        saveCoachingContext,
        seedPhasesFromSituation,
        updateIssue,
        updateIssueWorkflow,
        completeIssue,
        setProjectCompletionDate,
        createSchedule,
        deleteSchedule,
        registerBackHandler,
        goBack,
      }) satisfies Ctx,
    [
      projectId,
      loading,
      error,
      project,
      projectContext,
      coachingContext,
      phases,
      issues,
      schedules,
      scheduleSaving,
      uid,
      canEdit,
      isOwner,
      deleteProject,
      reload,
      createPhase,
      movePhase,
      resizePhase,
      updateIssueStatus,
      createIssue,
      saveCoachingContext,
      seedPhasesFromSituation,
      updateIssue,
      updateIssueWorkflow,
      completeIssue,
      setProjectCompletionDate,
      createSchedule,
      deleteSchedule,
      registerBackHandler,
      goBack,
    ],
  );

  const subtitle = project
    ? `${project.description?.slice(0, 40) ?? tx("探究", "Inquiry")} · ${tx(`${project.members.length}人`, `${project.members.length} people`)}`
    : "";

  useEffect(() => {
    if (project?.id && project.name) rememberLastProject(project.id, project.name);
  }, [project?.id, project?.name]);

  const onShareProject = useCallback(() => {
    if (!project || !uid) return;
    setInviteBellOpen(true);
  }, [project, uid]);

  return (
    <WorkspaceCtx.Provider value={value}>
      <div className="min-h-[100dvh] bg-[#FAFAFA] text-[#1A1A1A]">
        <header className="sticky top-0 z-[100] isolate border-b border-[#E5E7EB] bg-white px-4 py-2.5 shadow-sm sm:py-3 md:px-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <Link
                href={HOME_PROJECTS_HREF}
                className="hidden shrink-0 min-h-[40px] items-center rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-1.5 text-[13px] font-semibold text-[#374151] transition hover:bg-[#F3F4F6] md:inline-flex"
              >
                {tx("← 一覧", "← Projects")}
              </Link>
              {project ? (
                <>
                  {projectMeta?.thumbnail_url?.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element -- project cover
                    <img
                      src={projectMeta.thumbnail_url.trim()}
                      alt=""
                      className="hidden h-10 w-10 shrink-0 rounded-lg border border-[#E5E7EB] object-cover sm:block"
                    />
                  ) : (
                    <span className="hidden text-2xl sm:inline">{project.icon ?? "📁"}</span>
                  )}
                  <div className="min-w-0">
                    <h1 className="break-words text-base font-semibold tracking-tight sm:truncate sm:text-lg">{project.name}</h1>
                    <p className="hidden text-[12px] text-[#6B7280] sm:block sm:truncate">{subtitle}</p>
                  </div>
                </>
              ) : (
                <span className="text-base font-semibold sm:text-lg">{tx("読み込み中…", "Loading…")}</span>
              )}
            </div>
            <div className="pointer-events-auto relative z-[110] flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Link
                href={`/projects/${projectId}/coach`}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2.5 text-[13px] font-semibold text-[#5E6AD2] transition hover:bg-violet-100 md:hidden"
                aria-label={tx("相談AI", "Ask AI")}
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {tx("相談AI", "Ask AI")}
              </Link>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#374151] transition hover:bg-[#F7F8F8] md:hidden"
                aria-label={tx("プロジェクトメニュー", "Project menu")}
                aria-expanded={navMenuOpen}
                onClick={() => setNavMenuOpen(true)}
              >
                <LayoutGrid className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                disabled={!project}
                className="hidden h-10 w-10 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#374151] transition hover:bg-[#F7F8F8] disabled:opacity-50 sm:inline-flex"
                aria-label={tx("予定", "Schedule")}
                title={tx("予定", "Schedule")}
                onClick={() => router.push(`/projects/${projectId}/schedule`)}
              >
                <Calendar className="h-5 w-5" aria-hidden />
              </button>
              <div className="relative" ref={actionMenuRef}>
                <button
                  type="button"
                  disabled={!project}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition disabled:opacity-50 ${
                    actionMenuOpen
                      ? "border-[#5E6AD2] bg-[#EEF0FF] text-[#5E6AD2]"
                      : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F7F8F8]"
                  }`}
                  aria-label={tx("その他のメニュー", "More")}
                  aria-haspopup="menu"
                  aria-expanded={actionMenuOpen}
                  onClick={() => setActionMenuOpen((v) => !v)}
                >
                  <Menu className="h-5 w-5" aria-hidden />
                </button>
                {actionMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+6px)] z-[120] w-56 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-medium text-[#1A1A1A] transition hover:bg-[#F7F8F8] sm:hidden"
                      onClick={() => {
                        setActionMenuOpen(false);
                        router.push(`/projects/${projectId}/schedule`);
                      }}
                    >
                      <Calendar className="h-4 w-4 text-[#6B7280]" aria-hidden />
                      {tx("予定", "Schedule")}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-medium text-[#1A1A1A] transition hover:bg-[#F7F8F8]"
                      onClick={() => {
                        setActionMenuOpen(false);
                        router.push(`/projects/${projectId}/members`);
                      }}
                    >
                      <Users className="h-4 w-4 text-[#6B7280]" aria-hidden />
                      {tx("メンバー", "Members")}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-medium text-[#1A1A1A] transition hover:bg-[#F7F8F8]"
                      onClick={() => {
                        setActionMenuOpen(false);
                        router.push(`/projects/${projectId}/activity`);
                      }}
                    >
                      <Radio className="h-4 w-4 text-[#6B7280]" aria-hidden />
                      {tx("活動", "Activity")}
                    </button>
                    <div className="my-1 border-t border-[#F1F3F5]" aria-hidden />
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-medium text-[#1A1A1A] transition hover:bg-[#F7F8F8]"
                      onClick={() => {
                        setActionMenuOpen(false);
                        setSettingsOpen(true);
                      }}
                    >
                      <Settings className="h-4 w-4 text-[#6B7280]" aria-hidden />
                      {tx("プロジェクト設定", "Project settings")}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-medium text-[#1A1A1A] transition hover:bg-[#F7F8F8]"
                      onClick={() => {
                        setActionMenuOpen(false);
                        void onShareProject();
                      }}
                    >
                      <Share2 className="h-4 w-4 text-[#6B7280]" aria-hidden />
                      {tx("通知を見る", "View notifications")}
                    </button>
                    {project ? (
                      <>
                        <div className="my-1 border-t border-[#F1F3F5]" aria-hidden />
                        <button
                          type="button"
                          role="menuitem"
                          disabled={deletingProject}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                          onClick={() => {
                            setActionMenuOpen(false);
                            setDeleteProjectConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          {tx("プロジェクト削除…", "Delete project…")}
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {headerNotice ? (
            <p className="mx-auto mt-2 max-w-6xl text-center text-[12px] font-medium text-[#5E6AD2]" role="status">
              {headerNotice}
            </p>
          ) : null}
        </header>
        <div className="flex min-h-[calc(100dvh-3.75rem)] flex-col md:min-h-[calc(100dvh-4.25rem)] md:flex-row">
          <ProjectWorkspaceNav projectId={projectId} />
          <main className="project-workspace-main min-w-0 flex-1 overflow-x-hidden bg-white">
            <div className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-5">
              {error ? (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {error}
                </div>
              ) : null}
              {loading ? <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p> : null}
              {children}
            </div>
          </main>
        </div>
        <ProjectSettingsModal
          open={settingsOpen}
          projectId={projectId}
          userId={uid}
          canEdit={canEdit}
          isOwner={isOwner}
          name={project?.name ?? ""}
          description={project?.description}
          meta={projectMeta}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => void reload()}
          onDelete={deleteProject}
          onNotice={(message) => {
            setHeaderNotice(message);
            window.setTimeout(() => setHeaderNotice(""), 3200);
          }}
        />

        <ProjectDeleteVotePanel
          open={deleteProjectConfirmOpen && Boolean(project)}
          projectId={projectId}
          projectName={project?.name ?? ""}
          uid={uid}
          isOwner={isOwner}
          deleting={deletingProject}
          onClose={() => setDeleteProjectConfirmOpen(false)}
          onFinalizeDelete={async () => {
            await confirmDeleteProject();
          }}
        />

        <ProjectMobileNavSheet projectId={projectId} open={navMenuOpen} onClose={() => setNavMenuOpen(false)} />

        {inviteBellOpen && uid && project ? (
          <ProjectInviteBellPanel
            open={inviteBellOpen}
            onClose={() => setInviteBellOpen(false)}
            userId={uid}
            eligibleProjects={[
              {
                id: projectId,
                owner_id: uid,
                name: project.name,
                description: project.description ?? "",
                category: "",
                tags: [],
                thumbnail_url: projectMeta?.thumbnail_url ?? null,
                visibility: projectMeta?.visibility ?? "public",
                recruitment_target: projectMeta?.recruitment_target ?? "",
                recruitment_message: projectMeta?.recruitment_message ?? "",
                created_at: project.createdAt ?? new Date().toISOString(),
                updated_at: project.updatedAt ?? new Date().toISOString(),
              },
            ]}
            toast={(message) => {
              setHeaderNotice(message);
              window.setTimeout(() => setHeaderNotice(""), 3200);
            }}
          />
        ) : null}
      </div>
    </WorkspaceCtx.Provider>
  );
}
