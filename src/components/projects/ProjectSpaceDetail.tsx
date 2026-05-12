"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ProjectMemberRow, ProjectRow } from "@/lib/projects/types";
import { isValidProjectUuid, normalizeProjectIdParam } from "@/lib/projects/validateProjectId";
import { copyProjectInviteUrl, shareOrCopyProject } from "@/lib/projects/inviteLink";
import { ProjectRoadmapPanel, type RoadmapStepFull } from "@/components/projects/ProjectRoadmapPanel";
import { ProjectTasksPanel, type TaskPanelRow } from "@/components/projects/ProjectTasksPanel";
import { ProjectGoogleDocsShell } from "@/components/projects/ProjectGoogleDocsShell";
import { ProjectScheduleCalendar } from "@/components/projects/ProjectScheduleCalendar";

type Props = { projectId: string };
type TabKey = "chat" | "documents" | "roadmap" | "schedule" | "members";
type ChatMode = "group" | "dm";

type ProjectDocumentRow = {
  id: string;
  title: string;
  content: string;
  updated_at: string;
  updated_by: string | null;
  created_at: string;
};
type ProjectTaskLite = TaskPanelRow;
type ScheduleRow = { id: string; title: string; description: string; starts_at: string; ends_at: string | null; attendees: string[] | null };
type MessageRow = { id: string; sender_id: string; receiver_id?: string | null; body: string; created_at: string };

/** メインタブ（モック: チャット / ロードマップ / タスク / ドキュメント）。メンバーはヘッダーから */
const primaryTabs: Array<{ key: TabKey; label: string }> = [
  { key: "chat", label: "チャット" },
  { key: "roadmap", label: "ロードマップ" },
  { key: "schedule", label: "タスク" },
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

function formatDocStamp(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
  const [activeTab, setActiveTab] = useState<TabKey>("chat");
  const [chatMode, setChatMode] = useState<ChatMode>("group");
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [groupMessages, setGroupMessages] = useState<MessageRow[]>([]);
  const [directMessages, setDirectMessages] = useState<MessageRow[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
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
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [dissolveOpen, setDissolveOpen] = useState(false);
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectDeleting, setProjectDeleting] = useState(false);
  const [editNameDraft, setEditNameDraft] = useState("");
  const [editThumbDraft, setEditThumbDraft] = useState("");
  const [editDescDraft, setEditDescDraft] = useState("");
  const [editCategoryDraft, setEditCategoryDraft] = useState("");
  const [editTagsDraft, setEditTagsDraft] = useState("");
  const [editBusinessDraft, setEditBusinessDraft] = useState<"maker" | "software" | "social">("software");
  const [editRecruitTargetDraft, setEditRecruitTargetDraft] = useState("");
  const [editRecruitMsgDraft, setEditRecruitMsgDraft] = useState("");
  const [ownerTransferOpen, setOwnerTransferOpen] = useState(false);
  const [ownerTransferPick, setOwnerTransferPick] = useState<string | null>(null);
  const [ownerTransferSaving, setOwnerTransferSaving] = useState(false);
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
      supabase.from("project_chat_messages").select("id,sender_id,body,created_at").eq("project_id", normalizedId).order("created_at", { ascending: true }).limit(200),
      supabase.from("project_direct_messages").select("id,sender_id,receiver_id,body,created_at").eq("project_id", normalizedId).order("created_at", { ascending: true }).limit(200),
      supabase.from("project_documents").select("id,title,content,updated_at,updated_by,created_at").eq("project_id", normalizedId).order("updated_at", { ascending: false }),
      supabase
        .from("project_roadmap_steps")
        .select("id,title,status,position,description,due_date,owner_id,notes,created_at,updated_at")
        .eq("project_id", normalizedId)
        .order("position", { ascending: true }),
      supabase.from("project_schedules").select("id,title,description,starts_at,ends_at,attendees").eq("project_id", normalizedId).order("starts_at", { ascending: true }),
      supabase
        .from("project_tasks")
        .select("id,title,description,status,priority,due_date,roadmap_step_id,meta,updated_at")
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
    const docRows = ((docRes.data ?? []) as ProjectDocumentRow[]).map((d) => ({
      ...d,
      created_at: d.created_at || d.updated_at,
    }));
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
        .select("id,title,description,status,priority,due_date,roadmap_step_id,updated_at")
        .eq("project_id", normalizedId);
      if (!retry.error) {
        taskRows = (retry.data ?? []).map((r) => ({ ...(r as ProjectTaskLite), meta: {} }));
      } else if (isSchemaError(tasksRes.error) || isSchemaError(retry.error)) {
        schemaMsgs.push("プロジェクトタスク（ロードマップ連携）");
      }
    }
    setProjectTasks(taskRows);

    if (isSchemaError(scheduleRes.error)) schemaMsgs.push("スケジュール");
    setSchedules((scheduleRes.data ?? []) as ScheduleRow[]);

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
      setSyncBanner(`一部機能がまだ使えません（${schemaMsgs.join("・")}）。Supabaseで apply_project_space_upgrade.sql を実行してください。`);
    }

    setLoading(false);
  }, [activeDocId, projectId]);

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

  async function sendMessage() {
    if (!supabase || !uid || !selectedProject || !chatDraft.trim()) return;
    if (chatMode === "group") {
      const { error } = await supabase.from("project_chat_messages").insert({ project_id: selectedProject.id, sender_id: uid, body: chatDraft.trim() });
      if (error) setActionErr(error.message);
    } else if (selectedPeerId) {
      const { error } = await supabase
        .from("project_direct_messages")
        .insert({ project_id: selectedProject.id, sender_id: uid, receiver_id: selectedPeerId, body: chatDraft.trim() });
      if (error) setActionErr(error.message);
    }
    setChatDraft("");
    await load();
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
        .select("id,title,content,updated_at,updated_by,created_at")
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
            d.id === activeDocId ? { ...d, title, content: docContent, updated_at: now, updated_by: uid, created_at: d.created_at } : d,
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
  }) {
    if (!supabase || !selectedProject || !uid || !payload.title.trim() || !payload.startsAt) return;
    setScheduleSaving(true);
    try {
      const attendees = payload.attendees.split(/[,、]/).map((x) => x.trim()).filter(Boolean);
      const { error } = await supabase.from("project_schedules").insert({
        project_id: selectedProject.id,
        title: payload.title.trim(),
        description: payload.description.trim(),
        starts_at: new Date(payload.startsAt).toISOString(),
        ends_at: payload.endsAt ? new Date(payload.endsAt).toISOString() : null,
        attendees,
        created_by: uid,
      });
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
    setEditDescDraft(selectedProject.description ?? "");
    setEditCategoryDraft(selectedProject.category ?? "");
    setEditTagsDraft((selectedProject.tags ?? []).join(", "));
    const bt = selectedProject.business_type;
    setEditBusinessDraft(bt === "maker" || bt === "social" || bt === "software" ? bt : "software");
    setEditRecruitTargetDraft(selectedProject.recruitment_target ?? "");
    setEditRecruitMsgDraft(selectedProject.recruitment_message ?? "");
    setEditProjectOpen(true);
  }

  async function saveGroupProfile() {
    if (!supabase || !selectedProject || !canEditProjectSettings) return;
    setProjectSaving(true);
    setActionErr("");
    try {
      const name = editNameDraft.trim();
      if (name.length < 1 || name.length > 120) {
        setActionErr("プロジェクト名は1〜120文字で入力してください。");
        return;
      }
      const thumb = editThumbDraft.trim();
      if (thumb && !/^https:\/\//i.test(thumb)) {
        setActionErr("写真URLは https で始まる必要があります。");
        return;
      }
      const tags = editTagsDraft
        .split(/[,、]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 32);
      const description = editDescDraft.trim();
      if (description.length > 12000) {
        setActionErr("説明文が長すぎます（12000文字以内）。");
        return;
      }
      const { error } = await supabase
        .from("projects")
        .update({
          name,
          thumbnail_url: thumb || null,
          description,
          category: editCategoryDraft.trim() || "探究",
          tags,
          business_type: editBusinessDraft,
          recruitment_target: editRecruitTargetDraft.trim(),
          recruitment_message: editRecruitMsgDraft.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedProject.id);
      if (error) setActionErr(error.message);
      else {
        setEditProjectOpen(false);
        setInviteNotice("保存しました。");
        window.setTimeout(() => setInviteNotice(""), 2600);
        await load();
      }
    } finally {
      setProjectSaving(false);
    }
  }

  async function submitOwnerTransfer() {
    if (!supabase || !selectedProject || !uid || !ownerTransferPick || !isOwner) return;
    setOwnerTransferSaving(true);
    setActionErr("");
    try {
      const { error } = await supabase.rpc("transfer_project_owner", {
        p_project_id: selectedProject.id,
        p_new_owner_id: ownerTransferPick,
      });
      if (error) setActionErr(error.message);
      else {
        setOwnerTransferOpen(false);
        setOwnerTransferPick(null);
        setInviteNotice("オーナーを移しました。");
        window.setTimeout(() => setInviteNotice(""), 3200);
        await load();
      }
    } finally {
      setOwnerTransferSaving(false);
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
    activeTab === "documents" ? "max-w-6xl" : activeTab === "schedule" ? "max-w-xl" : "max-w-lg";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f0f0f2]">
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
                            void (async () => {
                              const ok = await copyProjectInviteUrl(selectedProject.id);
                              setInviteNotice(ok ? "招待リンク（URL）をコピーしました。" : "コピーに失敗しました。");
                              window.setTimeout(() => setInviteNotice(""), 3200);
                            })();
                          }}
                        >
                          招待URLをコピー
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full px-4 py-3 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            void (async () => {
                              const r = await shareOrCopyProject(selectedProject.name, selectedProject.id);
                              if (r === "failed") setInviteNotice("共有・コピーに失敗しました。");
                              else if (r === "copied") setInviteNotice("文章ごとコピーしました。");
                              else setInviteNotice("共有を開きました。");
                              window.setTimeout(() => setInviteNotice(""), 3200);
                            })();
                          }}
                        >
                          共有…
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
                              setHeaderMenuOpen(false);
                              openGroupProfileEditor();
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
                              setHeaderMenuOpen(false);
                              setOwnerTransferPick(null);
                              setOwnerTransferOpen(true);
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
                className={`relative flex-1 px-1 pb-2.5 pt-2 text-center text-xs font-semibold transition sm:text-sm ${
                  activeTab === tab.key ? "text-indigo-800" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {tab.label}
                {activeTab === tab.key ? (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-indigo-700" aria-hidden />
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
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
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
              <form
                className="relative"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
              >
                <input
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 py-3 pl-4 pr-12 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none ring-indigo-300/0 transition focus:border-indigo-400 focus:bg-white focus:ring-2"
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder="メッセージを送る…"
                  aria-label="メッセージ"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-indigo-700 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-800 disabled:opacity-40"
                  disabled={!chatDraft.trim()}
                  aria-label="送信"
                >
                  ↑
                </button>
              </form>
            </div>
          </section>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {activeTab === "documents" ? (
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
            activeDoc
              ? `最終更新 ${formatDocStamp(activeDoc.updated_at)} · 作成 ${formatDocStamp(activeDoc.created_at)} · ${activeDoc.updated_by ? memberNames[activeDoc.updated_by] ?? "メンバー" : "更新者未設定"}`
              : "ドキュメントを選んでください"
          }
          sidebar={
            <aside className="flex flex-col gap-3">
              <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-3">
                <p className="text-[12px] font-semibold text-[#202124]">ドキュメント</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#5f6368]">
                  左の一覧から開きます。保存でチームに反映されます。
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-[#dadce0] pb-3">
                <p className="text-[13px] font-medium text-[#202124]">一覧</p>
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
              {documents.length === 0 && !docCreating ? (
                <div className="rounded-xl border border-dashed border-[#dadce0] bg-white px-3 py-6 text-center">
                  <p className="text-[13px] font-medium text-[#202124]">まだドキュメントがありません</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#5f6368]">企画メモ・議事録・仕様などを共有しましょう。</p>
                  <button
                    type="button"
                    onClick={() => void createDocument()}
                    className="mt-3 rounded-full bg-[#1a73e8] px-4 py-2 text-[12px] font-semibold text-white shadow-sm"
                  >
                    最初のドキュメントを作る
                  </button>
                </div>
              ) : null}
              <ul className="max-h-[50vh] space-y-1 overflow-y-auto md:max-h-[55vh]">
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
                        <span className={`block truncate text-[13px] leading-snug ${activeDocId === d.id ? "font-semibold text-[#174ea6]" : "text-[#202124]"}`}>
                          {d.title || "無題のドキュメント"}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-[#5f6368]">
                          更新 {formatDocStamp(d.updated_at)}
                        </span>
                        <span className="block text-[10px] text-[#80868b]">作成 {formatDocStamp(d.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          }
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
          onReload={() => void load()}
          onError={(msg) => setActionErr(msg)}
        />
      ) : null}

      {activeTab === "schedule" && selectedProject ? (
        <ProjectTasksPanel
          projectId={selectedProject.id}
          tasks={projectTasks}
          uid={uid}
          canEdit={Boolean(isMember || isOwner)}
          onReload={() => void load()}
          onError={(msg) => setActionErr(msg)}
          schedules={schedules}
          scheduleSaving={scheduleSaving}
          onSaveSchedule={(p) => submitSchedule(p)}
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
                saving={scheduleSaving}
              />
            </div>
          </div>
        </div>
      ) : null}

      {editProjectOpen && selectedProject ? (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          onClick={() => setEditProjectOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[min(92dvh,720px)] w-full max-w-md overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-zinc-900">グループプロフィール</h3>
            <p className="mt-1 text-xs text-zinc-500">写真・名前・説明・ジャンルなどを編集できます（管理者・オーナー）。</p>
            <label className="mt-4 block text-xs font-semibold text-zinc-700">名前</label>
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
              className="mt-1 min-h-[5rem] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={editDescDraft}
              onChange={(e) => setEditDescDraft(e.target.value)}
              placeholder="プロジェクトの概要"
            />
            <label className="mt-3 block text-xs font-semibold text-zinc-700">系統（ロードマップテンプレ）</label>
            <div className="mt-2 grid gap-2">
              {(["software", "maker", "social"] as const).map((bt) => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setEditBusinessDraft(bt)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                    editBusinessDraft === bt ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  {bt === "software" ? "ソフトウェア" : bt === "maker" ? "ものづくり" : "ソーシャル"}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs font-semibold text-zinc-700">カテゴリ</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              placeholder="例: 探究"
              value={editCategoryDraft}
              onChange={(e) => setEditCategoryDraft(e.target.value)}
            />
            <label className="mt-3 block text-xs font-semibold text-zinc-700">タグ（カンマ区切り）</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              placeholder="学校, アプリ, 環境"
              value={editTagsDraft}
              onChange={(e) => setEditTagsDraft(e.target.value)}
            />
            <label className="mt-3 block text-xs font-semibold text-zinc-700">募集したい仲間</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={editRecruitTargetDraft}
              onChange={(e) => setEditRecruitTargetDraft(e.target.value)}
            />
            <label className="mt-3 block text-xs font-semibold text-zinc-700">メッセージ</label>
            <textarea
              className="mt-1 min-h-[4rem] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={editRecruitMsgDraft}
              onChange={(e) => setEditRecruitMsgDraft(e.target.value)}
              placeholder="チームへのメッセージやビジョン"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                onClick={() => setEditProjectOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={projectSaving}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void saveGroupProfile()}
              >
                {projectSaving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ownerTransferOpen && selectedProject && isOwner ? (
        <div
          className="fixed inset-0 z-[88] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          onClick={() => !ownerTransferSaving && setOwnerTransferOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[min(85dvh,560px)] w-full max-w-md overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-transfer-title"
          >
            <h3 id="owner-transfer-title" className="text-base font-bold text-zinc-900">
              オーナーを移す
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              現在のオーナーだけが実行できます。メンバー一覧から新しいオーナーを選び、確認してください。あなたは管理者権限に変更されます。
            </p>
            <ul className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto">
              {members
                .filter((m) => m.user_id !== uid)
                .map((m) => (
                  <li key={m.user_id}>
                    <button
                      type="button"
                      onClick={() => setOwnerTransferPick(m.user_id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition ${
                        ownerTransferPick === m.user_id ? "border-indigo-500 bg-indigo-50" : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <span className="font-semibold text-zinc-900">{memberNames[m.user_id] ?? m.user_id.slice(0, 8)}</span>
                      <span className="text-xs text-zinc-500">{m.role}</span>
                    </button>
                  </li>
                ))}
            </ul>
            {members.filter((m) => m.user_id !== uid).length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">移譲できるメンバーがいません。</p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                disabled={ownerTransferSaving}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50"
                onClick={() => setOwnerTransferOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={ownerTransferSaving || !ownerTransferPick}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm("オーナーを移譲します。よろしいですか？この操作は取り消せません。")
                  ) {
                    return;
                  }
                  void submitOwnerTransfer();
                }}
              >
                {ownerTransferSaving ? "実行中…" : "移譲する"}
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
    </div>
  );
}
