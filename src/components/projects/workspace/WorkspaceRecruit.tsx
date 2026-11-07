"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  closeProjectRecruitment,
  createProjectRecruitment,
  ensureLegacyRecruitmentMigrated,
  listProjectRecruitments,
  type ProjectRecruitment,
} from "@/lib/projects/projectRecruitments";
import {
  countPendingApplicationsByRecruitment,
  listRecruitmentApplications,
  reviewRecruitmentApplication,
  type RecruitmentApplication,
} from "@/lib/projects/projectRecruitmentApplications";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { supabase } from "@/lib/supabase";

type WorkFormat = "online" | "in_person" | "other";
type FilterId = "all" | "open" | "closed";
type Panel = { kind: "detail"; row: ProjectRecruitment } | { kind: "create" };

const SLIDE_OUT_MS = 220;
const LIST_DUO =
  "!justify-start !gap-3 !px-4 !py-3.5 !text-left !text-[14px] !font-bold !leading-snug";

function formatWeeklyHours(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/時間/.test(trimmed) || /週/.test(trimmed)) return trimmed;
  return `週${trimmed}時間`;
}

function workFormatLabel(format: WorkFormat, tx: (ja: string, en: string) => string): string {
  if (format === "online") return tx("オンライン", "Online");
  if (format === "in_person") return tx("対面", "In person");
  return tx("その他", "Other");
}

function metaLine(row: ProjectRecruitment): string {
  return [row.skillName, row.duration, row.compensation].filter(Boolean).join(" · ");
}

function RecruitSlidePanel({
  children,
  exiting,
  zClass = "z-[200]",
}: {
  children: ReactNode;
  exiting?: boolean;
  zClass?: string;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const motionClass = exiting
    ? "issue-create-wizard-out"
    : entered
      ? "issue-create-wizard-in"
      : "translate-x-full";

  return (
    <div
      className={`fixed inset-0 ${zClass} w-full max-w-[100vw] overflow-x-hidden overflow-y-auto overscroll-contain bg-white px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] ${motionClass}`}
    >
      <div className="mx-auto w-full min-w-0 max-w-3xl">{children}</div>
    </div>
  );
}

export default function WorkspaceRecruit() {
  const { tx } = useI18n();
  const { project, projectMeta, projectId, loading, uid, canEdit, isOwner, reload } = useProjectWorkspace();
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [rows, setRows] = useState<ProjectRecruitment[]>([]);
  const [pendingByRecruitment, setPendingByRecruitment] = useState<Map<string, number>>(new Map());
  const [applicants, setApplicants] = useState<RecruitmentApplication[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [panelExiting, setPanelExiting] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");
  const [compensation, setCompensation] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("");
  const [workFormat, setWorkFormat] = useState<WorkFormat>("online");
  const [postToBoard, setPostToBoard] = useState(true);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 4200);
  }, []);

  const resetForm = useCallback(() => {
    setTitle("");
    setMessage("");
    setRole("");
    setCompensation("");
    setWeeklyHours("");
    setWorkFormat("online");
    setPostToBoard(true);
  }, []);

  const clearExitTimer = useCallback(() => {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
  }, []);

  const closePanel = useCallback(() => {
    if (panelExiting) return;
    setPanelExiting(true);
    clearExitTimer();
    exitTimer.current = setTimeout(() => {
      setPanel(null);
      setPanelExiting(false);
      exitTimer.current = null;
    }, SLIDE_OUT_MS);
  }, [panelExiting, clearExitTimer]);

  const openCreate = useCallback(() => {
    if (!canEdit) return;
    clearExitTimer();
    setPanelExiting(false);
    resetForm();
    setPanel({ kind: "create" });
  }, [canEdit, clearExitTimer, resetForm]);

  const openDetail = useCallback(
    (row: ProjectRecruitment) => {
      clearExitTimer();
      setPanelExiting(false);
      setPanel({ kind: "detail", row });
    },
    [clearExitTimer],
  );

  const loadList = useCallback(async () => {
    if (!supabase || !project) {
      setListLoading(false);
      return;
    }
    setListLoading(true);
    try {
      const ownerId =
        project.members.find((m) => m.role === "owner")?.id ?? (isOwner ? uid : null) ?? uid ?? "";
      if (ownerId) {
        await ensureLegacyRecruitmentMigrated(supabase, {
          projectId,
          ownerId,
          recruitmentTarget: projectMeta?.recruitment_target ?? "",
          recruitmentMessage: projectMeta?.recruitment_message ?? "",
        });
      }
      const list = await listProjectRecruitments(supabase, projectId);
      setRows(list.filter((r) => r.projectId === projectId));
      try {
        const counts = await countPendingApplicationsByRecruitment(supabase, projectId);
        setPendingByRecruitment(counts);
      } catch {
        setPendingByRecruitment(new Map());
      }
    } catch (e) {
      showNotice(e instanceof Error ? e.message : tx("募集の取得に失敗しました", "Failed to load recruitments"));
    } finally {
      setListLoading(false);
    }
  }, [project, projectId, projectMeta, uid, isOwner, showNotice, tx]);

  const loadApplicants = useCallback(
    async (recruitmentId: string) => {
      if (!supabase) {
        setApplicants([]);
        return;
      }
      setApplicantsLoading(true);
      try {
        const list = await listRecruitmentApplications(supabase, recruitmentId);
        setApplicants(list);
      } catch (e) {
        setApplicants([]);
        showNotice(e instanceof Error ? e.message : tx("応募の取得に失敗しました", "Failed to load applicants"));
      } finally {
        setApplicantsLoading(false);
      }
    },
    [showNotice, tx],
  );

  useEffect(() => {
    if (loading || !project) return;
    void loadList();
  }, [loading, project, loadList]);

  useEffect(() => {
    if (panel?.kind !== "detail") {
      setApplicants([]);
      return;
    }
    void loadApplicants(panel.row.id);
  }, [panel, loadApplicants]);

  useEffect(() => {
    return () => clearExitTimer();
  }, [clearExitTimer]);

  // 詳細・作成パネル表示中は下タブを隠す
  useEffect(() => {
    const drill = Boolean(panel);
    document.documentElement.classList.toggle("moni-recruit-drill", drill);
    return () => document.documentElement.classList.remove("moni-recruit-drill");
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, closePanel]);

  async function onCreate() {
    if (!supabase || !uid || !project || !canEdit) return;
    if (!title.trim()) {
      showNotice(tx("欲しい人材を入力してください", "Enter the talent you want"));
      return;
    }
    setSaving(true);
    try {
      const roleText = role.trim();
      const hoursText = formatWeeklyHours(weeklyHours);
      const formatText = workFormatLabel(workFormat, tx);
      const duration = [hoursText, formatText].filter(Boolean).join(" · ");
      await createProjectRecruitment(supabase, {
        projectId,
        userId: uid,
        projectName: project.name,
        title,
        message,
        skillName: roleText || title.trim(),
        duration: duration || undefined,
        compensation: compensation.trim() || undefined,
        postToSkillBoard: postToBoard,
        makeProjectPublic: projectMeta?.visibility !== "public",
      });
      closePanel();
      window.setTimeout(() => resetForm(), SLIDE_OUT_MS + 40);
      await loadList();
      await reload();
      showNotice(tx("募集を公開しました", "Recruitment published"));
    } catch (e) {
      showNotice(e instanceof Error ? e.message : tx("公開に失敗しました", "Failed to publish"));
    } finally {
      setSaving(false);
    }
  }

  async function onClose(id: string) {
    if (!supabase || !canEdit) return;
    setClosingId(id);
    try {
      await closeProjectRecruitment(supabase, id, projectId);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "closed" as const } : r)));
      if (panel?.kind === "detail" && panel.row.id === id) {
        setPanel({ kind: "detail", row: { ...panel.row, status: "closed" } });
      }
      await loadList();
      await reload();
      showNotice(tx("募集を締め切りました", "Recruitment closed"));
    } catch (err) {
      showNotice(err instanceof Error ? err.message : tx("締切に失敗しました", "Failed to close"));
    } finally {
      setClosingId(null);
    }
  }

  async function onReviewApplicant(applicationId: string, action: "accept" | "reject") {
    if (!supabase || !canEdit) return;
    setReviewBusyId(applicationId);
    try {
      await reviewRecruitmentApplication(supabase, { applicationId, action });
      showNotice(
        action === "accept"
          ? tx("応募を承認しました", "Application accepted")
          : tx("応募を拒否しました", "Application rejected"),
      );
      if (panel?.kind === "detail") await loadApplicants(panel.row.id);
      await loadList();
      await reload();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : tx("処理に失敗しました", "Failed to review"));
    } finally {
      setReviewBusyId(null);
    }
  }

  function applicantStatusLabel(status: RecruitmentApplication["status"]): string {
    if (status === "accepted") return tx("承認済み", "Accepted");
    if (status === "rejected") return tx("拒否", "Rejected");
    if (status === "cancelled") return tx("取消", "Cancelled");
    return tx("審査中", "Pending");
  }

  const openCount = useMemo(() => rows.filter((r) => r.status === "open").length, [rows]);
  const closedCount = useMemo(() => rows.filter((r) => r.status === "closed").length, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === "open") return rows.filter((r) => r.status === "open");
    if (filter === "closed") return rows.filter((r) => r.status === "closed");
    return rows;
  }, [rows, filter]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-zinc-500">{tx("プロジェクトがありません。", "No project found.")}</p>
      </div>
    );
  }

  const formatOptions: Array<{ id: WorkFormat; label: string }> = [
    { id: "online", label: tx("オンライン", "Online") },
    { id: "in_person", label: tx("対面", "In person") },
    { id: "other", label: tx("その他", "Other") },
  ];

  const filters: Array<{ id: FilterId; label: string; count: number }> = [
    { id: "all", label: tx("すべて", "All"), count: rows.length },
    { id: "open", label: tx("公開中", "Open"), count: openCount },
    { id: "closed", label: tx("締切済み", "Closed"), count: closedCount },
  ];

  const showPanel = Boolean(panel) || panelExiting;
  const detailRow = panel?.kind === "detail" ? panel.row : null;

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 pb-bottom-nav">
        {notice ? (
          <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
            {notice}
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-zinc-100/95 p-1 shadow-sm ring-1 ring-zinc-200/80">
          {filters.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`min-h-11 rounded-xl px-1 text-[12px] font-extrabold tracking-tight transition sm:text-sm ${
                  active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                }`}
                aria-pressed={active}
              >
                {f.label}
                <span className={`ml-1 tabular-nums ${active ? "text-zinc-500" : "text-zinc-400"}`}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {!canEdit ? (
          <p className="text-center text-[12px] text-zinc-500">
            {tx("募集の編集はオーナー・管理者のみできます。", "Only owners and admins can manage recruitment.")}
          </p>
        ) : null}

        <div className="flex flex-col gap-2.5">
          {canEdit && filter === "all" ? (
            <DuoButton type="button" tone="orange" size="md" fullWidth onClick={openCreate} className={LIST_DUO}>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/25 text-white">
                <Plus className="h-5 w-5" aria-hidden strokeWidth={2.5} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate">{tx("募集を追加", "Add recruitment")}</span>
                <span className="truncate text-[11px] font-semibold text-white/80">
                  {tx("欲しい人材を公開する", "Post an opening")}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            </DuoButton>
          ) : null}

          {listLoading ? (
            <p className="py-6 text-center text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
          ) : filteredRows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
              {filter === "closed"
                ? tx("締切済みの募集はありません。", "No closed recruitments.")
                : filter === "open"
                  ? tx("公開中の募集はありません。", "No open recruitments.")
                  : canEdit
                    ? tx("まだ募集がありません。「募集を追加」から作れます。", "No recruitments yet. Tap Add to create one.")
                    : tx("まだ募集がありません。", "No recruitments yet.")}
            </p>
          ) : (
            filteredRows.map((r) => {
              const open = r.status === "open";
              const sub = metaLine(r);
              const pendingCount = pendingByRecruitment.get(r.id) ?? 0;
              return (
                <DuoButton
                  key={r.id}
                  type="button"
                  tone={open ? "peach" : "zinc"}
                  size="md"
                  fullWidth
                  onClick={() => openDetail(r)}
                  className={LIST_DUO}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`line-clamp-2 ${open ? "" : "line-through decoration-zinc-400/70"}`}>
                      {r.title}
                    </span>
                    <span
                      className={`truncate text-[11px] font-semibold ${
                        open ? "text-[#9A5B1F]/80" : "text-zinc-500"
                      }`}
                    >
                      {[
                        open ? tx("公開中", "Open") : tx("締切済み", "Closed"),
                        pendingCount > 0
                          ? tx(`応募 ${pendingCount}人`, `${pendingCount} applicants`)
                          : null,
                        sub || (r.message ? r.message.slice(0, 40) : ""),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {pendingCount > 0 ? (
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF4B4B] px-1.5 text-xs font-extrabold text-white shadow-[0_2px_0_#C43232]">
                      {pendingCount}
                    </span>
                  ) : (
                    <ArrowRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  )}
                </DuoButton>
              );
            })
          )}
        </div>
      </div>

      {showPanel && panel?.kind === "create" ? (
        <RecruitSlidePanel exiting={panelExiting} zClass="z-[220]">
          <div className="flex flex-col gap-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closePanel}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100"
                aria-label={tx("戻る", "Back")}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-zinc-950">
                {tx("募集を追加", "Add recruitment")}
              </h1>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
                  {tx("欲しい人材・姿勢（必須）", "Wanted talent / mindset (required)")}
                </span>
                <input
                  className="min-h-[48px] w-full rounded-2xl border border-zinc-200 px-3 text-[16px] outline-none focus:border-[#FF9600]"
                  placeholder={tx("例: デザイナー、広報", "e.g. Designer, PR")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
                  {tx("募集文・ビジョン（任意）", "Recruitment message / vision (optional)")}
                </span>
                <textarea
                  className="w-full resize-y rounded-2xl border border-zinc-200 px-3 py-2.5 text-[16px] outline-none focus:border-[#FF9600]"
                  rows={4}
                  placeholder={tx("どんな仲間と何をしたいか", "Who you want and what you’ll build")}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
                    {tx("役割", "Role")}
                  </span>
                  <input
                    className="min-h-[48px] w-full rounded-2xl border border-zinc-200 px-3 text-[16px] outline-none focus:border-[#FF9600]"
                    placeholder={tx("例: デザイナー", "e.g. Designer")}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
                    {tx("報酬", "Compensation")}
                  </span>
                  <input
                    className="min-h-[48px] w-full rounded-2xl border border-zinc-200 px-3 text-[16px] outline-none focus:border-[#FF9600]"
                    placeholder={tx("例: なし、成果報酬", "e.g. Unpaid, revenue share")}
                    value={compensation}
                    onChange={(e) => setCompensation(e.target.value)}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
                    {tx("週の参加時間", "Hours / week")}
                  </span>
                  <div className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-zinc-200 px-3 focus-within:border-[#FF9600]">
                    <span className="shrink-0 text-[16px] text-zinc-500">{tx("週", "Weekly")}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
                      placeholder={tx("例: 5", "e.g. 5")}
                      value={weeklyHours}
                      onChange={(e) => setWeeklyHours(e.target.value)}
                    />
                    <span className="shrink-0 text-[16px] text-zinc-500">{tx("時間", "hrs")}</span>
                  </div>
                </label>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-[11px] font-semibold text-zinc-500">{tx("形式", "Format")}</legend>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={tx("形式", "Format")}>
                  {formatOptions.map((opt) => {
                    const active = workFormat === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`min-h-[44px] rounded-xl border text-sm font-semibold transition ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                        onClick={() => setWorkFormat(opt.id)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="flex items-start gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[13px] text-zinc-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={postToBoard}
                  onChange={(e) => setPostToBoard(e.target.checked)}
                />
                <span>
                  {tx(
                    "スキル募集ボードにも出す（探す・Discover で見つけやすくなります）",
                    "Also post to the skills board (easier to find on Discover)",
                  )}
                </span>
              </label>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                {tx(
                  "公開プロジェクトとして探すタブの「募集」に表示されます。非公開の場合は公開に切り替えます。",
                  "Shown on Explore → Recruiting. Private projects are switched to public.",
                )}
              </p>
              <DuoButton
                type="button"
                tone="orange"
                size="lg"
                fullWidth
                disabled={saving || !title.trim()}
                onClick={() => void onCreate()}
              >
                {saving ? tx("公開中…", "Publishing…") : tx("この内容で募集を追加する", "Add this recruitment")}
              </DuoButton>
            </div>
          </div>
        </RecruitSlidePanel>
      ) : null}

      {showPanel && detailRow ? (
        <RecruitSlidePanel exiting={panelExiting} zClass="z-[220]">
          <div className="flex flex-col gap-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closePanel}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100"
                aria-label={tx("戻る", "Back")}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-zinc-500">
                  {detailRow.status === "open" ? tx("公開中", "Open") : tx("締切済み", "Closed")}
                </p>
                <h1 className="truncate text-lg font-bold text-zinc-950">{detailRow.title}</h1>
              </div>
            </div>

            <div className="space-y-4">
              {detailRow.message ? (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800">{detailRow.message}</p>
              ) : (
                <p className="text-sm text-zinc-400">{tx("募集文はありません。", "No message.")}</p>
              )}
              <dl className="grid gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold text-zinc-500">{tx("役割", "Role")}</dt>
                  <dd className="mt-0.5 text-zinc-900">{detailRow.skillName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-zinc-500">
                    {tx("週の参加時間・形式", "Hours / format")}
                  </dt>
                  <dd className="mt-0.5 text-zinc-900">{detailRow.duration || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-zinc-500">{tx("報酬", "Compensation")}</dt>
                  <dd className="mt-0.5 text-zinc-900">{detailRow.compensation || "—"}</dd>
                </div>
              </dl>

              <section className="space-y-2.5">
                <h2 className="text-[13px] font-bold text-zinc-900">
                  {tx(`応募者 ${applicants.length}`, `Applicants ${applicants.length}`)}
                </h2>
                {applicantsLoading ? (
                  <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
                ) : applicants.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-center text-sm text-zinc-500">
                    {tx("まだ応募はありません。", "No applications yet.")}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {applicants.map((app) => {
                      const pending = app.status === "pending";
                      return (
                        <li
                          key={app.id}
                          className="rounded-2xl border border-zinc-200 bg-white px-3 py-3 shadow-sm shadow-zinc-900/[0.03]"
                        >
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-[13px] font-bold text-zinc-600">
                              {app.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={app.avatarUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                (app.displayName.trim().charAt(0) || "?").toUpperCase()
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-[14px] font-bold text-zinc-900">{app.displayName}</p>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    pending
                                      ? "bg-amber-50 text-amber-800"
                                      : app.status === "accepted"
                                        ? "bg-emerald-50 text-emerald-800"
                                        : "bg-zinc-100 text-zinc-600"
                                  }`}
                                >
                                  {applicantStatusLabel(app.status)}
                                </span>
                              </div>
                              {app.message ? (
                                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-600">
                                  {app.message}
                                </p>
                              ) : null}
                              {canEdit && pending ? (
                                <div className="mt-2.5 flex gap-2">
                                  <button
                                    type="button"
                                    disabled={reviewBusyId === app.id}
                                    className="inline-flex min-h-[36px] flex-1 items-center justify-center rounded-xl bg-zinc-900 text-[12px] font-bold text-white disabled:opacity-50"
                                    onClick={() => void onReviewApplicant(app.id, "accept")}
                                  >
                                    {reviewBusyId === app.id ? "…" : tx("承認", "Accept")}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={reviewBusyId === app.id}
                                    className="inline-flex min-h-[36px] flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white text-[12px] font-bold text-zinc-700 disabled:opacity-50"
                                    onClick={() => void onReviewApplicant(app.id, "reject")}
                                  >
                                    {tx("拒否", "Reject")}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {detailRow.status === "open" && canEdit ? (
                <DuoButton
                  type="button"
                  tone="zinc"
                  size="lg"
                  fullWidth
                  disabled={closingId === detailRow.id}
                  onClick={() => void onClose(detailRow.id)}
                >
                  {closingId === detailRow.id ? "…" : tx("この募集を締め切る", "Close this recruitment")}
                </DuoButton>
              ) : null}
            </div>
          </div>
        </RecruitSlidePanel>
      ) : null}
    </>
  );
}
