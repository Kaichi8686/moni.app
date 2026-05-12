"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ProjectMemberRow, ProjectRow, ProjectTaskRow } from "@/lib/projects/types";
import { isValidProjectUuid, normalizeProjectIdParam } from "@/lib/projects/validateProjectId";

type Props = { projectId?: string };

type ChatRow = {
  id: string;
  project_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type JoinRequestRow = {
  id: string;
  project_id: string;
  requester_id: string;
  message: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
};

type BoardElementRow = {
  id: string;
  board_id: string;
  element_type: "note" | "text" | "shape" | "pen";
  payload: { text?: string; x?: number; y?: number; color?: string };
  updated_at: string;
};

const card = "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm";
const input = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500";
const button = "rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60";
const subButton = "rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700";

export function ProjectsWorkspace({ projectId }: Props) {
  const [uid, setUid] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "general",
    tags: "",
    thumbnail_url: "",
    visibility: "public" as "public" | "private",
    recruitment_target: "",
    recruitment_message: "",
  });

  const [selected, setSelected] = useState<ProjectRow | null>(null);
  const [memberRole, setMemberRole] = useState<"owner" | "admin" | "member" | null>(null);
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [requests, setRequests] = useState<JoinRequestRow[]>([]);
  const [chat, setChat] = useState<ChatRow[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [boardElements, setBoardElements] = useState<BoardElementRow[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [tasks, setTasks] = useState<ProjectTaskRow[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ title: string; description: string; priority: "low" | "medium" | "high"; status: "todo" }>>([]);
  const [requestMessage, setRequestMessage] = useState("");
  const [activeCallUrl, setActiveCallUrl] = useState("");
  const [activeCallSessionId, setActiveCallSessionId] = useState<string | null>(null);
  const projectChatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUid(s?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProjects = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(100);
    if (error) setErr(error.message);
    setProjects((data ?? []) as ProjectRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const t = tagFilter.trim().toLowerCase();
    return projects.filter((p) => {
      const hitQ = !q || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q);
      const hitTag = !t || (p.tags ?? []).some((tag) => tag.toLowerCase().includes(t));
      return hitQ && hitTag;
    });
  }, [projects, query, tagFilter]);

  const loadProjectDetail = useCallback(async (pid: string) => {
    if (!supabase) return;
    setErr("");

    const idNorm = normalizeProjectIdParam(pid);
    if (!isValidProjectUuid(idNorm)) {
      setErr(
        "プロジェクトID（URL）が正しくありません。例として貼っていた（該当ID）のまま開いているとこのエラーになります。トップのプロジェクト一覧の「開く」から入り直してください。",
      );
      setSelected(null);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const currentUid = sessionData?.session?.user.id ?? null;
    if (currentUid) setUid(currentUid);

    const { data: projectData, error: projectErr } = await supabase.from("projects").select("*").eq("id", idNorm).single();
    if (projectErr) {
      setErr(projectErr.message);
      return;
    }
    const project = projectData as ProjectRow;
    setSelected(project);

    const [{ data: memberRows }, { data: requestRows }, { data: chatRows }, { data: taskRows }, { data: boardRows }] = await Promise.all([
      supabase.from("project_members").select("*").eq("project_id", idNorm).order("joined_at", { ascending: true }),
      supabase.from("project_join_requests").select("*").eq("project_id", idNorm).order("created_at", { ascending: false }),
      supabase.from("project_chat_messages").select("*").eq("project_id", idNorm).order("created_at", { ascending: true }).limit(80),
      supabase.from("project_tasks").select("*").eq("project_id", idNorm).order("created_at", { ascending: false }),
      supabase.from("project_boards").select("*").eq("project_id", idNorm).limit(1),
    ]);

    const m = (memberRows ?? []) as ProjectMemberRow[];
    setMembers(m);
    setRequests((requestRows ?? []) as JoinRequestRow[]);
    setChat((chatRows ?? []) as ChatRow[]);
    setTasks((taskRows ?? []) as ProjectTaskRow[]);
    const mine = currentUid ? m.find((x) => x.user_id === currentUid) : undefined;
    const fromRow = mine?.role as "owner" | "admin" | "member" | undefined;
    if (fromRow) {
      setMemberRole(fromRow);
    } else if (currentUid && project.owner_id === currentUid) {
      setMemberRole("owner");
    } else {
      setMemberRole(null);
    }

    const firstBoard = boardRows?.[0] as { id: string } | undefined;
    if (firstBoard?.id) {
      setBoardId(firstBoard.id);
      const { data: elementRows } = await supabase
        .from("project_board_elements")
        .select("*")
        .eq("board_id", firstBoard.id)
        .order("updated_at", { ascending: false })
        .limit(40);
      setBoardElements((elementRows ?? []) as BoardElementRow[]);
    } else {
      setBoardId(null);
      setBoardElements([]);
    }
  }, []);

  useEffect(() => {
    if (projectId) void loadProjectDetail(projectId);
  }, [projectId, loadProjectDetail]);

  useEffect(() => {
    if (!supabase || !selected) return;
    const client = supabase;
    const channel = client
      .channel(`project-${selected.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_chat_messages", filter: `project_id=eq.${selected.id}` }, () => {
        void loadProjectDetail(selected.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_tasks", filter: `project_id=eq.${selected.id}` }, () => {
        void loadProjectDetail(selected.id);
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [selected, loadProjectDetail]);

  useEffect(() => {
    if (!selected) return;
    projectChatEndRef.current?.scrollIntoView({ block: "end" });
  }, [selected?.id, chat.length]);

  async function createProject() {
    if (!supabase || !uid || !form.name.trim()) return;
    const fullPayload = {
      ...form,
      owner_id: uid,
      tags: form.tags.split(",").map((x) => x.trim()).filter(Boolean),
    };
    const payloadCandidates: Array<Record<string, unknown>> = [
      fullPayload,
      {
        owner_id: uid,
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "general",
        tags: fullPayload.tags,
        visibility: form.visibility,
      },
      {
        owner_id: uid,
        name: form.name.trim(),
        description: form.description.trim(),
      },
      {
        owner_id: uid,
        name: form.name.trim(),
      },
    ];
    let data: ProjectRow | null = null;
    let error: { message: string; code?: string } | null = null;
    for (const candidate of payloadCandidates) {
      const res = await supabase.from("projects").insert(candidate).select("*").single();
      data = (res.data as ProjectRow | null) ?? null;
      error = (res.error as { message: string; code?: string } | null) ?? null;
      if (!error) break;
      const schemaMismatch =
        error.code === "42703" ||
        error.code === "PGRST204" ||
        error.message.includes("does not exist") ||
        error.message.includes("schema cache");
      if (!schemaMismatch) break;
    }
    if (error) {
      setErr(error.message);
      return;
    }
    if (data?.id) {
      const { error: memErr } = await supabase
        .from("project_members")
        .upsert(
          { project_id: data.id, user_id: uid, role: "owner" },
          { onConflict: "project_id,user_id" },
        );
      if (memErr) {
        setErr(`プロジェクトは作成されましたが、オーナーのメンバー登録に失敗しました: ${memErr.message}`);
      }
    }
    setForm({
      name: "",
      description: "",
      category: "general",
      tags: "",
      thumbnail_url: "",
      visibility: "public",
      recruitment_target: "",
      recruitment_message: "",
    });
    await loadProjects();
    if (data?.id) void loadProjectDetail(data.id);
  }

  async function requestJoin() {
    if (!supabase || !selected || !uid) return;
    const { error } = await supabase.from("project_join_requests").insert({
      project_id: selected.id,
      requester_id: uid,
      message: requestMessage.trim() || "参加したいです",
    });
    if (error) setErr(error.message);
    setRequestMessage("");
    await loadProjectDetail(selected.id);
  }

  async function reviewRequest(requestId: string, action: "accept" | "reject") {
    if (!supabase || !selected) return;
    const { error } = await supabase.rpc("project_review_join_request", { p_request_id: requestId, p_action: action });
    if (error) setErr(error.message);
    await loadProjectDetail(selected.id);
  }

  async function sendChat() {
    if (!supabase || !selected || !uid || !chatDraft.trim()) return;
    const { error } = await supabase.from("project_chat_messages").insert({
      project_id: selected.id,
      sender_id: uid,
      body: chatDraft.trim(),
    });
    if (error) setErr(error.message);
    setChatDraft("");
    await loadProjectDetail(selected.id);
  }

  async function startCall() {
    if (!supabase || !selected || !uid) return;
    const res = await fetch("/api/call/daily-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomSeed: `project-${selected.id}` }),
    });
    const data = (await res.json().catch(() => ({}))) as { roomUrl?: string; error?: string };
    if (!res.ok || !data.roomUrl) {
      const raw = data.error ?? "";
      if (raw.includes("DAILY_API_KEY") || raw.includes("DAILY_DOMAIN")) {
        setErr("通話機能の初期設定が未完了です（Dailyの環境変数）。管理者に設定を依頼してください。");
      } else {
        setErr(data.error ?? "通話開始に失敗しました。時間をおいて再度お試しください。");
      }
      return;
    }
    setActiveCallUrl(data.roomUrl);
    const { data: sessionRow } = await supabase
      .from("project_call_sessions")
      .insert({ project_id: selected.id, started_by: uid, room_url: data.roomUrl, status: "active" })
      .select("*")
      .single();
    if (sessionRow?.id) {
      setActiveCallSessionId(sessionRow.id as string);
      await supabase.from("project_call_participants").upsert({ call_session_id: sessionRow.id, user_id: uid, left_at: null });
    }
  }

  async function leaveCall() {
    if (!supabase || !activeCallSessionId || !uid) return;
    await supabase.from("project_call_participants").update({ left_at: new Date().toISOString() }).eq("call_session_id", activeCallSessionId).eq("user_id", uid);
    setActiveCallUrl("");
  }

  async function ensureBoard() {
    if (!supabase || !selected || !uid) return null;
    if (boardId) return boardId;
    const { data, error } = await supabase
      .from("project_boards")
      .insert({ project_id: selected.id, title: "Main Board", created_by: uid })
      .select("*")
      .single();
    if (error) {
      setErr(error.message);
      return null;
    }
    setBoardId(data.id as string);
    return data.id as string;
  }

  async function addBoardNote() {
    if (!supabase || !selected || !uid || !noteDraft.trim()) return;
    const bid = await ensureBoard();
    if (!bid) return;
    const payload = { text: noteDraft.trim(), x: 20 + Math.floor(Math.random() * 120), y: 20 + Math.floor(Math.random() * 120), color: "yellow" };
    const { error } = await supabase
      .from("project_board_elements")
      .insert({ board_id: bid, element_type: "note", payload, created_by: uid, updated_by: uid });
    if (error) setErr(error.message);
    setNoteDraft("");
    await loadProjectDetail(selected.id);
  }

  async function addTask(aiGenerated = false, suggestion?: { title: string; description: string; priority: "low" | "medium" | "high"; status: "todo" }) {
    if (!supabase || !selected || !uid) return;
    const title = suggestion?.title ?? taskTitle.trim();
    if (!title) return;
    const payload = {
      project_id: selected.id,
      title,
      description: suggestion?.description ?? "",
      priority: suggestion?.priority ?? "medium",
      status: "todo",
      created_by: uid,
      ai_generated: aiGenerated,
    };
    const { error } = await supabase.from("project_tasks").insert(payload);
    if (error) setErr(error.message);
    setTaskTitle("");
    await loadProjectDetail(selected.id);
  }

  const isOwnerOfSelected = useMemo(
    () => Boolean(uid && selected && selected.owner_id === uid),
    [uid, selected],
  );
  const isProjectMember = useMemo(() => memberRole != null || isOwnerOfSelected, [memberRole, isOwnerOfSelected]);
  const roleLabelJa = useMemo(() => {
    if (memberRole === "admin") return "管理者";
    if (memberRole === "member") return "メンバー";
    if (memberRole === "owner" || isOwnerOfSelected) return "オーナー";
    return "未参加";
  }, [memberRole, isOwnerOfSelected]);

  async function generateAiTasks() {
    if (!selected) return;
    const res = await fetch("/api/projects/ai-task-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: selected.name,
        projectDescription: selected.description,
        recentChat: chat.slice(-8).map((c) => c.body),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { suggestions?: Array<{ title: string; description: string; priority: "low" | "medium" | "high"; status: "todo" }> };
    setAiSuggestions((data.suggestions ?? []).slice(0, 6));
  }

  if (!uid) {
    return <main className="mx-auto w-full max-w-3xl p-4 text-sm text-zinc-600">ログインするとプロジェクト機能を使えます。</main>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-3 sm:p-4">
      <section className={card}>
        <h1 className="text-lg font-bold">プロジェクト機能（MVP）</h1>
        <p className="mt-1 text-sm text-zinc-600">作成 / 参加申請 / チャット / Daily通話 / ホワイトボード / AIタスク提案</p>
        {err ? <p className="mt-2 text-sm text-rose-600">{err}</p> : null}
      </section>

      {!projectId ? (
        <>
          <section className={card}>
            <h2 className="text-base font-semibold">プロジェクト作成</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input className={input} placeholder="プロジェクト名" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              <input className={input} placeholder="カテゴリ" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
              <textarea className={`${input} sm:col-span-2`} placeholder="説明文" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              <input className={input} placeholder="タグ（カンマ区切り）" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />
              <input className={input} placeholder="サムネイルURL" value={form.thumbnail_url} onChange={(e) => setForm((p) => ({ ...p, thumbnail_url: e.target.value }))} />
              <input className={input} placeholder="募集対象" value={form.recruitment_target} onChange={(e) => setForm((p) => ({ ...p, recruitment_target: e.target.value }))} />
              <input className={input} placeholder="募集文" value={form.recruitment_message} onChange={(e) => setForm((p) => ({ ...p, recruitment_message: e.target.value }))} />
              <select className={input} value={form.visibility} onChange={(e) => setForm((p) => ({ ...p, visibility: e.target.value as "public" | "private" }))}>
                <option value="public">公開</option>
                <option value="private">非公開</option>
              </select>
            </div>
            <button type="button" className={`${button} mt-3`} onClick={() => void createProject()}>
              プロジェクトを作成
            </button>
          </section>

          <section className={card}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={input} placeholder="検索" value={query} onChange={(e) => setQuery(e.target.value)} />
              <input className={input} placeholder="タグ絞り込み" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} />
            </div>
            <h2 className="mt-3 text-base font-semibold">{loading ? "読み込み中..." : `公開/参加可能プロジェクト (${filteredProjects.length})`}</h2>
            <ul className="mt-3 space-y-2">
              {filteredProjects.map((p) => (
                <li key={p.id} className="rounded-xl border border-zinc-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold">{p.name}</p>
                      <p className="line-clamp-2 text-sm text-zinc-600">{p.description}</p>
                      <p className="mt-1 text-xs text-zinc-500">{p.visibility === "public" ? "公開" : "非公開"} ・ {p.category} ・ {(p.tags ?? []).join(", ")}</p>
                    </div>
                    <Link href={`/projects/${p.id}`} className={button}>
                      開く
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : selected ? (
        <>
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-zinc-500">
                  {selected.visibility === "public" ? "公開" : "非公開"} / あなたのロール: {roleLabelJa}
                </p>
                <h2 className="text-xl font-bold">{selected.name}</h2>
                <p className="text-sm text-zinc-600">{selected.description}</p>
              </div>
              <Link href="/projects" className={subButton}>一覧へ戻る</Link>
            </div>
            {!isProjectMember && selected.visibility === "public" ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input className={input} placeholder="志望理由/一言" value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} />
                <button type="button" className={button} onClick={() => void requestJoin()}>参加申請を送る</button>
              </div>
            ) : null}
          </section>

          {isProjectMember ? (
            <>
            <section
              className="overflow-hidden rounded-2xl border border-[#b0b0b0] bg-[#ededed] shadow-sm"
              aria-label="プロジェクトのトークと通話"
            >
                <div className="flex items-center gap-2 bg-[#06C755] px-2.5 py-2 text-white">
                  <Link
                    href="/projects"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-white/95 hover:bg-white/10"
                    title="一覧に戻る"
                    aria-label="一覧に戻る"
                  >
                    ‹
                  </Link>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/30 text-xs font-bold"
                    aria-hidden
                  >
                    {(selected?.name?.trim().charAt(0) || "P").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[13px] font-semibold leading-tight">プロジェクト トーク</h3>
                    {selected ? <p className="mt-0.5 truncate text-[10px] text-white/90">{selected.name}</p> : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-b border-[#c8c8c8] bg-[#f2f2f2] px-2 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#06C755] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm"
                    onClick={() => void startCall()}
                  >
                    <span aria-hidden>📞</span> 通話
                  </button>
                  {activeCallUrl ? (
                    <button
                      type="button"
                      className="rounded-full border border-[#d1d1d1] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800"
                      onClick={() => void leaveCall()}
                    >
                      通話を終了
                    </button>
                  ) : null}
                  <span className="text-[11px] text-zinc-500">Daily（音声中心）</span>
                </div>

                {activeCallUrl ? (
                  <div className="border-b border-[#c8c8c8] bg-black">
                    <iframe
                      title="project call"
                      src={activeCallUrl}
                      allow="microphone; camera; autoplay; fullscreen"
                      className="h-56 w-full"
                    />
                  </div>
                ) : null}

                <div className="flex max-h-[min(24rem,54vh)] flex-1 flex-col overflow-y-auto bg-[#b7e58a] px-2 py-3">
                  {chat.map((m) => {
                    const isMine = Boolean(uid && m.sender_id === uid);
                    const created = new Date(m.created_at);
                    const timeLabel = Number.isNaN(created.getTime())
                      ? "—"
                      : created.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
                    const peerName =
                      m.sender_id === selected?.owner_id ? "オーナー" : `メンバー · ${m.sender_id.replace(/-/g, "").slice(-4)}`;
                    const idCompact = m.sender_id.replace(/-/g, "");
                    const initial = (idCompact.match(/[0-9a-f]/g)?.[0] ?? "U").toUpperCase();
                    return (
                      <div key={m.id} className="mb-2.5 w-full last:mb-0">
                        <div className={`flex w-full gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                          {!isMine ? (
                            <div
                              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-500 text-[10px] font-bold text-white"
                              aria-hidden
                            >
                              {initial}
                            </div>
                          ) : (
                            <div
                              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e8a3a] text-[10px] font-bold text-white"
                              aria-hidden
                            >
                              我
                            </div>
                          )}
                          <div className={`max-w-[min(100%,20rem)] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                            {!isMine ? (
                              <span className="pl-0.5 text-[11px] font-semibold text-zinc-500">{peerName}</span>
                            ) : null}
                            <div
                              className={`rounded-[18px] px-3 py-2 text-sm leading-relaxed shadow-[0_1px_0_rgba(0,0,0,0.06)] ${
                                isMine
                                  ? "rounded-tr-sm border border-[#05b24d] bg-[#06C755] text-white"
                                  : "rounded-tl-sm border border-zinc-300 bg-white text-zinc-800"
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            </div>
                            <div className={`${isMine ? "flex w-full flex-row justify-end pr-0.5" : "pl-0.5"}`}>
                              <span className="text-[10px] tabular-nums text-zinc-500">{timeLabel}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {chat.length === 0 ? (
                    <div className="py-10 text-center text-xs text-zinc-700/70">まだメッセージがありません</div>
                  ) : null}
                  <div ref={projectChatEndRef} className="h-px w-full shrink-0" aria-hidden />
                </div>

                <form
                  className="flex shrink-0 items-end gap-2 border-t border-[#c8c8c8] bg-[#f3f3f3] p-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendChat();
                  }}
                >
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-base text-zinc-500 shadow-sm"
                    aria-label="添付（準備中）"
                    title="添付（準備中）"
                  >
                    ＋
                  </button>
                  <textarea
                    className="max-h-28 min-h-[40px] flex-1 resize-y rounded-full border border-[#d4d4d4] bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-[#06C755] focus:ring-1 focus:ring-[#06C755]/30"
                    placeholder="メッセージを入力"
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (chatDraft.trim() && uid) void sendChat();
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="inline-flex h-9 shrink-0 items-center rounded-full bg-[#06C755] px-3.5 text-xs font-bold text-white disabled:opacity-50"
                    disabled={!uid || !chatDraft.trim()}
                  >
                    送信
                  </button>
                </form>
              </section>

              <section className={card}>
                <h3 className="text-base font-semibold">メンバー / 申請</h3>
                <p className="mt-1 text-xs text-zinc-500">owner/admin が申請を承認/拒否できます。</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <ul className="space-y-1 text-sm">
                    {members.map((m) => (
                      <li key={m.user_id} className="rounded-lg border border-zinc-200 px-2 py-1">
                        {m.user_id.slice(0, 8)}... ・ {m.role}
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-1 text-sm">
                    {requests.filter((r) => r.status === "pending").map((r) => (
                      <li key={r.id} className="rounded-lg border border-zinc-200 p-2">
                        <p className="text-xs text-zinc-500">{r.requester_id.slice(0, 8)}...</p>
                        <p>{r.message}</p>
                        {(memberRole === "owner" || memberRole === "admin" || isOwnerOfSelected) ? (
                          <div className="mt-1 flex gap-2">
                            <button className={button} onClick={() => void reviewRequest(r.id, "accept")}>承認</button>
                            <button className={subButton} onClick={() => void reviewRequest(r.id, "reject")}>拒否</button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className={card}>
                <h3 className="text-base font-semibold">ホワイトボード（MVP: 付箋）</h3>
                <div className="mt-2 flex gap-2">
                  <input className={input} placeholder="付箋テキスト" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
                  <button className={button} onClick={() => void addBoardNote()}>追加</button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {boardElements.map((el) => (
                    <div key={el.id} className="rounded-xl border border-yellow-300 bg-yellow-100 p-2 text-sm">
                      {el.payload?.text ?? "(empty)"}
                    </div>
                  ))}
                </div>
              </section>

              <section className={card}>
                <h3 className="text-base font-semibold">タスク / AI提案</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input className={input} placeholder="手動タスク追加" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                  <button className={button} onClick={() => void addTask(false)}>追加</button>
                  <button className={subButton} onClick={() => void generateAiTasks()}>AI提案を生成</button>
                </div>
                {aiSuggestions.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {aiSuggestions.map((s, i) => (
                      <li key={`${s.title}-${i}`} className="rounded-xl border border-sky-200 bg-sky-50 p-2 text-sm">
                        <p className="font-semibold">{s.title}</p>
                        <p className="text-zinc-600">{s.description}</p>
                        <button className={`${button} mt-1`} onClick={() => void addTask(true, s)}>採用してタスク化</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <ul className="mt-2 space-y-2">
                  {tasks.map((t) => (
                    <li key={t.id} className="rounded-xl border border-zinc-200 p-2 text-sm">
                      <p className="font-semibold">{t.title}</p>
                      <p className="text-zinc-600">{t.description}</p>
                      <p className="text-xs text-zinc-500">{t.status} / {t.priority} {t.ai_generated ? " / AI提案" : ""}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : selected.visibility === "public" ? (
            <section
              className="overflow-hidden rounded-2xl border border-[#b0b0b0] bg-[#ededed] shadow-sm"
              aria-label="プロジェクトのトーク（参加前プレビュー）"
            >
              <div className="flex items-start justify-between gap-2 bg-[#06C755] px-3 py-2.5 text-white">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold leading-tight">プロジェクト トーク</h3>
                  {selected ? <p className="mt-0.5 truncate text-[11px] text-white/90">{selected.name}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-b border-[#c8c8c8] bg-[#f2f2f2] px-2 py-2">
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-full bg-zinc-300 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm"
                  title="メンバー承認後に使えます"
                >
                  <span aria-hidden>📞</span> 通話
                </button>
                <span className="text-[11px] text-zinc-500">承認後に利用できます</span>
              </div>
              <div className="px-3 py-10 text-center text-sm leading-relaxed text-zinc-600">
                <p>参加が承認されると、ここで <strong>LINE 風のトーク</strong> と <strong>通話（Daily）</strong> を使えます。</p>
                <p className="mt-3 text-xs text-zinc-500">上の「参加申請を送る」から申請してください（公開プロジェクトの場合）。</p>
                <p className="mt-2 text-xs text-zinc-500">公開スペースでは個人情報の書き込みは避けてください。</p>
              </div>
            </section>
          ) : (
            <section className={card}>
              <p className="text-sm text-zinc-600">非公開のため、このプロジェクトのメンバーに招待される必要があります。</p>
            </section>
          )}
        </>
      ) : err ? (
        <section className={card}>
          <p className="text-sm text-rose-600">{err}</p>
          <Link href="/projects" className={`${subButton} mt-3 inline-flex min-h-[44px] items-center`}>
            プロジェクト一覧へ戻る
          </Link>
        </section>
      ) : (
        <section className={card}>プロジェクトを読み込み中...</section>
      )}
    </main>
  );
}
