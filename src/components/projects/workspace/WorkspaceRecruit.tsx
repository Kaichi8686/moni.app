"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Megaphone, Plus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  closeProjectRecruitment,
  createProjectRecruitment,
  ensureLegacyRecruitmentMigrated,
  listProjectRecruitments,
  type ProjectRecruitment,
} from "@/lib/projects/projectRecruitments";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { supabase } from "@/lib/supabase";

type WorkFormat = "online" | "in_person" | "other";

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

export default function WorkspaceRecruit() {
  const { tx } = useI18n();
  const { project, projectMeta, projectId, loading, uid, canEdit, isOwner, reload } = useProjectWorkspace();
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [rows, setRows] = useState<ProjectRecruitment[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectRecruitment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createEntered, setCreateEntered] = useState(false);
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

  const openCreate = useCallback(() => {
    if (!canEdit) return;
    setCreateOpen(true);
    setCreateEntered(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setCreateEntered(true));
    });
  }, [canEdit]);

  const closeCreate = useCallback(() => {
    setCreateEntered(false);
    window.setTimeout(() => setCreateOpen(false), 280);
  }, []);

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
    } catch (e) {
      showNotice(e instanceof Error ? e.message : tx("募集の取得に失敗しました", "Failed to load recruitments"));
    } finally {
      setListLoading(false);
    }
  }, [project, projectId, projectMeta, uid, isOwner, showNotice, tx]);

  useEffect(() => {
    if (loading || !project) return;
    void loadList();
  }, [loading, project, loadList]);

  useEffect(() => {
    if (!createOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCreate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createOpen, closeCreate]);

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
      resetForm();
      closeCreate();
      await loadList();
      await reload();
      showNotice(tx("募集を公開しました", "Recruitment published"));
    } catch (e) {
      showNotice(e instanceof Error ? e.message : tx("公開に失敗しました", "Failed to publish"));
    } finally {
      setSaving(false);
    }
  }

  async function onClose(id: string, e?: MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    if (!supabase || !canEdit) return;
    setClosingId(id);
    try {
      await closeProjectRecruitment(supabase, id, projectId);
      if (detail?.id === id) setDetail(null);
      await loadList();
      await reload();
      showNotice(tx("募集を締め切りました", "Recruitment closed"));
    } catch (err) {
      showNotice(err instanceof Error ? err.message : tx("締切に失敗しました", "Failed to close"));
    } finally {
      setClosingId(null);
    }
  }

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

  const openRows = rows.filter((r) => r.status === "open");
  const closedRows = rows.filter((r) => r.status === "closed");

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-5 pb-6 sm:px-6 sm:py-6">
        {notice ? (
          <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
            {notice}
          </p>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-zinc-500">
                {tx(`${project.name} の募集`, `Recruiting for ${project.name}`)}
              </p>
              <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
                {tx("欲しい人材を募集", "Recruit talent")}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                {tx(
                  "新規作成から募集を追加できます。出した募集は下の一覧から確認・締切できます。",
                  "Add openings with New. Review and close them in the list below.",
                )}
              </p>
            </div>
            <Megaphone className="mt-1 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
          </div>

          {canEdit ? (
            <button
              type="button"
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99] sm:w-auto"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {tx("新規作成", "New")}
            </button>
          ) : (
            <p className="text-sm text-zinc-500">
              {tx("募集の編集はオーナー・管理者のみできます。", "Only owners and admins can manage recruitment.")}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-zinc-950">
            {tx(`公開中の募集（${openRows.length}）`, `Open recruitments (${openRows.length})`)}
          </h3>
          {listLoading ? (
            <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
          ) : openRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
              {canEdit
                ? tx(
                    "まだ公開中の募集はありません。「新規作成」から追加できます。",
                    "No open recruitments yet. Tap New to add one.",
                  )
                : tx("まだ公開中の募集はありません。", "No open recruitments yet.")}
            </p>
          ) : (
            <ul className="space-y-2">
              {openRows.map((r) => (
                <li key={r.id}>
                  <div className="flex items-stretch overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                    <button
                      type="button"
                      className="min-w-0 flex-1 px-4 py-3.5 text-left transition hover:bg-zinc-50"
                      onClick={() => setDetail(r)}
                    >
                      <p className="truncate text-sm font-semibold text-zinc-950">{r.title}</p>
                      {r.message ? (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-zinc-600">{r.message}</p>
                      ) : null}
                      {metaLine(r) ? (
                        <p className="mt-1.5 text-[11px] text-zinc-400">{metaLine(r)}</p>
                      ) : null}
                      <p className="mt-2 text-[11px] font-medium text-zinc-500">
                        {tx("タップして詳細を見る", "Tap for details")}
                      </p>
                    </button>
                    {canEdit ? (
                      <div className="flex shrink-0 items-center border-l border-zinc-100 px-2">
                        <button
                          type="button"
                          disabled={closingId === r.id}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[12px] font-semibold text-zinc-700 disabled:opacity-50"
                          onClick={(e) => void onClose(r.id, e)}
                        >
                          {closingId === r.id ? "…" : tx("締め切る", "Close")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {closedRows.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-500">
              {tx(`締め切り済み（${closedRows.length}）`, `Closed (${closedRows.length})`)}
            </h3>
            <ul className="space-y-2">
              {closedRows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-left"
                    onClick={() => setDetail(r)}
                  >
                    <p className="truncate text-sm font-medium text-zinc-500 line-through decoration-zinc-300">
                      {r.title}
                    </p>
                    {metaLine(r) ? (
                      <p className="mt-1 text-[11px] text-zinc-400">{metaLine(r)}</p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-labelledby="recruit-create-title">
          <button
            type="button"
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out ${
              createEntered ? "opacity-100" : "opacity-0"
            }`}
            aria-label={tx("閉じる", "Close")}
            onClick={closeCreate}
          />
          <div
            className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:bottom-4 sm:max-h-[85vh] sm:rounded-2xl ${
              createEntered ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-zinc-100 bg-white px-4 py-3">
              <h3 id="recruit-create-title" className="text-sm font-semibold text-zinc-900">
                {tx("欲しい人材を募集", "Recruit talent")}
              </h3>
              <button
                type="button"
                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100"
                aria-label={tx("閉じる", "Close")}
                onClick={closeCreate}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <input
                className="min-h-[48px] w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                placeholder={tx("欲しい人材・姿勢（必須）", "Wanted talent / mindset (required)")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              <textarea
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
                rows={4}
                placeholder={tx("募集文・ビジョン（任意）", "Recruitment message / vision (optional)")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
                    {tx("役割", "Role")}
                  </span>
                  <input
                    className="min-h-[48px] w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                    placeholder={tx("例: デザイナー、広報", "e.g. Designer, PR")}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
                    {tx("報酬", "Compensation")}
                  </span>
                  <input
                    className="min-h-[48px] w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                    placeholder={tx("例: なし、成果報酬", "e.g. Unpaid, revenue share")}
                    value={compensation}
                    onChange={(e) => setCompensation(e.target.value)}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
                    {tx("週の参加時間", "Hours / week")}
                  </span>
                  <div className="flex min-h-[48px] items-center gap-2 rounded-xl border border-zinc-200 px-3 focus-within:border-zinc-400">
                    <span className="shrink-0 text-sm text-zinc-500">{tx("週", "Weekly")}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      placeholder={tx("例: 5", "e.g. 5")}
                      value={weeklyHours}
                      onChange={(e) => setWeeklyHours(e.target.value)}
                    />
                    <span className="shrink-0 text-sm text-zinc-500">{tx("時間", "hrs")}</span>
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

              <label className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[12px] text-zinc-700">
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
              <button
                type="button"
                disabled={saving || !title.trim()}
                className="w-full min-h-[48px] rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void onCreate()}
              >
                {saving ? tx("公開中…", "Publishing…") : tx("この内容で募集を追加する", "Add this recruitment")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-900">{tx("募集詳細", "Recruitment details")}</h3>
              <button
                type="button"
                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100"
                aria-label={tx("閉じる", "Close")}
                onClick={() => setDetail(null)}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="space-y-4 px-4 py-4">
              <div>
                <p className="text-xl font-bold leading-snug tracking-tight text-zinc-950">{detail.title}</p>
                <p className="mt-1 text-[12px] font-medium text-zinc-500">
                  {detail.status === "open"
                    ? tx("公開中（閲覧のみ・編集不可）", "Open (view only · not editable)")
                    : tx("締め切り済み（閲覧のみ）", "Closed (view only)")}
                </p>
              </div>
              {detail.message ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{detail.message}</p>
              ) : (
                <p className="text-sm text-zinc-400">{tx("募集文はありません。", "No message.")}</p>
              )}
              <dl className="grid gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold text-zinc-500">{tx("役割", "Role")}</dt>
                  <dd className="mt-0.5 text-zinc-900">{detail.skillName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-zinc-500">
                    {tx("週の参加時間・形式", "Hours / format")}
                  </dt>
                  <dd className="mt-0.5 text-zinc-900">{detail.duration || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-zinc-500">{tx("報酬", "Compensation")}</dt>
                  <dd className="mt-0.5 text-zinc-900">{detail.compensation || "—"}</dd>
                </div>
              </dl>
              {detail.status === "open" && canEdit ? (
                <button
                  type="button"
                  disabled={closingId === detail.id}
                  className="w-full min-h-[44px] rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  onClick={() => void onClose(detail.id)}
                >
                  {closingId === detail.id ? "…" : tx("この募集を締め切る", "Close this recruitment")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
