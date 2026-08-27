"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { uploadProjectImage, validateProjectImageFile } from "@/lib/projects/uploadProjectImage";
import { supabase } from "@/lib/supabase";
import type { ProjectMemberRow, ProjectRow } from "@/lib/projects/types";
import { isValidProjectUuid, normalizeProjectIdParam } from "@/lib/projects/validateProjectId";
import { ProjectHomePanel } from "@/components/projects/ProjectHomePanel";
import { ProjectRoadmapPanel, type RoadmapStepFull } from "@/components/projects/ProjectRoadmapPanel";
import { ProjectTasksPanel, type TaskPanelRow } from "@/components/projects/ProjectTasksPanel";
import { pickFocusStep } from "@/lib/projects/roadmapFocus";
import { ProjectGoogleDocsShell } from "@/components/projects/ProjectGoogleDocsShell";
import { ProjectScheduleCalendar } from "@/components/projects/ProjectScheduleCalendar";
import {
  encodeScheduleDescription,
  type ScheduleKind,
} from "@/lib/workspace/busyScheduleDays";
import {
  parseCoachingContext,
  mergeCoachingContext,
  type CoachingContext,
  type OnboardingProgressStage,
  type OnboardingTeamSize,
} from "@/lib/projects/coachingContext";
import { ProjectOnboardingWizard } from "@/components/projects/ProjectOnboardingWizard";
import { bumpTeamActivityStreak, type BumpTeamActivityStreakResult } from "@/lib/projects/teamActivityStreak";
import { countWeekCompletedTasksJapan } from "@/lib/projects/weekTaskStats";
import { normalizeTaskStatus } from "@/lib/projects/taskStatus";
import { maybeCelebrateStreakMilestone, maybeCelebrateWeeklyGoalReached } from "@/lib/ui/activityCelebration";

type Props = { projectId: string };
type TabKey = "home" | "chat" | "documents" | "roadmap" | "schedule" | "members";
type ChatMode = "group" | "dm";

type ProjectDocumentRow = { id: string; title: string; content: string; updated_at: string; updated_by: string | null };
type ProjectTaskLite = TaskPanelRow;
type ScheduleRow = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  attendees: string[] | null;
  kind?: "event" | "busy";
};
type MessageRow = {
  id: string;
  sender_id: string;
  receiver_id?: string | null;
  body: string;
  attachment_url?: string | null;
  created_at: string;
};

/** メインタブ（モック: チャット / ロードマップ / タスク / ドキュメント）。メンバーはヘッダーから */
const primaryTabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "ホーム" },
  { key: "chat", label: "チャット" },
  { key: "roadmap", label: "ロードマップ" },
  { key: "schedule", label: "タスク・予定" },
  { key: "documents", label: "ドキュメント" },
];

function projectIconEmoji(businessType: string | null | undefined): string {
  if (businessType === "maker") return "🛒";
  if (businessType === "software") return "💻";
  if (businessType === "social") return "🌐";
  return "📂";
}

function buildProjectSubtitle(project: ProjectRow, memberCount: number): string {
  const theme = project.category?.trim() || "プロジェクト";
  return `${theme}・${memberCount}人チーム`;
}

function isSchemaError(error?: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || (error.message ?? "").includes("does not exist");
}

/** PostgREST の「行が0件」や権限由来のエラーをそのまま出さず説明する */
function plainTextFromDocContent(htmlOrText: string): string {
  const s = htmlOrText.trim();
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function friendlyProjectFetchMessage(error: { code?: string; message?: string }): string {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  if (code === "PGRST116" || msg.includes("0 rows") || msg.includes("no rows")) {
    return "このプロジェクトは表示できません。非公開でメンバーではない・URLのコピーが途中まで・ログインアカウントが違う、などの可能性があります。";
  }
  if (code === "42501" || msg.includes("permission denied")) {
    return "このプロジェクトを見る権限がありません。ログインするか、オーナーにメンバー追加を依頼してください。";
  }
  return error.message ?? "プロジェクトを読み込めませんでした。";
}

export function ProjectSpaceDetail({ projectId }: Props) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [chatMode, setChatMode] = useState<ChatMode>("group");
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [groupMessages, setGroupMessages] = useState<MessageRow[]>([]);
  const [directMessages, setDirectMessages] = useState<MessageRow[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const [chatImageFile, setChatImageFile] = useState<File | null>(null);
  const [chatImagePreview, setChatImagePreview] = useState<string | null>(null);
  const [chatImageUploading, setChatImageUploading] = useState(false);
  const [documents, setDocuments] = useState<ProjectDocumentRow[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [roadmapSteps, setRoadmapSteps] = useState<RoadmapStepFull[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTaskLite[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [joinRequests, setJoinRequests] = useState<Array<{ id: string; requester_id: string; message: string; status: string }>>([]);
  /** データ取得・スキーマ警告（load のたびに更新。操作エラーは消さない） */
  const [syncBanner, setSyncBanner] = useState("");
  /** 送信・作成などユーザー操作の結果（load ではクリアしない） */
  const [actionErr, setActionErr] = useState("");
  const [docCreating, setDocCreating] = useState(false);
  const [docSaving, setDocSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinMessageDraft, setJoinMessageDraft] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [inviteNotice, setInviteNotice] = useState("");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [groupProfileOpen, setGroupProfileOpen] = useState(false);
  const [transferOwnerOpen, setTransferOwnerOpen] = useState(false);
  const [dissolveOpen, setDissolveOpen] = useState(false);
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectDeleting, setProjectDeleting] = useState(false);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [editNameDraft, setEditNameDraft] = useState("");
  const [editThumbDraft, setEditThumbDraft] = useState("");
  const [editDescriptionDraft, setEditDescriptionDraft] = useState("");
  const [editCategoryDraft, setEditCategoryDraft] = useState("");
  const [editBusinessTypeDraft, setEditBusinessTypeDraft] = useState<"maker" | "software" | "social">("software");
  const [editRecruitmentTargetDraft, setEditRecruitmentTargetDraft] = useState("");
  const [editRecruitmentMessageDraft, setEditRecruitmentMessageDraft] = useState("");
  const headerMenuRef = useRef<HTMLDivElement>(null);

  const activeDoc = useMemo(() => documents.find((d) => d.id === activeDocId) ?? null, [documents, activeDocId]);
  const docWordCount = useMemo(() => {
    const t = plainTextFromDocContent(docContent);
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }, [docContent]);
  const peers = useMemo(() => members.filter((m) => m.user_id !== uid), [members, uid]);
  const isMember = useMemo(() => Boolean(uid && members.some((m) => m.user_id === uid)), [members, uid]);
  const myJoinPending = useMemo(
    () => Boolean(uid && joinRequests.some((r) => r.requester_id === uid && r.status === "pending")),
    [joinRequests, uid],
  );
  const canModerateJoinRequests = useMemo(() => {
    if (!uid || !selectedProject) return false;
    if (selectedProject.owner_id === uid) return true;
    const mine = members.find((m) => m.user_id === uid);
    return mine?.role === "owner" || mine?.role === "admin";
  }, [members, selectedProject, uid]);
  const isOwner = useMemo(() => Boolean(uid && selectedProject && uid === selectedProject.owner_id), [uid, selectedProject]);
  const canEditProjectSettings = useMemo(() => {
    if (!uid || !selectedProject) return false;
    if (selectedProject.owner_id === uid) return true;
    const m = members.find((x) => x.user_id === uid);
    return m?.role === "admin";
  }, [uid, selectedProject, members]);
  /** オーナーでもメンバーでもない＝リンク経由の閲覧者のみ。タブは出さず概要と参加申請だけ */
  const showVisitorPreview = useMemo(() => {
    if (!selectedProject) return false;
    return !isOwner && !isMember;
  }, [selectedProject, isOwner, isMember]);
  const canUseProjectRoom = useMemo(() => Boolean(selectedProject && (isOwner || isMember)), [selectedProject, isOwner, isMember]);
  const showProjectOnboarding = useMemo(() => {
    if (loading || !selectedProject || !canUseProjectRoom || !canEditProjectSettings) return false;
    const ctx = parseCoachingContext(selectedProject.coaching_context);
    if (ctx.onboardingDoneAt) return false;
    if (roadmapSteps.length > 0) return false;
    return true;
  }, [loading, selectedProject, canUseProjectRoom, canEditProjectSettings, roadmapSteps.length]);
  const currentMessages = useMemo(() => (chatMode === "group" ? groupMessages : directMessages), [chatMode, directMessages, groupMessages]);
  const dmMessages = useMemo(() => {
    return currentMessages.filter((m) => {
      if (chatMode === "group") return true;
      if (!selectedPeerId || !uid) return false;
      const a = m.sender_id === uid && m.receiver_id === selectedPeerId;
      const b = m.sender_id === selectedPeerId && m.receiver_id === uid;
      return a || b;
    });
  }, [chatMode, currentMessages, selectedPeerId, uid]);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab !== "chat") return;
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeTab, chatMode, selectedPeerId, dmMessages.length]);

  const load = useCallback(async () => {
    if (!supabase) {
      setSyncBanner("接続設定が見つかりません。");
      setLoading(false);
      return;
    }
    const normalizedId = normalizeProjectIdParam(projectId);
    if (!isValidProjectUuid(normalizedId)) {
      setSyncBanner("プロジェクトIDが不正です。");
      setLoading(false);
      return;
    }
    setLoading(true);
    setSyncBanner("");
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id ?? null;
    setUid(userId);

    const { data: projectData, error: projectError } = await supabase.from("projects").select("*").eq("id", normalizedId).single();
    if (projectError) {
      setSelectedProject(null);
      setSyncBanner(friendlyProjectFetchMessage(projectError));
      setLoading(false);
      return;
    }
    setSelectedProject(projectData as ProjectRow);

    const [{ data: memberRows }, { data: requestRows }, groupRes, dmRes, docRes, roadmapRes, scheduleRes, tasksRes] = await Promise.all([
      supabase.from("project_members").select("*").eq("project_id", normalizedId).order("joined_at", { ascending: true }),
      supabase.from("project_join_requests").select("id,requester_id,message,status").eq("project_id", normalizedId).order("created_at", { ascending: false }),
      supabase.from("project_chat_messages").select("id,sender_id,body,attachment_url,created_at").eq("project_id", normalizedId).order("created_at", { ascending: true }).limit(200),
      supabase.from("project_direct_messages").select("id,sender_id,receiver_id,body,attachment_url,created_at").eq("project_id", normalizedId).order("created_at", { ascending: true }).limit(200),
      supabase.from("project_documents").select("id,title,content,updated_at,updated_by").eq("project_id", normalizedId).order("updated_at", { ascending: false }),
      supabase
        .from("project_roadmap_steps")
        .select("id,title,status,position,description,due_date,owner_id,notes,completion_criteria,created_at,updated_at")
        .eq("project_id", normalizedId)
        .order("position", { ascending: true }),
      supabase.from("project_schedules").select("id,title,description,starts_at,ends_at,attendees").eq("project_id", normalizedId).order("starts_at", { ascending: true }),
      supabase
        .from("project_tasks")
        .select("id,title,description,status,priority,due_date,assignee_id,created_by,roadmap_step_id,meta,updated_at")
        .eq("project_id", normalizedId),
    ]);

    const memberList = (memberRows ?? []) as ProjectMemberRow[];
    setMembers(memberList);
    setJoinRequests(((requestRows ?? []) as Array<{ id: string; requester_id: string; message: string; status: string }>).filter((r) => r.status === "pending"));
    setGroupMessages(((groupRes.data ?? []) as MessageRow[]).map((m) => ({ ...m, receiver_id: null })));

    const schemaMsgs: string[] = [];
    if (isSchemaError(dmRes.error)) schemaMsgs.push("個別チャット（SQL未適用の可能性）");
    setDirectMessages((dmRes.data ?? []) as MessageRow[]);

    if (isSchemaError(docRes.error)) schemaMsgs.push("ドキュメント");
    const docRows = (docRes.data ?? []) as ProjectDocumentRow[];
    setDocuments(docRows);
    if (!activeDocId && docRows.length > 0) {
      setActiveDocId(docRows[0].id);
      setDocTitle(docRows[0].title);
      setDocContent(docRows[0].content ?? "");
    }

    if (isSchemaError(roadmapRes.error)) schemaMsgs.push("ロードマップ");
    setRoadmapSteps((roadmapRes.data ?? []) as RoadmapStepFull[]);

    let taskRows: ProjectTaskLite[] = [];
    if (!tasksRes.error) {
      taskRows = (tasksRes.data ?? []) as ProjectTaskLite[];
    } else {
      const retry = await supabase
        .from("project_tasks")
        .select("id,title,description,status,priority,due_date,assignee_id,created_by,roadmap_step_id,updated_at")
        .eq("project_id", normalizedId);
      if (!retry.error) {
        taskRows = (retry.data ?? []).map((r) => ({ ...(r as ProjectTaskLite), meta: {} }));
      } else if (isSchemaError(tasksRes.error) || isSchemaError(retry.error)) {
        schemaMsgs.push("プロジェクトタスク（ロードマップ連携）");
      }
    }
    setProjectTasks(taskRows);

    if (isSchemaError(scheduleRes.error)) schemaMsgs.push("スケジュール");
    setSchedules(
      ((scheduleRes.data ?? []) as ScheduleRow[]).map((s) => ({
        ...s,
        kind: (s.description ?? "").trimStart().startsWith("[[moni:busy]]") ? "busy" : (s.kind ?? "event"),
      })),
    );

    const proj = projectData as ProjectRow;
    const ids = [...new Set([...memberList.map((m) => m.user_id), proj.owner_id])];
    if (ids.length > 0) {
      const { data: profileRows } = await supabase.from("profiles").select("id,display_name").in("id", ids);
      const map: Record<string, string> = {};
      for (const row of profileRows ?? []) map[row.id as string] = ((row.display_name as string | null) ?? "").trim() || "ユーザー";
      setMemberNames(map);
    } else {
      setMemberNames({});
    }

    if (schemaMsgs.length > 0) {
      let banner = `一部機能がまだ使えません（${schemaMsgs.join("・")}）。Supabaseで apply_project_space_upgrade.sql を実行してください。`;
      if (schemaMsgs.some((m) => m.includes("タスク"))) {
        banner += " タスクの状態（中断・保留など）と追加項目を使う場合は apply_project_coaching_phase1.sql も適用してください。";
      }
      setSyncBanner(banner);
    }

    setLoading(false);
  }, [activeDocId, projectId]);

  const saveProjectCoaching = useCallback(
    async (patch: Partial<CoachingContext>) => {
      if (!supabase || !selectedProject) return;
      setActionErr("");
      const prev = parseCoachingContext(selectedProject.coaching_context);
      const next = mergeCoachingContext(prev, patch);
      const { error } = await supabase
        .from("projects")
        .update({ coaching_context: next, updated_at: new Date().toISOString() })
        .eq("id", selectedProject.id);
      if (error) {
        setActionErr(error.message);
        return;
      }
      await load();
    },
    [load, selectedProject],
  );

  const recordTeamActivity = useCallback(async (): Promise<BumpTeamActivityStreakResult | null> => {
    if (!supabase || !selectedProject) return null;
    try {
      return await bumpTeamActivityStreak(supabase, selectedProject.id);
    } catch {
      return null;
    }
  }, [selectedProject]);

  const completeProjectTask = useCallback(
    async (taskId: string) => {
      if (!supabase || !selectedProject) return;
      setActionErr("");
      const existing = projectTasks.find((x) => x.id === taskId);
      if (existing && normalizeTaskStatus(existing.status) === "done") return;

      const prevWeek = countWeekCompletedTasksJapan(projectTasks);
      const goal = parseCoachingContext(selectedProject.coaching_context).weeklyCompletionGoal;

      const { error } = await supabase
        .from("project_tasks")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("project_id", selectedProject.id);
      if (error) {
        setActionErr(error.message);
        return;
      }
      const bump = await recordTeamActivity();
      await load();

      maybeCelebrateWeeklyGoalReached(prevWeek, prevWeek + 1, goal);
      if (bump?.changed) maybeCelebrateStreakMilestone(bump.prevStreak, bump.newStreak);
    },
    [load, recordTeamActivity, selectedProject, projectTasks],
  );

  const skipProjectOnboarding = useCallback(async () => {
    await saveProjectCoaching({ onboardingDoneAt: new Date().toISOString() });
  }, [saveProjectCoaching]);

  const completeProjectOnboarding = useCallback(
    async (data: {
      userSituation: import("@/lib/projects/userSituation").UserSituation;
      dreamText: string;
      progressStage: OnboardingProgressStage;
      teamSize: OnboardingTeamSize;
    }) => {
      if (!supabase || !selectedProject) return;
      setOnboardingSubmitting(true);
      setActionErr("");
      try {
        const prev = parseCoachingContext(selectedProject.coaching_context);
        const dreamTrim = data.dreamText.trim();
        const legacyCategoryMap = {
          festival: "event",
          study: "education",
          startup: "app",
          community: "custom",
          unclear: "custom",
        } as const;
        const next = mergeCoachingContext(prev, {
          onboardingDoneAt: new Date().toISOString(),
          dreamStatement: dreamTrim || prev.dreamStatement,
          userSituation: data.userSituation,
          onboardingBusinessCategory: legacyCategoryMap[data.userSituation],
          onboardingProgressStage: data.progressStage,
          onboardingTeamSize: data.teamSize,
        });
        const { error: uErr } = await supabase
          .from("projects")
          .update({ coaching_context: next, updated_at: new Date().toISOString() })
          .eq("id", selectedProject.id);
        if (uErr) {
          setActionErr(uErr.message);
          return;
        }
        const { buildSituationRoadmapTemplateRowsWithProgress } = await import("@/lib/projects/situationRoadmapTemplates");
        const rows = buildSituationRoadmapTemplateRowsWithProgress(
          selectedProject.id,
          data.userSituation,
          data.progressStage,
        );
        const { error: iErr } = await supabase.from("project_roadmap_steps").insert(rows);
        if (iErr) {
          setActionErr(iErr.message);
          return;
        }
        await load();
      } finally {
        setOnboardingSubmitting(false);
      }
    },
    [load, selectedProject],
  );

  const addSuggestedDailyTasks = useCallback(
    async (
      items: Array<{
        title: string;
        minutes: number;
        estimatedMinutes?: number;
        difficulty?: "すぐできる" | "ちょっと勇気がいる" | "誰かと一緒にやろう";
        fallback?: string;
        priorityLabel?: "今日やるべき" | "今週中にやる" | "余裕があれば";
      }>,
    ) => {
      if (!supabase || !selectedProject || !uid) return;
      setActionErr("");
      const stepId = pickFocusStep(roadmapSteps)?.id ?? null;
      const normalizeEstimate = (m: number): 5 | 15 | 30 | 60 => {
        if (m <= 7) return 5;
        if (m <= 22) return 15;
        if (m <= 45) return 30;
        return 60;
      };
      for (const item of items.slice(0, 3)) {
        const title = item.title.trim().slice(0, 200);
        if (!title) continue;
        const est = normalizeEstimate(item.estimatedMinutes ?? item.minutes);
        const meta = {
          inputKind: "none" as const,
          answerVisibility: "shared" as const,
          estimatedMinutes: est,
          difficulty: item.difficulty,
          fallback: item.fallback?.trim() || undefined,
          priorityLabel: item.priorityLabel,
        };
        const priority =
          item.priorityLabel === "今日やるべき" ? "high" : item.priorityLabel === "今週中にやる" ? "medium" : "low";
        const { error } = await supabase.from("project_tasks").insert({
          project_id: selectedProject.id,
          title,
          description: item.fallback?.trim() ? `困ったとき: ${item.fallback.trim()}` : "",
          status: "not_started",
          priority,
          created_by: uid,
          assignee_id: null,
          due_date: null,
          roadmap_step_id: stepId,
          ai_generated: true,
          meta,
        });
        if (error) {
          setActionErr(error.message);
          return;
        }
      }
      setInviteNotice("AI提案をタスクに追加しました。");
      window.setTimeout(() => setInviteNotice(""), 2800);
      setActiveTab("schedule");
      await load();
    },
    [load, selectedProject, uid, roadmapSteps],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (chatMode === "dm" && !selectedPeerId && peers.length > 0) {
      setSelectedPeerId(peers[0].user_id);
    }
  }, [chatMode, peers, selectedPeerId]);

  useEffect(() => {
    if (!supabase || !selectedProject || !canUseProjectRoom) return;
    const client = supabase;
    const channel = client
      .channel(`project-space-${selectedProject.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_chat_messages", filter: `project_id=eq.${selectedProject.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_direct_messages", filter: `project_id=eq.${selectedProject.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_documents", filter: `project_id=eq.${selectedProject.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_roadmap_steps", filter: `project_id=eq.${selectedProject.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_tasks", filter: `project_id=eq.${selectedProject.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_schedules", filter: `project_id=eq.${selectedProject.id}` }, () => void load())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [load, selectedProject, canUseProjectRoom]);

  useEffect(() => {
    setActionErr("");
  }, [projectId]);

  useEffect(() => {
    if (!headerMenuOpen) return;
    function closeOnOutside(e: MouseEvent) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [headerMenuOpen]);

  useEffect(() => {
    if (!headerMenuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHeaderMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [headerMenuOpen]);

  function clearChatImage() {
    setChatImageFile(null);
    if (chatImagePreview) URL.revokeObjectURL(chatImagePreview);
    setChatImagePreview(null);
    if (chatImageInputRef.current) chatImageInputRef.current.value = "";
  }

  function onChatImageChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (chatImagePreview) URL.revokeObjectURL(chatImagePreview);
    if (!f) {
      setChatImageFile(null);
      setChatImagePreview(null);
      return;
    }
    const err = validateProjectImageFile(f);
    if (err) {
      setActionErr(err);
      e.target.value = "";
      return;
    }
    setChatImageFile(f);
    setChatImagePreview(URL.createObjectURL(f));
  }

  async function sendMessage() {
    if (!supabase || !uid || !selectedProject) return;
    const text = chatDraft.trim();
    if (!text && !chatImageFile) return;

    setChatImageUploading(true);
    setActionErr("");
    try {
      let attachmentUrl: string | null = null;
      if (chatImageFile) {
        const uploaded = await uploadProjectImage(supabase, uid, "project-chat", selectedProject.id, chatImageFile);
        attachmentUrl = uploaded.publicUrl;
      }
      const body = text || (attachmentUrl ? "（画像）" : "");
      if (chatMode === "group") {
        const { error } = await supabase.from("project_chat_messages").insert({
          project_id: selectedProject.id,
          sender_id: uid,
          body,
          attachment_url: attachmentUrl,
        });
        if (error) throw new Error(error.message);
      } else if (selectedPeerId) {
        const payload: Record<string, unknown> = {
          project_id: selectedProject.id,
          sender_id: uid,
          receiver_id: selectedPeerId,
          body,
        };
        if (attachmentUrl) payload.attachment_url = attachmentUrl;
        const { error } = await supabase.from("project_direct_messages").insert(payload);
        if (error) throw new Error(error.message);
      }
      setChatDraft("");
      clearChatImage();
      await load();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "送信に失敗しました。");
    } finally {
      setChatImageUploading(false);
    }
  }

  async function createDocument() {
    setActionErr("");
    if (!supabase) {
      setActionErr("接続設定が見つかりません。");
      return;
    }
    if (!selectedProject) return;
    if (!uid) {
      setActionErr("ドキュメントを作成するにはログインが必要です。");
      return;
    }
    setDocCreating(true);
    try {
      const { data, error } = await supabase
        .from("project_documents")
        .insert({ project_id: selectedProject.id, title: "新しいドキュメント", content: "", updated_by: uid })
        .select("id,title,content,updated_at,updated_by")
        .single();
      if (error) {
        setActionErr(error.message);
        return;
      }
      setActiveDocId(data.id as string);
      setDocTitle((data.title as string) ?? "新しいドキュメント");
      setDocContent((data.content as string) ?? "");
      setActiveTab("documents");
      await load();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "ドキュメントの作成に失敗しました。");
    } finally {
      setDocCreating(false);
    }
  }

  async function saveDocument() {
    if (!supabase || !uid || !activeDocId) return;
    setDocSaving(true);
    try {
      const title = docTitle.trim() || "無題";
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("project_documents")
        .update({ title, content: docContent, updated_by: uid, updated_at: now })
        .eq("id", activeDocId);
      if (error) setActionErr(error.message);
      else {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === activeDocId ? { ...d, title, content: docContent, updated_at: now, updated_by: uid } : d,
          ),
        );
      }
    } finally {
      setDocSaving(false);
    }
  }

  async function submitSchedule(payload: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    attendees: string;
    kind?: "event" | "busy";
  }) {
    if (!supabase || !selectedProject || !uid || !payload.title.trim() || !payload.startsAt) return;
    setScheduleSaving(true);
    try {
      const kind: ScheduleKind = payload.kind === "busy" ? "busy" : "event";
      const attendees =
        kind === "busy" ? [] : payload.attendees.split(/[,、]/).map((x) => x.trim()).filter(Boolean);
      const description = encodeScheduleDescription(kind, payload.description);
      const baseRow = {
        project_id: selectedProject.id,
        title: payload.title.trim(),
        description,
        starts_at: new Date(payload.startsAt).toISOString(),
        ends_at: payload.endsAt ? new Date(payload.endsAt).toISOString() : null,
        attendees,
        created_by: uid,
      };
      let { error } = await supabase.from("project_schedules").insert({ ...baseRow, kind });
      if (error && /kind|column/i.test(error.message)) {
        ({ error } = await supabase.from("project_schedules").insert(baseRow));
      }
      if (error) setActionErr(error.message);
      await load();
    } finally {
      setScheduleSaving(false);
    }
  }

  async function deleteSchedule(scheduleId: string) {
    if (!supabase || !selectedProject || !scheduleId) return;
    setScheduleSaving(true);
    try {
      const { error } = await supabase
        .from("project_schedules")
        .delete()
        .eq("id", scheduleId)
        .eq("project_id", selectedProject.id);
      if (error) setActionErr(error.message);
      await load();
    } finally {
      setScheduleSaving(false);
    }
  }

  async function reviewJoinRequest(requestId: string, action: "accept" | "reject") {
    if (!supabase) return;
    const { error } = await supabase.rpc("project_review_join_request", { p_request_id: requestId, p_action: action });
    if (error) setActionErr(error.message);
    await load();
  }

  async function submitJoinRequest() {
    if (!supabase || !uid || !selectedProject) return;
    setActionErr("");
    setJoinBusy(true);
    try {
      const { error } = await supabase.from("project_join_requests").insert({
        project_id: selectedProject.id,
        requester_id: uid,
        message: joinMessageDraft.trim() || "参加したいです",
      });
      if (error) setActionErr(error.message);
      else setJoinMessageDraft("");
      await load();
    } finally {
      setJoinBusy(false);
    }
  }

  function openGroupProfileEditor() {
    if (!selectedProject) return;
    setEditNameDraft(selectedProject.name);
    setEditThumbDraft(selectedProject.thumbnail_url?.trim() ?? "");
    setEditDescriptionDraft(selectedProject.description ?? "");
    setEditCategoryDraft(selectedProject.category ?? "");
    setEditBusinessTypeDraft(
      selectedProject.business_type === "maker" || selectedProject.business_type === "social"
        ? selectedProject.business_type
        : "software",
    );
    setEditRecruitmentTargetDraft(selectedProject.recruitment_target ?? "");
    setEditRecruitmentMessageDraft(selectedProject.recruitment_message ?? "");
    setGroupProfileOpen(true);
  }

  async function saveProjectProfile() {
    if (!supabase || !selectedProject || !canEditProjectSettings) return;
    const name = editNameDraft.trim();
    if (!name) {
      setActionErr("プロジェクト名を入力してください。");
      return;
    }
    setProjectSaving(true);
    setActionErr("");
    try {
      const thumbnail_url = editThumbDraft.trim() || null;
      const { error } = await supabase
        .from("projects")
        .update({
          name,
          thumbnail_url,
          description: editDescriptionDraft.trim(),
          category: editCategoryDraft.trim() || "探究",
          business_type: editBusinessTypeDraft,
          recruitment_target: editRecruitmentTargetDraft.trim(),
          recruitment_message: editRecruitmentMessageDraft.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedProject.id);
      if (error) setActionErr(error.message);
      else {
        setGroupProfileOpen(false);
        setInviteNotice("グループプロフィールを保存しました。");
        window.setTimeout(() => setInviteNotice(""), 3200);
        await load();
      }
    } finally {
      setProjectSaving(false);
    }
  }

  async function transferProjectOwner() {
    if (!supabase || !selectedProject || !uid || !isOwner) return;
    if (!transferTargetId) {
      setActionErr("引き継ぎ先のメンバーを選んでください。");
      return;
    }
    setTransferBusy(true);
    setActionErr("");
    try {
      const { error } = await supabase.rpc("transfer_project_owner", {
        p_project_id: selectedProject.id,
        p_new_owner_id: transferTargetId,
      });
      if (error) {
        setActionErr(error.message);
        return;
      }
      setTransferOwnerOpen(false);
      setTransferTargetId("");
      setInviteNotice("オーナーを切り替えました。");
      window.setTimeout(() => setInviteNotice(""), 3200);
      await load();
    } finally {
      setTransferBusy(false);
    }
  }

  async function dissolveProject() {
    if (!supabase || !selectedProject || !isOwner) return;
    setProjectDeleting(true);
    setActionErr("");
    try {
      const { error } = await supabase.from("projects").delete().eq("id", selectedProject.id);
      if (error) setActionErr(error.message);
      else {
        setDissolveOpen(false);
        router.push("/");
      }
    } finally {
      setProjectDeleting(false);
    }
  }

  useEffect(() => {
    if (!activeDoc) return;
    setDocTitle(activeDoc.title);
    setDocContent(activeDoc.content ?? "");
  }, [activeDoc]);

  if (loading) return <main className="mx-auto max-w-5xl p-4 text-sm text-zinc-600">プロジェクトを読み込み中...</main>;
  if (!selectedProject)
    return (
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-sm leading-relaxed text-rose-700">{syncBanner || "プロジェクトが見つかりません。"}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
            ホームへ戻る
          </Link>
          <Link href="/projects" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700">
            /projects を開く
          </Link>
        </div>
      </main>
    );

  if (showVisitorPreview) {
    return (
      <main className="mx-auto max-w-lg space-y-5 px-4 py-6 sm:py-8">
        <Link href="/" className="inline-block text-sm font-medium text-zinc-500 hover:text-zinc-800">
          ← ホームへ戻る
        </Link>

        {syncBanner ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{syncBanner}</p>
        ) : null}
        {actionErr ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionErr}</p> : null}

        <header>
          <p className="text-xs font-medium text-zinc-500">{selectedProject.visibility === "public" ? "公開プロジェクト" : "非公開プロジェクト"}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">{selectedProject.name}</h1>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">プロジェクトの説明</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{selectedProject.description?.trim() || "—"}</p>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">オーナー</h2>
          <p className="mt-2 text-lg font-semibold text-zinc-900">{memberNames[selectedProject.owner_id] ?? "オーナー"}</p>

          <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-400">企業理念・ビジョン</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
            {(selectedProject.recruitment_message || "").trim() || "—"}
          </p>
          {selectedProject.recruitment_target?.trim() ? (
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-600">
              <span className="font-semibold text-zinc-700">募集したい仲間・姿勢: </span>
              {selectedProject.recruitment_target}
            </p>
          ) : null}
        </section>

        {selectedProject.visibility === "public" ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-emerald-950">参加する</h2>
            <p className="mt-1 text-xs leading-relaxed text-emerald-900/85">
              ログイン後に参加申請できます。承認されるとチャット・ドキュメントなどフル機能が使えます。
            </p>
            {uid ? (
              myJoinPending ? (
                <p className="mt-4 text-center text-sm font-semibold text-emerald-900">参加申請済みです。承認をお待ちください。</p>
              ) : (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-emerald-200/80 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                    placeholder="一言メッセージ（任意）"
                    value={joinMessageDraft}
                    onChange={(e) => setJoinMessageDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={joinBusy}
                    onClick={() => void submitJoinRequest()}
                    className="min-h-[44px] rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {joinBusy ? "送信中…" : "参加申請を送る"}
                  </button>
                </div>
              )
            ) : (
              <div className="mt-4">
                <Link
                  href="/"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-semibold text-white"
                >
                  ログインして参加申請へ
                </Link>
                <p className="mt-2 text-[11px] text-emerald-900/70">アカウントでログイン後、もう一度このページを開いてください。</p>
              </div>
            )}
          </section>
        ) : (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-600">
            このプロジェクトは非公開です。メンバーとして招待されたアカウントだけが中に入れます。
          </p>
        )}
      </main>
    );
  }

  const contentWidthClass =
    activeTab === "documents"
      ? "max-w-6xl"
      : activeTab === "schedule"
        ? "max-w-xl"
        : activeTab === "home"
          ? "max-w-lg"
          : "max-w-lg";

  return (
    <div className="startup-project-shell flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200/90 bg-white/95 shadow-sm backdrop-blur-md">
        <div className={`mx-auto w-full ${contentWidthClass} px-3 pt-3`}>
          <div className="flex items-start gap-2">
            <Link
              href="/"
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg leading-none text-zinc-800 shadow-sm transition hover:bg-zinc-50"
              aria-label="戻る"
            >
              ←
            </Link>
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-indigo-50 shadow-inner ring-1 ring-indigo-100">
                {selectedProject.thumbnail_url?.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ユーザー指定の任意URL
                  <img
                    src={selectedProject.thumbnail_url.trim()}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl">{projectIconEmoji(selectedProject.business_type)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-bold leading-tight tracking-tight text-zinc-900">{selectedProject.name}</h1>
                <p className="mt-0.5 truncate text-xs text-zinc-500">{buildProjectSubtitle(selectedProject, members.length)}</p>
              </div>
              {canUseProjectRoom ? (
                <div className="flex shrink-0 items-start gap-0.5">
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                    title="カレンダー"
                    aria-label="カレンダー"
                    onClick={() => setCalendarOpen(true)}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M16 3v4M8 3v4M3 11h18" />
                    </svg>
                  </button>
                  <div className="relative" ref={headerMenuRef}>
                    <button
                      type="button"
                      className={`flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition ${
                        headerMenuOpen ? "border-indigo-300 bg-indigo-50 text-indigo-900" : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                      }`}
                      title="メニュー"
                      aria-expanded={headerMenuOpen}
                      aria-haspopup="true"
                      aria-label="メニューを開く"
                      onClick={() => setHeaderMenuOpen((v) => !v)}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
                        <line x1="5" y1="7" x2="19" y2="7" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <line x1="5" y1="17" x2="19" y2="17" />
                      </svg>
                    </button>
                    {headerMenuOpen ? (
                      <div
                        className="absolute right-0 top-[calc(100%+6px)] z-[80] w-[min(calc(100vw-2rem),17rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-xl"
                        role="menu"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full px-4 py-3 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            setInviteNotice("マイプロジェクトの🔔から、表示名で検索して招待できます（URLは使いません）。");
                            window.setTimeout(() => setInviteNotice(""), 4200);
                          }}
                        >
                          メンバーを招待（通知）
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full px-4 py-3 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            router.push("/projects");
                          }}
                        >
                          🔔 通知・招待を開く
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full px-4 py-3 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            setActiveTab("members");
                          }}
                        >
                          メンバー
                        </button>
                        {canEditProjectSettings ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full px-4 py-3 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                            onClick={() => {
                              openGroupProfileEditor();
                              setHeaderMenuOpen(false);
                            }}
                          >
                            グループプロフィール
                          </button>
                        ) : null}
                        {isOwner ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full px-4 py-3 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                            onClick={() => {
                              setTransferTargetId("");
                              setTransferOwnerOpen(true);
                              setHeaderMenuOpen(false);
                            }}
                          >
                            オーナー切り替え
                          </button>
                        ) : null}
                        {isOwner ? (
                          <>
                            <div className="my-1 border-t border-zinc-100" />
                            <button
                              type="button"
                              role="menuitem"
                              className="flex w-full px-4 py-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
                              onClick={() => {
                                setHeaderMenuOpen(false);
                                setDissolveOpen(true);
                              }}
                            >
                              プロジェクトを解散
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <nav className="mt-2 flex border-b border-zinc-200/80" aria-label="プロジェクト">
            {primaryTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-1 px-1 pb-2.5 pt-2 text-center text-xs font-semibold transition duration-200 ease-out sm:text-sm ${
                  activeTab === tab.key ? "text-[#1A1A1A]" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {tab.label}
                {activeTab === tab.key ? (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#FF5C35]" aria-hidden />
                ) : null}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {syncBanner ? (
        <p className={`mx-auto w-full ${contentWidthClass} px-3 pt-2 text-sm text-amber-900`}>
          <span className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">{syncBanner}</span>
        </p>
      ) : null}
      {inviteNotice ? (
        <p className={`mx-auto w-full ${contentWidthClass} px-3 pt-2 text-sm text-emerald-900`}>
          <span className="block rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">{inviteNotice}</span>
        </p>
      ) : null}
      {actionErr ? (
        <p className={`mx-auto w-full ${contentWidthClass} px-3 pt-2 text-sm text-rose-700`}>
          <span className="block rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">{actionErr}</span>
        </p>
      ) : null}

      <div className={`mx-auto flex min-h-0 w-full ${contentWidthClass} flex-1 flex-col overflow-hidden`}>
        {activeTab === "chat" ? (
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200/80 bg-white/60 px-3 py-2">
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  chatMode === "group" ? "bg-indigo-700 text-white shadow-sm" : "bg-zinc-100 text-zinc-700"
                }`}
                onClick={() => setChatMode("group")}
              >
                全体
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  chatMode === "dm" ? "bg-indigo-700 text-white shadow-sm" : "bg-zinc-100 text-zinc-700"
                }`}
                onClick={() => setChatMode("dm")}
              >
                メンバー別
              </button>
            </div>
            {chatMode === "dm" ? (
              <div className="shrink-0 border-b border-zinc-200/60 bg-white/40 px-3 py-2">
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                  {peers.map((m) => (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => setSelectedPeerId(m.user_id)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
                        selectedPeerId === m.user_id
                          ? "border-indigo-700 bg-indigo-700 text-white"
                          : "border-zinc-200 bg-white text-zinc-700"
                      }`}
                    >
                      {memberNames[m.user_id] ?? m.user_id.slice(0, 6)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div ref={chatScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#ebebed] px-3 py-3">
              {dmMessages.length === 0 ? (
                <p className="py-16 text-center text-sm text-zinc-500">まだ会話がありません。最初のメッセージを送ってみよう。</p>
              ) : null}
              {dmMessages.map((m) => {
                const mine = m.sender_id === uid;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-[1.15rem] px-3.5 py-2.5 text-sm leading-snug shadow-sm ${
                        mine
                          ? "rounded-tr-md bg-indigo-700 text-white"
                          : "rounded-tl-md bg-zinc-200/90 text-zinc-900"
                      }`}
                    >
                      {!mine ? <p className="mb-1 text-[10px] font-semibold text-zinc-600">{memberNames[m.sender_id] ?? "メンバー"}</p> : null}
                      {m.attachment_url ? (
                        <a
                          href={m.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-1 block overflow-hidden rounded-lg"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- チャット添付 */}
                          <img src={m.attachment_url} alt="添付画像" className="max-h-52 w-full object-cover" />
                        </a>
                      ) : null}
                      {m.body && m.body !== "（画像）" ? (
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      ) : null}
                      <p className={`mt-1.5 text-[10px] ${mine ? "text-indigo-100" : "text-zinc-500"}`}>
                        {new Date(m.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="shrink-0 border-t border-zinc-200/80 bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <div className="relative mb-1 flex justify-end">
                <button
                  type="button"
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 shadow-sm hover:bg-zinc-100"
                  onClick={() => {
                    const el = chatScrollRef.current;
                    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                  }}
                  aria-label="最新へ"
                >
                  ↓ 最新
                </button>
              </div>
              {chatImagePreview ? (
                <div className="relative mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 選択プレビュー */}
                  <img src={chatImagePreview} alt="" className="max-h-32 w-full object-cover" />
                  <button
                    type="button"
                    className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white"
                    onClick={clearChatImage}
                    aria-label="画像を取り消す"
                  >
                    取消
                  </button>
                </div>
              ) : null}
              {chatImageUploading ? (
                <p className="mb-2 text-center text-xs font-medium text-indigo-700">画像をアップロード中…</p>
              ) : null}
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
              >
                <input
                  ref={chatImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  capture="environment"
                  className="hidden"
                  onChange={onChatImageChange}
                  aria-hidden
                />
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-lg text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                  onClick={() => chatImageInputRef.current?.click()}
                  disabled={chatImageUploading}
                  aria-label="写真を選ぶ"
                  title="写真を選ぶ"
                >
                  📷
                </button>
                <div className="relative min-w-0 flex-1">
                  <input
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 py-3 pl-4 pr-12 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none ring-indigo-300/0 transition focus:border-indigo-400 focus:bg-white focus:ring-2"
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    placeholder="メッセージを送る…"
                    aria-label="メッセージ"
                    disabled={chatImageUploading}
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-indigo-700 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-800 disabled:opacity-40"
                    disabled={chatImageUploading || (!chatDraft.trim() && !chatImageFile)}
                    aria-label="送信"
                  >
                    ↑
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : activeTab === "documents" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-2">
        <ProjectGoogleDocsShell
          activeDocId={activeDocId}
          documents={documents.map((d) => ({ id: d.id, content: d.content ?? "" }))}
          docTitle={docTitle}
          onDocTitleChange={setDocTitle}
          onDocContentChange={setDocContent}
          onSave={() => saveDocument()}
          saving={docSaving}
          wordCount={docWordCount}
          updatedByLabel={
            activeDoc?.updated_by ? (memberNames[activeDoc.updated_by] ?? "メンバー") : "—"
          }
          sidebar={
            <aside className="flex min-h-0 flex-col space-y-3">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#dadce0] pb-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#202124]">ドキュメント</p>
                  <p className="text-[11px] text-[#5f6368]">{documents.length} 件</p>
                </div>
                <button
                  type="button"
                  disabled={docCreating}
                  onClick={() => void createDocument()}
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white shadow-sm disabled:opacity-60"
                  style={{ background: "#1a73e8" }}
                >
                  {docCreating ? "作成中…" : "+ 新規"}
                </button>
              </div>
              {documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#dadce0] bg-[#f8f9fa] px-3 py-8 text-center">
                  <p className="text-sm font-medium text-[#202124]">ドキュメントがありません</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#5f6368]">「+ 新規」で議事録や企画メモを作成できます。</p>
                </div>
              ) : (
                <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                  {documents.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setActiveDocId(d.id)}
                        className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2.5 text-left transition ${
                          activeDocId === d.id
                            ? "border-[#1a73e8] bg-[#e8f0fe] shadow-sm"
                            : "border-transparent hover:bg-[#f1f3f4]"
                        }`}
                      >
                        <span className="mt-0.5 shrink-0 text-[#5f6368]" aria-hidden>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#4285f4">
                            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[13px] ${activeDocId === d.id ? "font-semibold text-[#174ea6]" : "text-[#202124]"}`}>
                            {d.title || "無題のドキュメント"}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-[#5f6368]">
                            更新{" "}
                            {new Date(d.updated_at).toLocaleString("ja-JP", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {d.updated_by ? (
                            <span className="mt-0.5 block truncate text-[10px] text-[#80868b]">
                              {memberNames[d.updated_by] ?? "メンバー"}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          }
        />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {activeTab === "home" && selectedProject ? (
        <ProjectHomePanel
          project={selectedProject}
          coaching={parseCoachingContext(selectedProject.coaching_context)}
          steps={roadmapSteps}
          tasks={projectTasks}
          memberNames={memberNames}
          canEdit={Boolean(isMember || isOwner)}
          onOpenRoadmap={() => setActiveTab("roadmap")}
          onOpenTasks={() => setActiveTab("schedule")}
          onOpenWeeklyMemo={() => {
            window.location.hash = "weekly-review";
            setActiveTab("schedule");
          }}
          onShareTeam={async () => {
            setInviteNotice("マイプロジェクトの🔔から表示名で検索して招待できます。");
            window.setTimeout(() => setInviteNotice(""), 3200);
            router.push("/projects");
          }}
          onCompleteTask={(id) => void completeProjectTask(id)}
          onAddAiTodoSuggestions={(items) => void addSuggestedDailyTasks(items)}
          onSaveCoaching={(patch) => saveProjectCoaching(patch)}
        />
      ) : null}

      {activeTab === "roadmap" && selectedProject ? (
        <ProjectRoadmapPanel
          projectId={selectedProject.id}
          project={selectedProject}
          uid={uid}
          steps={roadmapSteps}
          tasks={projectTasks}
          members={members}
          memberNames={memberNames}
          canEdit={Boolean(isMember || isOwner)}
          onSaveCoaching={(patch) => saveProjectCoaching(patch)}
          onRecordTeamActivity={() => recordTeamActivity()}
          onReload={() => void load()}
          onError={(msg) => setActionErr(msg)}
        />
      ) : null}

      {activeTab === "schedule" && selectedProject ? (
        <ProjectTasksPanel
          projectId={selectedProject.id}
          projectTitle={selectedProject.name}
          projectDescription={selectedProject.description ?? ""}
          coachingContext={parseCoachingContext(selectedProject.coaching_context)}
          roadmapStepsBrief={roadmapSteps.map((s) => ({ id: s.id, title: s.title, status: s.status }))}
          focusRoadmapStepId={pickFocusStep(roadmapSteps)?.id ?? null}
          nextMilestoneTitle={pickFocusStep(roadmapSteps)?.title ?? null}
          milestoneDoneCount={roadmapSteps.filter((s) => s.status === "done").length}
          milestoneTotal={roadmapSteps.length}
          onSaveCoaching={(patch) => saveProjectCoaching(patch)}
          onNavigateToChat={() => setActiveTab("chat")}
          tasks={projectTasks}
          uid={uid}
          canEdit={Boolean(isMember || isOwner)}
          memberNames={memberNames}
          onRecordTeamActivity={() => recordTeamActivity()}
          onReload={() => void load()}
          onError={(msg) => setActionErr(msg)}
          roadmapStepTitles={Object.fromEntries(roadmapSteps.map((s) => [s.id, s.title]))}
          schedules={schedules}
          scheduleSaving={scheduleSaving}
          onSaveSchedule={(p) => submitSchedule(p)}
          onDeleteSchedule={(id) => deleteSchedule(id)}
        />
      ) : null}

      {activeTab === "members" ? (
        <section className="grid gap-3 md:grid-cols-2">
          {uid && !isMember && selectedProject.visibility === "public" ? (
            <div className="md:col-span-2 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">このプロジェクトに参加する</h3>
              <p className="mt-1 text-xs text-zinc-600">
                公開プロジェクトのため参加申請できます。オーナー／管理者が承認するとメンバーになります（データ上の人数上限はありません）。
              </p>
              {myJoinPending ? (
                <p className="mt-3 text-sm font-medium text-sky-900">申請済みです。承認をお待ちください。</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                    placeholder="一言メッセージ（任意）"
                    value={joinMessageDraft}
                    onChange={(e) => setJoinMessageDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={joinBusy}
                    onClick={() => void submitJoinRequest()}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {joinBusy ? "送信中…" : "参加申請を送る"}
                  </button>
                </div>
              )}
            </div>
          ) : null}
          {uid && !isMember && selectedProject.visibility === "private" ? (
            <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              このプロジェクトは非公開です。オーナーがメンバーに追加したアカウントだけが参加できます（この画面からの申請は公開プロジェクトのみです）。
            </div>
          ) : null}
          <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900">メンバー</h3>
            <ul className="mt-2 space-y-2">
              {members.map((m) => (
                <li key={m.user_id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                  <p className="font-semibold text-zinc-900">{memberNames[m.user_id] ?? m.user_id.slice(0, 8)}</p>
                  <p className="text-xs text-zinc-500">{m.role}</p>
                </li>
              ))}
            </ul>
          </div>
          {canModerateJoinRequests ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">参加申請（承認・拒否）</h3>
              <ul className="mt-2 space-y-2">
                {joinRequests.map((r) => (
                  <li key={r.id} className="rounded-lg border border-zinc-200 px-3 py-2">
                    <p className="text-xs text-zinc-500">{memberNames[r.requester_id] ?? r.requester_id.slice(0, 8)}</p>
                    <p className="text-sm text-zinc-800">{r.message}</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => void reviewJoinRequest(r.id, "accept")} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white">
                        承認
                      </button>
                      <button type="button" onClick={() => void reviewJoinRequest(r.id, "reject")} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700">
                        拒否
                      </button>
                    </div>
                  </li>
                ))}
                {joinRequests.length === 0 ? <li className="text-sm text-zinc-500">承認待ちはありません。</li> : null}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
          </div>
        )}
      </div>

      {calendarOpen && selectedProject && canUseProjectRoom ? (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          onClick={() => setCalendarOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <h3 className="text-base font-bold text-zinc-900">カレンダー</h3>
              <button type="button" className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50" onClick={() => setCalendarOpen(false)}>
                閉じる
              </button>
            </div>
            <div className="max-h-[min(78vh,620px)] overflow-y-auto px-2 pb-4 pt-2">
              <ProjectScheduleCalendar
                schedules={schedules}
                onSave={async (p) => {
                  await submitSchedule(p);
                }}
                onDelete={async (id) => {
                  await deleteSchedule(id);
                }}
                saving={scheduleSaving}
                canEdit={Boolean(isMember || isOwner)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {groupProfileOpen && selectedProject ? (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          onClick={() => !projectSaving && setGroupProfileOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-zinc-900">グループプロフィール</h3>
            <p className="mt-1 text-xs text-zinc-500">名前・写真・説明・系統・募集内容を編集できます。</p>
            <label className="mt-4 block text-xs font-semibold text-zinc-700">プロジェクト名</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={editNameDraft}
              onChange={(e) => setEditNameDraft(e.target.value)}
            />
            <label className="mt-3 block text-xs font-semibold text-zinc-700">写真（画像URL）</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              placeholder="https://..."
              value={editThumbDraft}
              onChange={(e) => setEditThumbDraft(e.target.value)}
            />
            <label className="mt-3 block text-xs font-semibold text-zinc-700">説明</label>
            <textarea
              className="mt-1 min-h-[4.5rem] w-full resize-y rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={editDescriptionDraft}
              onChange={(e) => setEditDescriptionDraft(e.target.value)}
            />
            <label className="mt-3 block text-xs font-semibold text-zinc-700">カテゴリ</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={editCategoryDraft}
              onChange={(e) => setEditCategoryDraft(e.target.value)}
            />
            <label className="mt-3 block text-xs font-semibold text-zinc-700">何系のプロジェクトか</label>
            <select
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={editBusinessTypeDraft}
              onChange={(e) => setEditBusinessTypeDraft(e.target.value as "maker" | "software" | "social")}
            >
              <option value="software">ソフトウェア・アプリ</option>
              <option value="maker">ものづくり・物販</option>
              <option value="social">社会課題・コミュニティ</option>
            </select>
            <label className="mt-3 block text-xs font-semibold text-zinc-700">欲しい仲間・姿勢</label>
            <textarea
              className="mt-1 min-h-[3rem] w-full resize-y rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={editRecruitmentTargetDraft}
              onChange={(e) => setEditRecruitmentTargetDraft(e.target.value)}
            />
            <label className="mt-3 block text-xs font-semibold text-zinc-700">理念・ビジョン</label>
            <textarea
              className="mt-1 min-h-[3rem] w-full resize-y rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={editRecruitmentMessageDraft}
              onChange={(e) => setEditRecruitmentMessageDraft(e.target.value)}
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                onClick={() => setGroupProfileOpen(false)}
                disabled={projectSaving}
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={projectSaving}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void saveProjectProfile()}
              >
                {projectSaving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {transferOwnerOpen && selectedProject ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          onClick={() => !transferBusy && setTransferOwnerOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-zinc-900">オーナー切り替え</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              引き継ぎ先はプロジェクトの既存メンバーから選びます。あなたは管理者になります。
            </p>
            <label className="mt-4 block text-xs font-semibold text-zinc-700">新しいオーナー</label>
            <select
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={transferTargetId}
              onChange={(e) => setTransferTargetId(e.target.value)}
            >
              <option value="">メンバーを選択…</option>
              {members
                .filter((m) => m.user_id !== uid)
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {memberNames[m.user_id] ?? m.user_id.slice(0, 8)}
                  </option>
                ))}
            </select>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                onClick={() => setTransferOwnerOpen(false)}
                disabled={transferBusy}
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={transferBusy || !transferTargetId}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  if (!window.confirm("オーナーを切り替えます。よろしいですか？")) return;
                  void transferProjectOwner();
                }}
              >
                {transferBusy ? "処理中…" : "切り替える"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dissolveOpen && selectedProject ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !projectDeleting && setDissolveOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-rose-900">プロジェクトを解散しますか？</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              削除するとチャット・ドキュメント・タスクなどすべて失われ、元に戻せません。オーナーのみ実行できます。
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={projectDeleting}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50"
                onClick={() => setDissolveOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={projectDeleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void dissolveProject()}
              >
                {projectDeleting ? "削除中…" : "解散する"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showProjectOnboarding && selectedProject ? (
        <ProjectOnboardingWizard
          projectName={selectedProject.name}
          submitting={onboardingSubmitting}
          onSkip={() => void skipProjectOnboarding()}
          onComplete={(data) => void completeProjectOnboarding(data)}
        />
      ) : null}
    </div>
  );
}
