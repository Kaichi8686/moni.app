"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectRow } from "@/lib/projects/types";
import type { CoachingContext } from "@/lib/projects/coachingContext";
import { roadmapDonePercent, pickFocusStep } from "@/lib/projects/roadmapFocus";
import { focusPhaseIndex1Based, pickPrimaryTodayTask } from "@/lib/projects/todayFocus";
import { normalizeTaskStatus } from "@/lib/projects/taskStatus";
import { startOfWeekMondayJapanMs, todayKeyJapan } from "@/lib/projects/teamActivityStreak";
import { burstCelebration } from "@/lib/ui/confetti";
import type { TaskPanelRow } from "@/components/projects/ProjectTasksPanel";
import type { RoadmapStepFull } from "@/components/projects/ProjectRoadmapPanel";

type Props = {
  project: ProjectRow;
  coaching: CoachingContext;
  steps: RoadmapStepFull[];
  tasks: TaskPanelRow[];
  memberNames?: Record<string, string>;
  canEdit: boolean;
  onOpenRoadmap: () => void;
  onOpenTasks: () => void;
  onShareTeam: () => void | Promise<void>;
  onCompleteTask: (taskId: string) => void | Promise<void>;
  onAddAiTodoSuggestions?: (items: Array<{ title: string; minutes: number }>) => void | Promise<void>;
  onOpenWeeklyMemo?: () => void;
  /** 週目標など coaching_context の部分更新 */
  onSaveCoaching?: (patch: Partial<CoachingContext>) => Promise<void>;
};

function oneLineSummary(project: ProjectRow, coaching: CoachingContext): string {
  const dream = coaching.dreamStatement?.trim();
  if (dream) return dream;
  const cat = project.category?.trim();
  if (cat) return cat;
  const desc = project.description?.trim();
  if (desc) return desc.length > 72 ? `${desc.slice(0, 72)}…` : desc;
  return "ひとことで「何をしたいか」を設定すると、チームと認識がそろいやすくなります。";
}

function SegmentedBar({ percent }: { percent: number }) {
  const segments = 10;
  const filled = Math.round((percent / 100) * segments);
  return (
    <div className="startup-font-mono flex gap-1" aria-hidden>
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={`h-2 min-w-0 flex-1 rounded-full transition-[background-color] duration-200 ease-out ${
            i < filled ? "bg-[#FF5C35]" : "bg-zinc-200/90"
          }`}
        />
      ))}
    </div>
  );
}

const STREAK_BADGE_THRESHOLDS = [3, 7, 14, 30] as const;

function streakBadgeFor(days: number): { label: string; emoji: string } | null {
  if (days >= 30) return { label: "レジェンド級ストリーク", emoji: "🏆" };
  if (days >= 14) return { label: "半月チャンプ", emoji: "⭐" };
  if (days >= 7) return { label: "週マスター", emoji: "🎯" };
  if (days >= 3) return { label: "スタートダッシュ", emoji: "✨" };
  return null;
}

function nextStreakBadgeThreshold(days: number): number | null {
  for (const m of STREAK_BADGE_THRESHOLDS) {
    if (days < m) return m;
  }
  return null;
}

export function ProjectHomePanel({
  project,
  coaching,
  steps,
  tasks,
  memberNames = {},
  canEdit,
  onOpenRoadmap,
  onOpenTasks,
  onShareTeam,
  onCompleteTask,
  onAddAiTodoSuggestions,
  onOpenWeeklyMemo,
  onSaveCoaching,
}: Props) {
  const summary = useMemo(() => oneLineSummary(project, coaching), [project, coaching]);
  const primary = useMemo(() => pickPrimaryTodayTask(tasks, steps), [tasks, steps]);
  const pct = useMemo(() => roadmapDonePercent(steps), [steps]);
  const { current, total } = useMemo(() => focusPhaseIndex1Based(steps), [steps]);
  const focus = useMemo(() => pickFocusStep(steps), [steps]);
  const [aiItems, setAiItems] = useState<Array<{ title: string; minutes: number }> | null>(null);
  const [weeklyGoalSaving, setWeeklyGoalSaving] = useState(false);
  const [weeklyGoalDraft, setWeeklyGoalDraft] = useState("");
  const weeklyGoal = coaching.weeklyCompletionGoal;

  useEffect(() => {
    setWeeklyGoalDraft(weeklyGoal != null ? String(weeklyGoal) : "");
  }, [weeklyGoal]);

  const streakDays = coaching.teamActivityStreak ?? 0;
  const tokyoDayKey = todayKeyJapan();
  const streakBadge = streakBadgeFor(streakDays);
  const nextStreakTarget = nextStreakBadgeThreshold(streakDays);

  const weekCompleted = useMemo(() => {
    const cutoff = startOfWeekMondayJapanMs();
    return tasks
      .filter((t) => normalizeTaskStatus(t.status) === "done" && new Date(t.updated_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [tasks, tokyoDayKey]);

  const memberWeekContributions = useMemo(() => {
    const cutoff = startOfWeekMondayJapanMs();
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (normalizeTaskStatus(t.status) !== "done") continue;
      if (new Date(t.updated_at).getTime() < cutoff) continue;
      const uid = t.assignee_id ?? t.created_by;
      const key = uid ?? "__unassigned";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({
        key,
        count,
        label: key === "__unassigned" ? "担当なし" : memberNames[key] ?? "メンバー",
      }))
      .sort((a, b) => b.count - a.count);
  }, [tasks, memberNames, tokyoDayKey]);

  const teamFeedLines = useMemo(() => {
    const cutoff = startOfWeekMondayJapanMs();
    const done = [...tasks]
      .filter((t) => normalizeTaskStatus(t.status) === "done" && new Date(t.updated_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8);
    return done.map((t) => {
      const uid = t.assignee_id ?? t.created_by;
      const name = uid ? memberNames[uid] ?? "メンバー" : "チーム";
      const short = t.title.length > 40 ? `${t.title.slice(0, 40)}…` : t.title;
      return { id: t.id, text: `${name}が「${short}」を完了` };
    });
  }, [tasks, memberNames, tokyoDayKey]);

  const weeklyMemoPreview = useMemo(() => {
    const wr = coaching.weeklyReview;
    const chunks = [wr?.done, wr?.learned, wr?.next]
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean);
    const joined = chunks.join(" · ");
    const line =
      joined.length === 0 ? null : joined.length > 120 ? `${joined.slice(0, 120).trim()}…` : joined;
    const updatedLabel =
      wr?.updatedAt != null
        ? new Date(wr.updatedAt).toLocaleString("ja-JP", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;
    return { line, updatedLabel };
  }, [coaching.weeklyReview]);

  const milestoneDaysUntil = useMemo(() => {
    const due = focus?.due_date;
    if (!due) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(`${due.slice(0, 10)}T00:00:00`);
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  }, [focus?.due_date]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const fetchAiTodos = useCallback(async () => {
    setAiLoading(true);
    setAiNote(null);
    try {
      const doneTitles = tasks
        .filter((t) => normalizeTaskStatus(t.status) === "done")
        .slice(0, 12)
        .map((t) => t.title);
      const openTitles = tasks
        .filter((t) => normalizeTaskStatus(t.status) !== "done")
        .slice(0, 18)
        .map((t) => t.title);
      const res = await fetch("/api/projects/coach/today-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.name,
          projectDescription: project.description ?? "",
          dreamStatement: coaching.dreamStatement ?? "",
          focusPhaseTitle: focus?.title ?? null,
          focusPhaseStatus: focus?.status ?? null,
          completedTaskTitles: doneTitles,
          openTaskTitles: openTitles,
        }),
      });
      const data = (await res.json()) as {
        items?: Array<{ title?: string; minutes?: number }>;
        offline?: boolean;
        fallback?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "提案の取得に失敗しました");
      const raw = Array.isArray(data.items) ? data.items : [];
      const cleaned = raw
        .map((x) => ({
          title: typeof x.title === "string" ? x.title.trim() : "",
          minutes: typeof x.minutes === "number" ? x.minutes : 30,
        }))
        .filter((x) => x.title.length > 0)
        .slice(0, 3);
      setAiItems(cleaned.length ? cleaned : null);
      if (data.offline) setAiNote("APIキー未設定のためサンプル提案です。.env に ANTHROPIC_API_KEY を入れるとAIが動きます。");
      else if (data.fallback) setAiNote("AIの整形に失敗したためサンプルに置き換えました。");
    } catch (e) {
      setAiNote(e instanceof Error ? e.message : "エラーが発生しました");
      setAiItems(null);
    } finally {
      setAiLoading(false);
    }
  }, [tasks, project.name, project.description, coaching.dreamStatement, focus]);

  const persistWeeklyGoal = useCallback(
    async (value: number | null) => {
      if (!onSaveCoaching || !canEdit) return;
      setWeeklyGoalSaving(true);
      try {
        await onSaveCoaching(
          value != null && value >= 1 && value <= 99 ? { weeklyCompletionGoal: Math.floor(value) } : { weeklyCompletionGoal: 0 },
        );
      } finally {
        setWeeklyGoalSaving(false);
      }
    },
    [canEdit, onSaveCoaching],
  );

  const saveWeeklyGoalFromDraft = useCallback(async () => {
    const raw = weeklyGoalDraft.trim();
    if (!raw) {
      await persistWeeklyGoal(null);
      return;
    }
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 99) return;
    await persistWeeklyGoal(n);
  }, [persistWeeklyGoal, weeklyGoalDraft]);

  const completePrimary = () => {
    if (!primary || !canEdit) return;
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (!reduceMotion) burstCelebration();
    void onCompleteTask(primary.id);
  };

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-[#1A1A1A]" style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}>
          {project.name}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600" style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}>
          {summary}
        </p>
      </header>

      <div
        className="rounded-2xl border border-orange-100 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow duration-200 ease-out"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]" style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}>
          <span className="text-lg" aria-hidden>
            📍
          </span>
          今日やること
        </div>
        {primary ? (
          <>
            <p className="mt-3 text-base font-semibold leading-snug text-[#1A1A1A]" style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}>
              {primary.title}
            </p>
            {focus ? (
              <p className="mt-1 text-xs text-zinc-500">いまのフェーズ「{focus.title}」に関連するおすすめです。</p>
            ) : null}
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => void completePrimary()}
              className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-[#FF5C35] px-4 text-sm font-bold text-white shadow-sm transition duration-200 ease-out hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}
            >
              完了にする
            </button>
          </>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm leading-relaxed text-zinc-600">
              まだ今日の一手が決まっていません。ロードマップで進める段階を決めるか、タスク・予定から1件追加してみましょう。
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onOpenRoadmap}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-[#FF5C35] px-4 text-sm font-bold text-white transition duration-200 ease-out hover:brightness-105"
              >
                ロードマップを見る
              </button>
              <button
                type="button"
                onClick={onOpenTasks}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 transition duration-200 ease-out hover:bg-zinc-50"
              >
                タスク・予定へ
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]" style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}>
            <span aria-hidden>💡</span>
            今日できること（AI提案）
          </div>
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => void fetchAiTodos()}
            className="min-h-[36px] rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-[11px] font-semibold text-zinc-800 transition duration-200 ease-out hover:bg-white disabled:opacity-50"
          >
            {aiItems ? "別の提案を見る" : "提案を見る"}
          </button>
        </div>
        {aiNote ? <p className="mt-2 text-[11px] text-amber-800">{aiNote}</p> : null}
        {aiLoading ? <p className="mt-3 text-sm text-zinc-500">考え中…</p> : null}
        {!aiLoading && aiItems && aiItems.length > 0 ? (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#1A1A1A]">
            {aiItems.map((item, i) => (
              <li key={`${item.title}-${i}`} className="leading-snug">
                <span className="font-medium">{item.title}</span>
                <span className="startup-font-mono ml-1 text-xs text-zinc-500">（{item.minutes}分）</span>
              </li>
            ))}
          </ol>
        ) : null}
        {!aiLoading && aiItems && aiItems.length > 0 && onAddAiTodoSuggestions && canEdit ? (
          <button
            type="button"
            onClick={() => void onAddAiTodoSuggestions(aiItems)}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-orange-200 bg-[#FFF3D6]/90 px-4 text-sm font-bold text-[#1A1A1A] transition duration-200 ease-out hover:bg-[#FFF3D6]"
          >
            今日のToDoにセット（タスク・予定へ追加）
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]" style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}>
          <span aria-hidden>📊</span>
          今週の動き
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          今週（月曜開始・東京）のタスク完了・目標・連続活動・メンバー別・ログ・メモです。ストリーク／週目標の達成時はお祝い演出があります（モーション軽減時は無効）。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
            <p className="text-[11px] font-semibold text-zinc-500">今週で完了</p>
            <p className="startup-font-mono mt-1 text-xl font-bold text-[#1A1A1A]">{weekCompleted.length}</p>
            {weeklyGoal != null ? (
              <>
                <p className="mt-2 text-[10px] font-semibold text-zinc-600">
                  目標{" "}
                  <span className="startup-font-mono">{weekCompleted.length}</span>
                  <span className="text-zinc-400">/</span>
                  <span className="startup-font-mono">{weeklyGoal}</span>
                  {weekCompleted.length >= weeklyGoal ? (
                    <span className="ml-1 font-semibold text-emerald-700">達成</span>
                  ) : null}
                </p>
                <div className="mt-1.5">
                  <SegmentedBar percent={Math.min(100, Math.round((weekCompleted.length / weeklyGoal) * 100))} />
                </div>
              </>
            ) : null}
            {weekCompleted.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[11px] leading-snug text-zinc-700">
                {weekCompleted.slice(0, 3).map((t) => (
                  <li key={t.id} className="truncate">
                    · {t.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-zinc-500">まだありません</p>
            )}
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
            <p className="text-[11px] font-semibold text-zinc-500">連続活動（チーム）</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-xl" aria-hidden>
                🔥
              </span>
              <span className="startup-font-mono text-xl font-bold text-[#1A1A1A]">{streakDays}</span>
              <span className="text-xs text-zinc-600">日</span>
            </p>
            <p className="mt-2 text-[11px] text-zinc-500">東京日付で、チームに完了があった連続日数です。</p>
            {streakBadge ? (
              <p className="mt-2 rounded-lg bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-950 ring-1 ring-orange-100">
                <span aria-hidden>{streakBadge.emoji}</span> {streakBadge.label}
              </p>
            ) : null}
            {streakDays === 0 ? (
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                今日、タスクまたはフェーズを完了するとストリークが始まります。
              </p>
            ) : nextStreakTarget != null ? (
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                次のバッジ「{nextStreakTarget}日連続」まで あと{nextStreakTarget - streakDays}日
              </p>
            ) : (
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">30日連続バッジ達成！この調子で続けよう。</p>
            )}
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 sm:col-span-1">
            <p className="text-[11px] font-semibold text-zinc-500">マイルストーン</p>
            {milestoneDaysUntil !== null ? (
              milestoneDaysUntil < 0 ? (
                <p className="mt-2 text-sm font-semibold text-rose-700">期限を過ぎています</p>
              ) : milestoneDaysUntil === 0 ? (
                <p className="mt-2 text-sm font-semibold text-[#1A1A1A]">今日が期限です</p>
              ) : (
                <p className="mt-2 text-sm font-semibold text-[#1A1A1A]">いまのフェーズまで あと{milestoneDaysUntil}日</p>
              )
            ) : (
              <p className="mt-2 text-[11px] text-zinc-500">フェーズに期限がないため表示できません</p>
            )}
          </div>
        </div>
        {canEdit && onSaveCoaching ? (
          <div className="mt-4 rounded-xl border border-orange-100 bg-[#FFF9F5]/90 p-3">
            <p className="text-[11px] font-semibold text-zinc-600">今週の完了目標（任意）</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">
              チームで狙う「今週のタスク完了」件数。達成時に紙吹雪が出ます（モーション軽減では無効）。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[3, 5, 8, 10, 15].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={weeklyGoalSaving}
                  onClick={() => void persistWeeklyGoal(n)}
                  className={`min-h-[34px] rounded-xl px-3 text-[11px] font-semibold transition disabled:opacity-50 ${
                    weeklyGoal === n ? "bg-[#FF5C35] text-white shadow-sm" : "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  {n}件
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                max={99}
                inputMode="numeric"
                value={weeklyGoalDraft}
                onChange={(e) => setWeeklyGoalDraft(e.target.value)}
                placeholder="1〜99"
                className="min-h-[40px] w-[5.5rem] rounded-xl border border-zinc-200 bg-white px-2 text-center text-sm font-semibold text-zinc-900 outline-none focus:border-[#FF5C35]"
              />
              <button
                type="button"
                disabled={weeklyGoalSaving}
                onClick={() => void saveWeeklyGoalFromDraft()}
                className="min-h-[40px] rounded-xl bg-zinc-900 px-3 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {weeklyGoalSaving ? "保存中…" : "保存"}
              </button>
              <button
                type="button"
                disabled={weeklyGoalSaving}
                onClick={() => void persistWeeklyGoal(null)}
                className="min-h-[40px] rounded-xl border border-zinc-200 bg-white px-3 text-[11px] font-semibold text-zinc-700 disabled:opacity-50"
              >
                クリア
              </button>
            </div>
          </div>
        ) : weeklyGoal != null ? (
          <p className="mt-4 text-[11px] text-zinc-600">
            チームの週の完了目標: <span className="startup-font-mono font-semibold">{weeklyGoal}</span> 件
          </p>
        ) : null}
        <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-3">
          <p className="text-[11px] font-semibold text-zinc-500">メンバー別・今週の完了</p>
          <p className="mt-0.5 text-[10px] text-zinc-400">完了したタスクを「担当」→なければ「作成者」で集計しています。</p>
          {memberWeekContributions.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {memberWeekContributions.map((row, i) => (
                <li key={row.key} className="flex items-center gap-2 text-[11px]">
                  <span className="startup-font-mono w-5 shrink-0 text-center text-[10px] font-bold text-zinc-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">{row.label}</span>
                  <span className="startup-font-mono shrink-0 font-semibold text-[#1A1A1A]">{row.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-zinc-500">今週まだ完了がありません。</p>
          )}
        </div>
        {(weeklyMemoPreview.line || canEdit) && (
          <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-zinc-500">今週のメモ</p>
              {weeklyMemoPreview.updatedLabel ? (
                <span className="text-[10px] text-zinc-400">更新 {weeklyMemoPreview.updatedLabel}</span>
              ) : null}
            </div>
            {weeklyMemoPreview.line ? (
              <p className="mt-2 text-[12px] leading-relaxed text-zinc-800">{weeklyMemoPreview.line}</p>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                やったこと・気づき・来週の予定を残せます（チームと認識を合わせやすくなります）。
              </p>
            )}
            {canEdit && onOpenWeeklyMemo ? (
              <button
                type="button"
                onClick={() => onOpenWeeklyMemo()}
                className="mt-3 min-h-[40px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-zinc-800 transition duration-200 ease-out hover:bg-zinc-50"
              >
                タスク・予定で編集
              </button>
            ) : null}
          </div>
        )}
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <p className="text-[11px] font-semibold text-zinc-500">チームの動き（今週）</p>
          {teamFeedLines.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-zinc-700">
              {teamFeedLines.map((line) => (
                <li key={line.id}>{line.text}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-zinc-500">今週完了したタスクはまだありません。</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-white/90 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-zinc-500">進捗</p>
            <p className="startup-font-mono mt-1 text-sm font-semibold text-[#1A1A1A]">
              {total > 0 ? (
                <>
                  フェーズ {current}/{total}
                </>
              ) : (
                <>フェーズ未作成</>
              )}
              <span className="ml-2 text-zinc-400">·</span>
              <span className="ml-2">{pct}%</span>
            </p>
          </div>
        </div>
        <div className="mt-3">
          <SegmentedBar percent={pct} />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onOpenRoadmap}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition duration-200 ease-out hover:bg-zinc-50"
        >
          ロードマップを見る
        </button>
        <button
          type="button"
          onClick={() => void onShareTeam()}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl border border-orange-200 bg-[#FFF3D6]/80 px-4 text-sm font-semibold text-[#1A1A1A] transition duration-200 ease-out hover:bg-[#FFF3D6]"
        >
          チームに共有
        </button>
      </div>
    </section>
  );
}
