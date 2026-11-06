"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Plus, StickyNote } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { appendImageToBoard, IssueWorkspaceCanvas } from "@/components/projects/workspace/IssueWorkspaceCanvas";
import { AssigneeMultiSelect } from "@/components/issues/AssigneeMultiSelect";
import { uploadProjectImage } from "@/lib/projects/uploadProjectImage";
import { assigneeNames } from "@/lib/workspace/issueAssignees";
import { dateInputToIso, daysUntilDue, isoToDateInput, isIssueSubmitted, isTaskGenre, type TaskGenre } from "@/lib/workspace/issueWork";
import {
  boardFromPlainText,
  createEmptyBoard,
  SHEET_COLORS,
  type IssueWorkspaceBoard,
} from "@/lib/workspace/issueWorkspaceBoard";
import { sortIssuesByDueDate } from "@/lib/workspace/sortIssuesByDueDate";
import {
  createCustomTaskGenreId,
  CUSTOM_TASK_GENRE_LABEL_MAX,
  listStepTaskGenres,
  MAX_CUSTOM_TASK_GENRES,
  nextCustomColorKey,
  normalizeCustomTaskGenreLabel,
  resolveGenreMeta,
} from "@/lib/workspace/taskGenres";
import type { CustomTaskGenreDef, Issue, Phase } from "@/lib/workspace/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** null = ステップ未設定の課題用バケット */
type PhaseKey = string | null;

type Screen =
  | { kind: "list" }
  | { kind: "step"; phaseId: PhaseKey }
  | { kind: "genre"; phaseId: PhaseKey; genre: TaskGenre }
  | { kind: "task"; phaseId: PhaseKey; genre: TaskGenre; issueId: string }
  | { kind: "canvas"; phaseId: PhaseKey; genre: TaskGenre; issueId: string };

function phaseKeyOf(issue: Issue): PhaseKey {
  return issue.phaseId ?? null;
}

function stepLabel(
  phaseId: PhaseKey,
  phases: Phase[],
  tx: (ja: string, en: string) => string,
): string {
  if (!phaseId) return tx("ステップ未設定", "No step");
  const index = phases.findIndex((phase) => phase.id === phaseId);
  const phase = index >= 0 ? phases[index] : undefined;
  if (!phase) return tx("不明なステップ", "Unknown step");
  return `STEP ${index + 1}・${phase.title}`;
}

/** アイデアタブと同系のリスト用 Duo ボタン */
const LIST_DUO =
  "!justify-start !gap-3 !px-4 !py-3.5 !text-left !text-[14px] !font-bold !leading-snug";

export default function WorkspaceIssues() {
  const { tx, locale } = useI18n();
  const {
    issues,
    phases,
    project,
    uid,
    canEdit,
    createIssue,
    saveIssueWork,
    updateIssue,
    coachingContext,
    saveCoachingContext,
    registerBackHandler,
  } = useProjectWorkspace();
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  const [portalReady, setPortalReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingGenre, setAddingGenre] = useState(false);
  const [draftGenreLabel, setDraftGenreLabel] = useState("");
  const [draftGenreHint, setDraftGenreHint] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAssignees, setDraftAssignees] = useState<string[]>([]);
  const [draftBegin, setDraftBegin] = useState("");
  const [draftDue, setDraftDue] = useState("");
  const [beginDraft, setBeginDraft] = useState("");
  const [dueDraft, setDueDraft] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingGenre, setSavingGenre] = useState(false);
  const [boardDraft, setBoardDraft] = useState<IssueWorkspaceBoard>(() => createEmptyBoard());
  const fileRef = useRef<HTMLInputElement>(null);
  const boardSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryHandled = useRef(false);
  const taskId = screen.kind === "task" || screen.kind === "canvas" ? screen.issueId : "";

  const sortedPhases = useMemo(
    () => [...phases].sort((a, b) => a.order - b.order),
    [phases],
  );

  const customGenres = useMemo(
    () => coachingContext.customTaskGenres ?? [],
    [coachingContext.customTaskGenres],
  );

  const openIssues = useMemo(
    () => issues.filter((issue) => issue.status !== "cancelled"),
    [issues],
  );

  const unlinkedCount = useMemo(
    () => openIssues.filter((issue) => !issue.phaseId).length,
    [openIssues],
  );

  // 課題を開いたときだけボードを読み込む（保存後の issues 更新で編集中の下書きを潰さない）
  useEffect(() => {
    if (!taskId) return;
    const issue = issues.find((item) => item.id === taskId);
    setBoardDraft(issue?.workspaceBoard ?? boardFromPlainText(issue?.workspaceText ?? ""));
    setBeginDraft(isoToDateInput(issue?.beginAt));
    setDueDraft(isoToDateInput(issue?.dueDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- task switch only
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    const issue = issues.find((item) => item.id === taskId);
    if (!issue) return;
    setBeginDraft(isoToDateInput(issue.beginAt));
    setDueDraft(isoToDateInput(issue.dueDate));
  }, [taskId, issues]);

  useEffect(() => {
    return () => {
      if (boardSaveTimer.current) clearTimeout(boardSaveTimer.current);
    };
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (screen.kind !== "canvas") {
      registerBackHandler(null);
      return;
    }
    registerBackHandler(() => {
      setScreen({ kind: "task", phaseId: screen.phaseId, genre: screen.genre, issueId: screen.issueId });
      return true;
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      registerBackHandler(null);
      document.body.style.overflow = previousOverflow;
    };
  }, [registerBackHandler, screen]);

  function persistBoard(issueId: string, board: IssueWorkspaceBoard) {
    setBoardDraft(board);
    if (boardSaveTimer.current) clearTimeout(boardSaveTimer.current);
    boardSaveTimer.current = setTimeout(() => {
      void saveIssueWork(issueId, { workspaceBoard: board });
    }, 400);
  }

  function openCanvas(phaseId: PhaseKey, genre: TaskGenre, issueId: string) {
    setScreen({ kind: "canvas", phaseId, genre, issueId });
  }

  function closeCanvas() {
    if (screen.kind !== "canvas") return;
    setScreen({ kind: "task", phaseId: screen.phaseId, genre: screen.genre, issueId: screen.issueId });
  }

  useEffect(() => {
    if (entryHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const task = params.get("task");
    const genre = params.get("genre");
    const phase = params.get("phase");

    if (task) {
      if (issues.length === 0) return;
      const issue = issues.find((item) => item.id === task);
      entryHandled.current = true;
      if (issue) {
        setScreen({
          kind: "task",
          phaseId: phaseKeyOf(issue),
          genre: issue.genre,
          issueId: issue.id,
        });
      }
      return;
    }

    if (phase || genre) {
      let phaseId: PhaseKey | undefined;
      if (phase === "none") phaseId = null;
      else if (phase) {
        if (sortedPhases.length === 0 && phases.length === 0) return;
        if (!sortedPhases.some((item) => item.id === phase)) {
          entryHandled.current = true;
          return;
        }
        phaseId = phase;
      }

      entryHandled.current = true;
      if (genre && isTaskGenre(genre)) {
        setScreen({ kind: "genre", phaseId: phaseId ?? null, genre });
      } else if (phaseId !== undefined) {
        setScreen({ kind: "step", phaseId });
      }
      return;
    }

    // クエリなし: いまのステップのジャンル一覧へ
    if (sortedPhases.length === 0 && phases.length > 0) return;
    entryHandled.current = true;
    const inProgress = sortedPhases.find((item) => item.status === "in_progress");
    const firstOpen = sortedPhases.find((item) => item.status !== "completed");
    const focus = inProgress ?? firstOpen ?? sortedPhases[0];
    if (focus) setScreen({ kind: "step", phaseId: focus.id });
  }, [issues, phases.length, sortedPhases]);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const member of project?.members ?? []) map[member.id] = member.name;
    return map;
  }, [project?.members]);

  const activeGenre = screen.kind === "list" || screen.kind === "step" ? null : screen.genre;
  const activeIssue =
    screen.kind === "task" || screen.kind === "canvas"
      ? issues.find((issue) => issue.id === screen.issueId) ?? null
      : null;

  const stepGenres = useMemo(() => {
    if (screen.kind === "list") return [] as TaskGenre[];
    return listStepTaskGenres(screen.phaseId, customGenres, openIssues);
  }, [screen, customGenres, openIssues]);

  /** 未提出を先に、その中では提出期限が近い順。提出済みは後ろ。 */
  function issuesFor(phaseId: PhaseKey, genre?: TaskGenre) {
    const filtered = openIssues.filter((issue) => {
      if (phaseKeyOf(issue) !== phaseId) return false;
      if (genre && issue.genre !== genre) return false;
      return true;
    });
    const open = sortIssuesByDueDate(filtered.filter((issue) => !isIssueSubmitted(issue)));
    const done = sortIssuesByDueDate(filtered.filter((issue) => isIssueSubmitted(issue)));
    return [...open, ...done];
  }

  function openCountFor(phaseId: PhaseKey, genre?: TaskGenre) {
    return issuesFor(phaseId, genre).filter((issue) => !isIssueSubmitted(issue)).length;
  }

  async function addCustomGenre(event: FormEvent) {
    event.preventDefault();
    if (screen.kind !== "step") return;
    const labelJa = normalizeCustomTaskGenreLabel(draftGenreLabel);
    if (!labelJa) {
      setError(tx("ジャンル名を入力してください", "Enter a genre name"));
      return;
    }
    if (customGenres.length >= MAX_CUSTOM_TASK_GENRES) {
      setError(tx(`ジャンルは最大${MAX_CUSTOM_TASK_GENRES}個までです`, `You can add up to ${MAX_CUSTOM_TASK_GENRES} genres`));
      return;
    }
    const duplicate = customGenres.some(
      (g) =>
        g.labelJa.toLowerCase() === labelJa.toLowerCase() &&
        (g.phaseId ?? null) === screen.phaseId,
    );
    if (duplicate) {
      setError(tx("同じ名前のジャンルがすでにあります", "That genre name already exists"));
      return;
    }
    setSavingGenre(true);
    setError("");
    try {
      const next: CustomTaskGenreDef = {
        id: createCustomTaskGenreId(),
        labelJa,
        hintJa: draftGenreHint.trim().slice(0, 60) || undefined,
        colorKey: nextCustomColorKey(customGenres.length),
        phaseId: screen.phaseId ?? undefined,
      };
      await saveCoachingContext({ customTaskGenres: [...customGenres, next] });
      setDraftGenreLabel("");
      setDraftGenreHint("");
      setAddingGenre(false);
      setScreen({ kind: "genre", phaseId: screen.phaseId, genre: next.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("ジャンルを追加できませんでした", "Couldn’t add the genre"));
    } finally {
      setSavingGenre(false);
    }
  }

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
        assigneeIds: draftAssignees,
        genre: screen.genre,
        phaseId: screen.phaseId,
        beginAt,
        dueDate,
      });
      setDraftTitle("");
      setDraftAssignees([]);
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
      let nextBoard = boardDraft;
      for (const file of Array.from(files)) {
        const result = await uploadProjectImage(supabase, uid, "issue-photo", activeIssue.id, file);
        nextBoard = appendImageToBoard(nextBoard, result.publicUrl);
      }
      if (boardSaveTimer.current) clearTimeout(boardSaveTimer.current);
      setBoardDraft(nextBoard);
      await saveIssueWork(activeIssue.id, { workspaceBoard: nextBoard });
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

  if (screen.kind === "canvas" && activeIssue) {
    if (!portalReady) return null;
    return createPortal(
      <div className="fixed inset-0 z-[240] overflow-hidden overscroll-none bg-white">
        <IssueWorkspaceCanvas
          board={boardDraft}
          canEdit={canEdit}
          uploading={uploading}
          fullscreen
          onChange={(board) => persistBoard(activeIssue.id, board)}
          onRequestPhoto={() => fileRef.current?.click()}
          toolbarStart={
            <button
              type="button"
              data-board-ui
              onClick={closeCanvas}
              className="inline-flex h-10 shrink-0 items-center gap-0.5 rounded-xl border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span>{tx("戻る", "Back")}</span>
            </button>
          }
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => void addPhotos(event.target.files)}
        />
        {error ? (
          <p className="absolute bottom-4 left-1/2 z-10 max-w-sm -translate-x-1/2 rounded-full bg-rose-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg">
            {error}
          </p>
        ) : null}
        {uploading ? (
          <p className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-zinc-900/85 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {tx("写真を追加中…", "Adding photo…")}
          </p>
        ) : null}
      </div>,
      document.body,
    );
  }

  if (screen.kind === "task" && activeIssue && activeGenre) {
    const meta = resolveGenreMeta(activeGenre, customGenres);
    const submitted = isIssueSubmitted(activeIssue);
    const assignee = assigneeNames(activeIssue, names).join("、");
    const due = dueLabel(activeIssue);
    const previewSheets = boardDraft.items.filter((item) => item.kind === "sheet").slice(0, 4);
    const phaseId = screen.phaseId;
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScreen({ kind: "genre", phaseId, genre: activeGenre })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100"
            aria-label={tx("戻る", "Back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="min-w-0 truncate text-sm font-semibold text-zinc-500">
            {stepLabel(phaseId, sortedPhases, tx)}
            <span className="text-zinc-300"> · </span>
            {locale === "en" ? meta.en : meta.ja}
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
        <button
          type="button"
          onClick={() => openCanvas(phaseId, activeGenre, activeIssue.id)}
          className="group flex w-full items-stretch overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 text-left transition hover:border-orange-300 hover:bg-orange-50/40"
          aria-label={tx("移動", "Go")}
        >
          <div
            className="relative min-h-[4.5rem] min-w-0 flex-1 overflow-hidden"
            style={{
              backgroundColor: "#F4F4F5",
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(161,161,170,0.35) 1px, transparent 0)",
              backgroundSize: "16px 16px",
            }}
          >
            {previewSheets.length > 0 ? (
              <div className="absolute inset-0 flex items-center gap-2 px-3">
                {previewSheets.map((sheet) => (
                  <span
                    key={sheet.id}
                    className="h-12 w-11 shrink-0 overflow-hidden rounded-sm border px-1 py-0.5 text-[8px] leading-tight text-zinc-800 shadow-sm"
                    style={{
                      backgroundColor: SHEET_COLORS[sheet.color].bg,
                      borderColor: SHEET_COLORS[sheet.color].border,
                    }}
                  >
                    {(sheet.text || " ").slice(0, 18)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-400">
                <StickyNote className="h-5 w-5" aria-hidden />
              </div>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 bg-zinc-900 px-4 text-sm font-semibold text-white group-hover:bg-orange-500">
            {tx("移動", "Go")}
            <ArrowRight className="h-4 w-4" />
          </span>
        </button>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <DuoButton
          type="button"
          tone="orange"
          size="lg"
          fullWidth
          disabled={!canEdit || submitted}
          onClick={() => {
            if (boardSaveTimer.current) {
              clearTimeout(boardSaveTimer.current);
              boardSaveTimer.current = null;
            }
            void saveIssueWork(activeIssue.id, {
              workspaceBoard: boardDraft,
              submittedAt: new Date().toISOString(),
            });
          }}
          className="!text-[16px]"
        >
          {submitted ? tx("提出済み", "Submitted") : tx("提出する", "Submit")}
        </DuoButton>
      </div>
    );
  }

  if (screen.kind === "genre" && activeGenre) {
    const meta = resolveGenreMeta(activeGenre, customGenres);
    const Icon = meta.icon;
    const rows = issuesFor(screen.phaseId, activeGenre);
    const doneCount = rows.filter((issue) => isIssueSubmitted(issue)).length;
    const phaseId = screen.phaseId;
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setScreen({ kind: "step", phaseId });
              setCreating(false);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100"
            aria-label={tx("戻る", "Back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-white ${meta.iconBg}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-zinc-500">
              {stepLabel(phaseId, sortedPhases, tx)}
            </p>
            <h1 className="truncate text-lg font-bold text-zinc-950">{locale === "en" ? meta.en : meta.ja}</h1>
            <p className="text-xs text-zinc-500">{tx(`${doneCount}/${rows.length}件完了`, `${doneCount}/${rows.length} done`)}</p>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#FF9600] text-white shadow-[0_4px_0_#D97706] transition-[transform,box-shadow] duration-75 active:translate-y-[4px] active:shadow-none"
              aria-label={tx("課題を追加", "Add task")}
            >
              <Plus className="h-5 w-5" aria-hidden strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
        {creating ? (
          <form className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3" onSubmit={(event) => void addTask(event)}>
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder={tx("課題名", "Task name")}
              className="min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm"
            />
            <div>
              <span className="text-sm font-semibold text-zinc-700">{tx("担当（複数可）", "Assignees")}</span>
              <AssigneeMultiSelect
                members={project?.members ?? []}
                selectedIds={draftAssignees}
                onChange={setDraftAssignees}
                idPrefix="draft-assignee"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-semibold text-zinc-700">{tx("やり始める", "Start")}</span>
                <input
                  type="date"
                  value={draftBegin}
                  onChange={(event) => setDraftBegin(event.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-zinc-700">{tx("期限", "Deadline")}</span>
                <input
                  type="date"
                  value={draftDue}
                  onChange={(event) => setDraftDue(event.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm"
                />
              </label>
            </div>
            <DuoButton type="submit" tone="orange" size="md" fullWidth className="!text-[15px]">
              {tx("追加する", "Add")}
            </DuoButton>
          </form>
        ) : null}
        <div className="flex flex-col gap-2.5">
          {rows.map((issue) => {
            const submitted = isIssueSubmitted(issue);
            return (
              <DuoButton
                key={issue.id}
                type="button"
                tone={submitted ? "lime" : "peach"}
                size="md"
                fullWidth
                onClick={() =>
                  setScreen({ kind: "task", phaseId, genre: activeGenre, issueId: issue.id })
                }
                className={LIST_DUO}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="line-clamp-2">{issue.title}</span>
                  <span className={`truncate text-[11px] font-semibold ${submitted ? "text-[#3F6212]/75" : "text-[#9A5B1F]/80"}`}>
                    {[
                      assigneeNames(issue, names).join("、") || tx("担当未設定", "No assignee"),
                      issue.dueDate
                        ? tx(`期限 ${isoToDateInput(issue.dueDate)}`, `Due ${isoToDateInput(issue.dueDate)}`)
                        : "",
                      submitted ? tx("提出済み", "Submitted") : tx("未提出", "Not submitted"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              </DuoButton>
            );
          })}
        </div>
        {rows.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">{tx("まだ課題はありません", "No tasks yet")}</p>
        ) : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    );
  }

  if (screen.kind === "step") {
    const phaseId = screen.phaseId;
    const phaseOpen = openCountFor(phaseId);
    const stepKeys: PhaseKey[] = [
      ...sortedPhases.map((phase) => phase.id),
      ...(unlinkedCount > 0 || sortedPhases.length === 0 ? ([null] as PhaseKey[]) : []),
    ];
    const stepIndex = stepKeys.findIndex((key) => key === phaseId);
    const prevStepId = stepIndex > 0 ? stepKeys[stepIndex - 1]! : undefined;
    const nextStepId = stepIndex >= 0 && stepIndex < stepKeys.length - 1 ? stepKeys[stepIndex + 1]! : undefined;

    function goToNeighbor(nextId: PhaseKey) {
      setAddingGenre(false);
      setCreating(false);
      setError("");
      setDraftGenreLabel("");
      setDraftGenreHint("");
      setScreen({ kind: "step", phaseId: nextId });
    }

    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setScreen({ kind: "list" });
              setAddingGenre(false);
              setCreating(false);
              setError("");
            }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-zinc-100"
            aria-label={tx("ステップ一覧", "All steps")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          {canEdit ? (
            <DuoButton
              type="button"
              tone="orange"
              size="md"
              onClick={() => {
                setError("");
                setAddingGenre((v) => !v);
              }}
              className="ml-auto !gap-1 !px-3 !py-2.5 !text-[13px]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {tx("ジャンルを追加", "Add genre")}
            </DuoButton>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={prevStepId === undefined}
            onClick={() => {
              if (prevStepId === undefined) return;
              goToNeighbor(prevStepId);
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFE0A8] text-[#9A5B1F] shadow-[0_4px_0_#F0B85A] transition-[transform,box-shadow] duration-75 enabled:active:translate-y-[4px] enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={tx("前のステップ", "Previous step")}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden strokeWidth={2.5} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-bold tracking-[0.12em] text-zinc-400">{tx("ステップ", "STEP")}</p>
            <h1 className="truncate text-lg font-bold text-zinc-950">{stepLabel(phaseId, sortedPhases, tx)}</h1>
            <p className="text-xs text-zinc-500">
              {tx(`未提出 ${phaseOpen}件`, `${phaseOpen} not submitted`)}
            </p>
          </div>
          <button
            type="button"
            disabled={nextStepId === undefined}
            onClick={() => {
              if (nextStepId === undefined) return;
              goToNeighbor(nextStepId);
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFE0A8] text-[#9A5B1F] shadow-[0_4px_0_#F0B85A] transition-[transform,box-shadow] duration-75 enabled:active:translate-y-[4px] enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={tx("次のステップ", "Next step")}
          >
            <ChevronRight className="h-5 w-5" aria-hidden strokeWidth={2.5} />
          </button>
        </div>

        {addingGenre && canEdit ? (
          <form
            className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3"
            onSubmit={(event) => void addCustomGenre(event)}
          >
            <p className="text-sm font-semibold text-zinc-900">{tx("このステップの新しいジャンル", "New genre for this step")}</p>
            <input
              value={draftGenreLabel}
              onChange={(event) => setDraftGenreLabel(event.target.value)}
              maxLength={CUSTOM_TASK_GENRE_LABEL_MAX}
              placeholder={tx("例: 撮影・編集", "e.g. Filming & editing")}
              className="min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm"
              autoFocus
            />
            <input
              value={draftGenreHint}
              onChange={(event) => setDraftGenreHint(event.target.value)}
              maxLength={60}
              placeholder={tx("説明（任意）", "Description (optional)")}
              className="min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm"
            />
            <div className="flex gap-2.5">
              <DuoButton
                type="button"
                tone="zinc"
                size="md"
                onClick={() => {
                  setAddingGenre(false);
                  setDraftGenreLabel("");
                  setDraftGenreHint("");
                  setError("");
                }}
                className="flex-1 !text-[15px]"
              >
                {tx("キャンセル", "Cancel")}
              </DuoButton>
              <DuoButton
                type="submit"
                tone="orange"
                size="md"
                disabled={savingGenre || !draftGenreLabel.trim()}
                className="flex-[2] !text-[15px]"
              >
                {savingGenre ? tx("追加中…", "Adding…") : tx("追加する", "Add")}
              </DuoButton>
            </div>
          </form>
        ) : null}

        <div className="flex flex-col gap-2.5">
          {[...stepGenres]
            .sort((a, b) => openCountFor(phaseId, b) - openCountFor(phaseId, a))
            .map((genre) => {
            const meta = resolveGenreMeta(genre, customGenres);
            const Icon = meta.icon;
            const openCount = openCountFor(phaseId, genre);
            return (
              <DuoButton
                key={genre}
                type="button"
                tone="peach"
                size="md"
                fullWidth
                onClick={() => setScreen({ kind: "genre", phaseId, genre })}
                className={LIST_DUO}
              >
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${meta.iconBg}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate">{locale === "en" ? meta.en : meta.ja}</span>
                  <span className="truncate text-[11px] font-semibold text-[#9A5B1F]/80">
                    {locale === "en" ? meta.hintEn : meta.hintJa}
                  </span>
                </span>
                {openCount > 0 ? (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF4B4B] px-1.5 text-xs font-extrabold text-white shadow-[0_2px_0_#C43232]">
                    {openCount}
                  </span>
                ) : (
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                )}
              </DuoButton>
            );
          })}
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-zinc-950">{tx("課題", "Tasks")}</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {tx("ロードマップのステップごとにジャンルと課題を整理", "Organize genres and tasks by roadmap step")}
          </p>
        </div>
      </div>

      {sortedPhases.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
          {tx(
            "ロードマップのステップがまだありません。概要のロードマップからステップを作ると、ここに表示されます。",
            "No roadmap steps yet. Create steps from the overview roadmap to organize tasks here.",
          )}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sortedPhases.map((phase, index) => {
            const openCount = openCountFor(phase.id);
            const inProgress = phase.status === "in_progress";
            return (
              <DuoButton
                key={phase.id}
                type="button"
                tone={inProgress ? "orange" : "peach"}
                size="md"
                fullWidth
                onClick={() => {
                  setAddingGenre(false);
                  setScreen({ kind: "step", phaseId: phase.id });
                }}
                className={LIST_DUO}
              >
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                    inProgress
                      ? "bg-white/25 text-white"
                      : "bg-[#FF9600] text-white shadow-[0_2px_0_#D97706]"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`text-[11px] font-extrabold tracking-[0.1em] ${inProgress ? "text-white/80" : "text-[#9A5B1F]/75"}`}>
                    STEP {index + 1}
                    {inProgress ? (
                      <span className="ml-2 tracking-normal">{tx("いまここ", "Current")}</span>
                    ) : null}
                  </span>
                  <span className="truncate">{phase.title}</span>
                  {phase.goal ? (
                    <span className={`truncate text-[11px] font-semibold ${inProgress ? "text-white/75" : "text-[#9A5B1F]/80"}`}>
                      {phase.goal}
                    </span>
                  ) : null}
                </span>
                {openCount > 0 ? (
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-extrabold ${
                      inProgress
                        ? "bg-white text-[#FF9600]"
                        : "bg-[#FF4B4B] text-white shadow-[0_2px_0_#C43232]"
                    }`}
                  >
                    {openCount}
                  </span>
                ) : (
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                )}
              </DuoButton>
            );
          })}
        </div>
      )}

      {unlinkedCount > 0 || sortedPhases.length === 0 ? (
        <div className="flex flex-col gap-2.5">
          <DuoButton
            type="button"
            tone="zinc"
            size="md"
            fullWidth
            onClick={() => {
              setAddingGenre(false);
              setScreen({ kind: "step", phaseId: null });
            }}
            className={LIST_DUO}
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-300 text-xs font-extrabold text-zinc-700">
              —
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate">{tx("ステップ未設定", "No step")}</span>
              <span className="truncate text-[11px] font-semibold text-zinc-500">
                {tx("ロードマップにまだついていない課題", "Tasks not linked to a roadmap step")}
              </span>
            </span>
            {unlinkedCount > 0 ? (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF4B4B] px-1.5 text-xs font-extrabold text-white shadow-[0_2px_0_#C43232]">
                {unlinkedCount}
              </span>
            ) : (
              <ArrowRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            )}
          </DuoButton>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
