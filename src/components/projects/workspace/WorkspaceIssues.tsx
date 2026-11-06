"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { IssueTaskFilesPanel } from "@/components/projects/workspace/IssueTaskFilesPanel";
import { AssigneeMultiSelect } from "@/components/issues/AssigneeMultiSelect";
import { assigneeNames } from "@/lib/workspace/issueAssignees";
import { dateInputToIso, isoToDateInput, isIssueSubmitted, isTaskGenre, type TaskGenre } from "@/lib/workspace/issueWork";
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
import {
  ISSUE_STEP_MEMORY_TTL_MS,
  markIssueStepLeft,
  readRecentIssueStep,
  rememberIssueStep,
  resolveCurrentPhaseId,
} from "@/lib/workspace/issueStepMemory";
import type { CustomTaskGenreDef, Issue, Phase } from "@/lib/workspace/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** null = ステップ未設定の課題用バケット */
type PhaseKey = string | null;

type Screen =
  | { kind: "step"; phaseId: PhaseKey }
  | { kind: "genre"; phaseId: PhaseKey; genre: TaskGenre }
  | { kind: "task"; phaseId: PhaseKey; genre: TaskGenre; issueId: string };

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
    projectId,
    loading,
    issues,
    phases,
    project,
    uid,
    canEdit,
    createIssue,
    saveIssueWork,
    coachingContext,
    saveCoachingContext,
    registerBackHandler,
  } = useProjectWorkspace();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [creating, setCreating] = useState(false);
  const [addingGenre, setAddingGenre] = useState(false);
  const [draftGenreLabel, setDraftGenreLabel] = useState("");
  const [draftGenreHint, setDraftGenreHint] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAssignees, setDraftAssignees] = useState<string[]>([]);
  const [draftBegin, setDraftBegin] = useState("");
  const [draftDue, setDraftDue] = useState("");
  const [error, setError] = useState("");
  const [savingGenre, setSavingGenre] = useState(false);
  const entryHandled = useRef(false);

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

  function focusCurrentStep(): Screen {
    return { kind: "step", phaseId: resolveCurrentPhaseId(sortedPhases) };
  }

  useEffect(() => {
    if (entryHandled.current) return;
    // phases 未取得のまま「未設定」で確定しない（ロード待ち）
    if (loading) return;

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
        if (sortedPhases.length === 0) {
          entryHandled.current = true;
          setScreen(focusCurrentStep());
          return;
        }
        if (!sortedPhases.some((item) => item.id === phase)) {
          entryHandled.current = true;
          setScreen(focusCurrentStep());
          return;
        }
        phaseId = phase;
      }

      entryHandled.current = true;
      if (genre && isTaskGenre(genre)) {
        setScreen({ kind: "genre", phaseId: phaseId ?? null, genre });
      } else if (phaseId !== undefined) {
        setScreen({ kind: "step", phaseId });
      } else {
        setScreen(focusCurrentStep());
      }
      return;
    }

    // クエリなし: 短時間の離脱なら直前の実ステップ、それ以外はいまのステップ
    entryHandled.current = true;
    const validIds = new Set(sortedPhases.map((item) => item.id));
    const remembered = readRecentIssueStep(projectId, validIds);
    if (remembered) {
      setScreen({ kind: "step", phaseId: remembered });
      return;
    }
    setScreen(focusCurrentStep());
  }, [issues, loading, projectId, sortedPhases]);

  // 見ている実ステップを記憶／離脱時刻を刻む。長時間バックグラウンドならいまのステップへ戻す
  useEffect(() => {
    if (!projectId || !screen || loading) return;
    rememberIssueStep(projectId, screen.phaseId);
    let leftAtMs: number | null = null;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        leftAtMs = Date.now();
        markIssueStepLeft(projectId);
        return;
      }
      if (leftAtMs != null && Date.now() - leftAtMs > ISSUE_STEP_MEMORY_TTL_MS) {
        const next = focusCurrentStep();
        setScreen(next);
        rememberIssueStep(projectId, next.phaseId);
        setAddingGenre(false);
        setCreating(false);
        setError("");
      } else {
        rememberIssueStep(projectId, screen.phaseId);
      }
      leftAtMs = null;
    };
    const onPageHide = () => {
      leftAtMs = Date.now();
      markIssueStepLeft(projectId);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      markIssueStepLeft(projectId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- screen.phaseId で十分
  }, [loading, projectId, screen?.phaseId, sortedPhases]);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const member of project?.members ?? []) map[member.id] = member.name;
    return map;
  }, [project?.members]);

  const activeGenre = !screen || screen.kind === "step" ? null : screen.genre;
  const activeIssue =
    screen && screen.kind === "task"
      ? issues.find((issue) => issue.id === screen.issueId) ?? null
      : null;

  const stepGenres = useMemo(() => {
    if (!screen) return [] as TaskGenre[];
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
    if (!screen || screen.kind !== "step") return;
    const stepScreen = screen;
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
        (g.phaseId ?? null) === stepScreen.phaseId,
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
        phaseId: stepScreen.phaseId ?? undefined,
      };
      await saveCoachingContext({ customTaskGenres: [...customGenres, next] });
      setDraftGenreLabel("");
      setDraftGenreHint("");
      setAddingGenre(false);
      setScreen({ kind: "genre", phaseId: stepScreen.phaseId, genre: next.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("ジャンルを追加できませんでした", "Couldn’t add the genre"));
    } finally {
      setSavingGenre(false);
    }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();
    if (!screen || screen.kind !== "genre" || !draftTitle.trim()) return;
    const genreScreen = screen;
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
        genre: genreScreen.genre,
        phaseId: genreScreen.phaseId,
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

  if (!screen) {
    return <p className="text-center text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>;
  }

  if (screen.kind === "task" && activeIssue && activeGenre) {
    const meta = resolveGenreMeta(activeGenre, customGenres);
    return (
      <IssueTaskFilesPanel
        issue={activeIssue}
        members={project?.members ?? []}
        stepLabel={stepLabel(screen.phaseId, sortedPhases, tx)}
        genreLabel={locale === "en" ? meta.en : meta.ja}
        uid={uid}
        canEdit={canEdit}
        onBack={() => setScreen({ kind: "genre", phaseId: screen.phaseId, genre: activeGenre })}
        onSaveWork={(patch) => saveIssueWork(activeIssue.id, patch)}
        registerBackHandler={registerBackHandler}
      />
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
        {canEdit ? (
          <div className="flex justify-end">
            <DuoButton
              type="button"
              tone="orange"
              size="md"
              onClick={() => {
                setError("");
                setAddingGenre((v) => !v);
              }}
              className="!gap-1 !px-3 !py-2.5 !text-[13px]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {tx("ジャンルを追加", "Add genre")}
            </DuoButton>
          </div>
        ) : null}

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
        {sortedPhases.length === 0 && phaseId === null ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
            {tx(
              "ロードマップのステップがまだありません。概要のロードマップからステップを作ると、ここに表示されます。",
              "No roadmap steps yet. Create steps from the overview roadmap to organize tasks here.",
            )}
          </p>
        ) : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    );
  }

  return null;
}
