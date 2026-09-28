"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, ClipboardList, Hammer, Megaphone, MessagesSquare, PenLine, Plus } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { uploadProjectImage } from "@/lib/projects/uploadProjectImage";
import { dateInputToIso, daysUntilDue, isoToDateInput, isIssueSubmitted, isTaskGenre, TASK_GENRES, type TaskGenre } from "@/lib/workspace/issueWork";
import type { Issue } from "@/lib/workspace/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

const GENRE_META: Record<
  TaskGenre,
  { ja: string; en: string; hintJa: string; hintEn: string; icon: typeof PenLine; chip: string; iconBg: string }
> = {
  think: {
    ja: "考える・書く",
    en: "Think & write",
    hintJa: "企画書・台本・リサーチなど",
    hintEn: "Plans, scripts, research",
    icon: PenLine,
    chip: "bg-indigo-50 text-indigo-700",
    iconBg: "bg-indigo-500",
  },
  make: {
    ja: "つくる",
    en: "Make",
    hintJa: "デザイン・工作・試作品など",
    hintEn: "Design, crafts, prototypes",
    icon: Hammer,
    chip: "bg-orange-50 text-orange-700",
    iconBg: "bg-orange-500",
  },
  talk: {
    ja: "話す・つなぐ",
    en: "Talk & connect",
    hintJa: "相談・予約・ドアリングなど",
    hintEn: "Conversations, bookings, outreach",
    icon: MessagesSquare,
    chip: "bg-sky-50 text-sky-700",
    iconBg: "bg-sky-500",
  },
  spread: {
    ja: "広める",
    en: "Spread the word",
    hintJa: "SNS投稿・チラシ・案内など",
    hintEn: "Posts, flyers, outreach",
    icon: Megaphone,
    chip: "bg-emerald-50 text-emerald-700",
    iconBg: "bg-emerald-500",
  },
  run: {
    ja: "運営する",
    en: "Run it",
    hintJa: "予算・スケジュール・役割分担",
    hintEn: "Budget, schedule, roles",
    icon: ClipboardList,
    chip: "bg-violet-50 text-violet-700",
    iconBg: "bg-violet-500",
  },
};

type Screen =
  | { kind: "list" }
  | { kind: "genre"; genre: TaskGenre }
  | { kind: "task"; genre: TaskGenre; issueId: string };

export default function WorkspaceIssues() {
  const { tx, locale } = useI18n();
  const { issues, phases, project, uid, canEdit, createIssue, saveIssueWork, updateIssue } = useProjectWorkspace();
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAssignee, setDraftAssignee] = useState("");
  const [draftBegin, setDraftBegin] = useState("");
  const [draftDue, setDraftDue] = useState("");
  const [beginDraft, setBeginDraft] = useState("");
  const [dueDraft, setDueDraft] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [workspaceDraft, setWorkspaceDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const openedFromQuery = useRef(false);
  const taskId = screen.kind === "task" ? screen.issueId : "";

  useEffect(() => {
    if (!taskId) return;
    const issue = issues.find((item) => item.id === taskId);
    setWorkspaceDraft(issue?.workspaceText ?? "");
    setBeginDraft(isoToDateInput(issue?.beginAt));
    setDueDraft(isoToDateInput(issue?.dueDate));
  }, [taskId]);

  useEffect(() => {
    if (openedFromQuery.current) return;
    const params = new URLSearchParams(window.location.search);
    const task = params.get("task");
    const genre = params.get("genre");
    if (!task && !genre) {
      openedFromQuery.current = true;
      return;
    }
    if (issues.length === 0) return;
    if (task) {
      const issue = issues.find((item) => item.id === task);
      if (!issue) {
        openedFromQuery.current = true;
        return;
      }
      openedFromQuery.current = true;
      setScreen({ kind: "task", genre: issue.genre, issueId: issue.id });
      return;
    }
    if (isTaskGenre(genre)) {
      openedFromQuery.current = true;
      setScreen({ kind: "genre", genre });
    }
  }, [issues]);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const member of project?.members ?? []) map[member.id] = member.name;
    return map;
  }, [project?.members]);

  const openIssues = issues.filter((issue) => issue.status !== "cancelled");
  const genreIssues = (genre: TaskGenre) => openIssues.filter((issue) => issue.genre === genre);
  const activeGenre = screen.kind === "list" ? null : screen.genre;
  const activeIssue = screen.kind === "task" ? issues.find((issue) => issue.id === screen.issueId) ?? null : null;
  const activePhase = activeIssue?.phaseId ? phases.find((phase) => phase.id === activeIssue.phaseId) : undefined;
  const phaseIndex = activePhase ? phases.findIndex((phase) => phase.id === activePhase.id) : -1;

  async function addTask(event: FormEvent) {
    event.preventDefault();
    if (screen.kind !== "genre" || !draftTitle.trim()) return;
    setError("");
    try {
      const beginAt = dateInputToIso(draftBegin);
      const dueDate = dateInputToIso(draftDue);
      if (beginAt && dueDate && beginAt > dueDate) {
        setError(tx("やり始める日は期限より前にしてください", "Start before the deadline"));
        return;
      }
      await createIssue({
        title: draftTitle,
        status: "todo",
        priority: "medium",
        assigneeId: draftAssignee || null,
        genre: screen.genre,
        beginAt,
        dueDate,
      });
      setDraftTitle("");
      setDraftAssignee("");
      setDraftBegin("");
      setDraftDue("");
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("課題を追加できませんでした", "Couldn’t add the task"));
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files || !activeIssue || !uid) return;
    setUploading(true);
    setError("");
    try {
      const { supabase } = await import("@/lib/supabase");
      if (!supabase) throw new Error(tx("画像を保存できません", "Can’t save the photo"));
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const result = await uploadProjectImage(supabase, uid, "issue-photo", activeIssue.id, file);
        uploaded.push(result.publicUrl);
      }
      await saveIssueWork(activeIssue.id, { attachments: [...activeIssue.attachments, ...uploaded] });
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("画像を追加できませんでした", "Couldn’t add the photo"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function dueLabel(issue: Issue) {
    const days = daysUntilDue(issue.dueDate);
    if (days == null) return "";
    if (days > 0) return tx(`期限まであと${days}日`, `${days} days left`);
    if (days === 0) return tx("期限は今日", "Due today");
    return tx(`期限を${Math.abs(days)}日過ぎています`, `${Math.abs(days)} days overdue`);
  }

  if (screen.kind === "task" && activeIssue && activeGenre) {
    const meta = GENRE_META[activeGenre];
    const Icon = meta.icon;
    const submitted = isIssueSubmitted(activeIssue);
    const assignee = activeIssue.assigneeId ? names[activeIssue.assigneeId] : "";
    const due = dueLabel(activeIssue);
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setScreen({ kind: "genre", genre: activeGenre })} className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100" aria-label={tx("戻る", "Back")}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="min-w-0 truncate text-sm font-semibold text-zinc-500">
            {phaseIndex >= 0 && activePhase
              ? `STEP ${phaseIndex + 1}・${activePhase.title}`
              : locale === "en" ? meta.en : meta.ja}
          </p>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{activeIssue.title}</h1>
        <p className="text-sm text-zinc-600">
          {[assignee || tx("担当未設定", "No assignee"), due].filter(Boolean).join(" · ")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-zinc-800">{tx("やり始める", "Start")}</span>
            <input
              type="date"
              value={beginDraft}
              disabled={!canEdit}
              onChange={(event) => {
                const value = event.target.value;
                setBeginDraft(value);
                const beginAt = dateInputToIso(value);
                const dueAt = dateInputToIso(dueDraft);
                if (beginAt && dueAt && beginAt > dueAt) {
                  setError(tx("やり始める日は期限より前にしてください", "Start before the deadline"));
                  return;
                }
                setError("");
                void updateIssue(activeIssue.id, { beginAt });
              }}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-zinc-800">{tx("期限", "Deadline")}</span>
            <input
              type="date"
              value={dueDraft}
              disabled={!canEdit}
              onChange={(event) => {
                const value = event.target.value;
                setDueDraft(value);
                const dueAt = dateInputToIso(value);
                const beginAt = dateInputToIso(beginDraft);
                if (beginAt && dueAt && beginAt > dueAt) {
                  setError(tx("やり始める日は期限より前にしてください", "Start before the deadline"));
                  return;
                }
                setError("");
                void updateIssue(activeIssue.id, { dueDate: dueAt });
              }}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            />
          </label>
        </div>
        <section>
          <h2 className="text-sm font-bold text-zinc-900">{tx("作業スペース", "Workspace")}</h2>
          <textarea
            value={workspaceDraft}
            disabled={!canEdit}
            onChange={(event) => setWorkspaceDraft(event.target.value)}
            onBlur={() => {
              if (workspaceDraft !== activeIssue.workspaceText) {
                void saveIssueWork(activeIssue.id, { workspaceText: workspaceDraft });
              }
            }}
            placeholder={tx("ここに作業内容を書こう", "Write your work here")}
            className="mt-2 min-h-40 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm leading-relaxed outline-none focus:border-orange-400"
          />
        </section>
        <section>
          <h2 className="text-sm font-bold text-zinc-900">{tx("写真", "Photos")}</h2>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {activeIssue.attachments.map((url) => (
              <div key={url} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-zinc-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {canEdit ? (
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white"
                    onClick={() => void saveIssueWork(activeIssue.id, { attachments: activeIssue.attachments.filter((item) => item !== url) })}
                    aria-label={tx("写真を外す", "Remove photo")}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            {canEdit ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || !uid}
                className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 disabled:opacity-40"
              >
                <Camera className="h-5 w-5" />
                <span className="mt-1 text-[11px] font-semibold">{uploading ? tx("追加中", "Adding") : tx("写真", "Photo")}</span>
              </button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => void addPhotos(event.target.files)}
            />
          </div>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400">
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {tx("写真フォルダから選べます", "Choose from your photo library")}
          </p>
        </section>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button
          type="button"
          disabled={!canEdit || submitted}
          onClick={() => void saveIssueWork(activeIssue.id, { submittedAt: new Date().toISOString() })}
          className="min-h-[52px] w-full rounded-full bg-orange-500 text-base font-bold text-white disabled:opacity-50"
        >
          {submitted ? tx("提出済み", "Submitted") : tx("📤 提出する", "📤 Submit")}
        </button>
      </div>
    );
  }

  if (screen.kind === "genre" && activeGenre) {
    const meta = GENRE_META[activeGenre];
    const Icon = meta.icon;
    const rows = genreIssues(activeGenre);
    const doneCount = rows.filter((issue) => isIssueSubmitted(issue)).length;
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setScreen({ kind: "list" }); setCreating(false); }} className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100" aria-label={tx("戻る", "Back")}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-white ${meta.iconBg}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-zinc-950">{locale === "en" ? meta.en : meta.ja}</h1>
            <p className="text-xs text-zinc-500">{tx(`${doneCount}/${rows.length}件完了`, `${doneCount}/${rows.length} done`)}</p>
          </div>
          {canEdit ? (
            <button type="button" onClick={() => setCreating(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white" aria-label={tx("課題を追加", "Add task")}>
              <Plus className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        {creating ? (
          <form className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3" onSubmit={(event) => void addTask(event)}>
            <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder={tx("課題名", "Task name")} className="min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm" />
            <select value={draftAssignee} onChange={(event) => setDraftAssignee(event.target.value)} className="min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm">
              <option value="">{tx("担当者なし", "No assignee")}</option>
              {(project?.members ?? []).map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-semibold text-zinc-700">{tx("やり始める", "Start")}</span>
                <input type="date" value={draftBegin} onChange={(event) => setDraftBegin(event.target.value)} className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-zinc-700">{tx("期限", "Deadline")}</span>
                <input type="date" value={draftDue} onChange={(event) => setDraftDue(event.target.value)} className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm" />
              </label>
            </div>
            <button type="submit" className="min-h-[44px] w-full rounded-xl bg-zinc-900 text-sm font-semibold text-white">{tx("追加する", "Add")}</button>
          </form>
        ) : null}
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {rows.map((issue) => {
            const submitted = isIssueSubmitted(issue);
            return (
              <li key={issue.id}>
                <button type="button" onClick={() => setScreen({ kind: "task", genre: activeGenre, issueId: issue.id })} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-zinc-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-900">{issue.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {[
                        issue.assigneeId ? names[issue.assigneeId] : tx("担当未設定", "No assignee"),
                        issue.beginAt ? tx(`開始 ${isoToDateInput(issue.beginAt)}`, `Start ${isoToDateInput(issue.beginAt)}`) : "",
                        issue.dueDate ? tx(`期限 ${isoToDateInput(issue.dueDate)}`, `Due ${isoToDateInput(issue.dueDate)}`) : "",
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${submitted ? "text-emerald-600" : "text-zinc-400"}`}>
                    {submitted ? tx("提出", "Submitted") : tx("未提出", "Not submitted")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {rows.length === 0 ? <p className="text-center text-sm text-zinc-500">{tx("まだ課題はありません", "No tasks yet")}</p> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <h1 className="text-xl font-bold text-zinc-950">{tx("課題", "Tasks")}</h1>
      <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {TASK_GENRES.map((genre) => {
          const meta = GENRE_META[genre];
          const Icon = meta.icon;
          const rows = genreIssues(genre);
          const openCount = rows.filter((issue) => !isIssueSubmitted(issue)).length;
          return (
            <li key={genre} className="border-b border-zinc-100 last:border-b-0">
              <button type="button" onClick={() => setScreen({ kind: "genre", genre })} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-zinc-50">
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${meta.iconBg}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-900">{locale === "en" ? meta.en : meta.ja}</span>
                  <span className="block truncate text-xs text-zinc-500">{locale === "en" ? meta.hintEn : meta.hintJa}</span>
                </span>
                {openCount > 0 ? (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                    {openCount}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
