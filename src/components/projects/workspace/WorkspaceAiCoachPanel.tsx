"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { UserSituationPicker } from "@/components/projects/UserSituationPicker";
import {
  parseCoachingContext,
  resolveUserSituation,
  type CoachingContext,
} from "@/lib/projects/coachingContext";
import type { UserSituation } from "@/lib/projects/userSituation";
import { userSituationShortLabel } from "@/lib/projects/userSituation";
import type { Issue, Priority } from "@/lib/workspace/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type AiTodoItem = {
  title: string;
  minutes: number;
  estimatedMinutes?: number;
  difficulty?: "すぐできる" | "ちょっと勇気がいる" | "誰かと一緒にやろう";
  fallback?: string;
  priorityLabel?: "今日やるべき" | "今週中にやる" | "余裕があれば";
};

type AiTaskSuggestion = AiTodoItem & {
  description?: string;
  priority?: "low" | "medium" | "high";
};

type Props = {
  projectName: string;
  projectDescription?: string;
  coachingContext: unknown;
  phases: Array<{ id: string; title: string; description?: string; status: string }>;
  issues: Issue[];
  canEdit: boolean;
  onSaveCoaching: (patch: Partial<CoachingContext>) => Promise<void>;
  onCreateIssues: (
    items: Array<{
      title: string;
      description?: string;
      priority: Priority;
      phaseId?: string | null;
      fallback?: string;
    }>,
  ) => Promise<void>;
  variant?: "overview" | "issues" | "page";
};

function mapPriorityLabel(label?: AiTodoItem["priorityLabel"]): Priority {
  if (label === "今日やるべき") return "high";
  if (label === "今週中にやる") return "medium";
  return "low";
}

function activePhaseId(phases: Props["phases"]): string | null {
  const active = phases.find((p) => p.status === "in_progress") ?? phases[0];
  return active?.id ?? null;
}

export function WorkspaceAiCoachPanel({
  projectName,
  projectDescription,
  coachingContext,
  phases,
  issues,
  canEdit,
  onSaveCoaching,
  onCreateIssues,
  variant = "overview",
}: Props) {
  const { tx } = useI18n();
  const coaching = useMemo(() => parseCoachingContext(coachingContext), [coachingContext]);
  const resolvedSituation = resolveUserSituation(coaching);
  const [situation, setSituation] = useState<UserSituation | null>(resolvedSituation ?? null);
  const [savingSituation, setSavingSituation] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [todayItems, setTodayItems] = useState<AiTodoItem[] | null>(null);
  const [taskSuggestions, setTaskSuggestions] = useState<AiTaskSuggestion[] | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setSituation(resolvedSituation ?? null);
  }, [resolvedSituation]);

  const saveSituation = useCallback(
    async (next: UserSituation) => {
      setSituation(next);
      if (!canEdit) return;
      setSavingSituation(true);
      try {
        await onSaveCoaching({ userSituation: next });
      } finally {
        setSavingSituation(false);
      }
    },
    [canEdit, onSaveCoaching],
  );

  const fetchTodayTodos = useCallback(async () => {
    if (!situation) {
      setAiNote(tx("先に「今の状況」を選んでください。", "Choose “where you are now” first."));
      return;
    }
    setAiLoading(true);
    setAiNote(null);
    try {
      const focus = phases.find((p) => p.status === "in_progress") ?? phases[0];
      const openTitles = issues
        .filter((i) => i.status !== "done" && i.status !== "cancelled")
        .slice(0, 18)
        .map((i) => i.title);
      const doneTitles = issues
        .filter((i) => i.status === "done")
        .slice(0, 12)
        .map((i) => i.title);
      const res = await fetch("/api/projects/coach/today-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          projectDescription: projectDescription ?? "",
          dreamStatement: coaching.dreamStatement ?? "",
          focusPhaseTitle: focus?.title ?? null,
          focusPhaseStatus: focus?.status ?? null,
          completedTaskTitles: doneTitles,
          openTaskTitles: openTitles,
          userSituation: situation,
        }),
      });
      const data = (await res.json()) as {
        items?: AiTodoItem[];
        offline?: boolean;
        fallback?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? tx("提案の取得に失敗しました", "Failed to get suggestions"));
      const cleaned = (data.items ?? []).filter((x) => x.title?.trim()).slice(0, 3);
      setTodayItems(cleaned.length ? cleaned : null);
      if (data.offline) setAiNote(tx("APIキー未設定のためサンプル提案です。", "Sample suggestions (API key not set)."));
      else if (data.fallback) setAiNote(tx("AIの整形に失敗したためサンプルに置き換えました。", "AI formatting failed, so sample suggestions are shown."));
    } catch (e) {
      setAiNote(e instanceof Error ? e.message : tx("エラーが発生しました", "Something went wrong"));
      setTodayItems(null);
    } finally {
      setAiLoading(false);
    }
  }, [situation, phases, issues, projectName, projectDescription, coaching.dreamStatement, tx]);

  const fetchTaskSuggestions = useCallback(async () => {
    if (!situation) {
      setAiNote(tx("先に「今の状況」を選んでください。", "Choose “where you are now” first."));
      return;
    }
    setAiLoading(true);
    setAiNote(null);
    try {
      const res = await fetch("/api/projects/ai-task-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          projectDescription: projectDescription ?? "",
          userSituation: situation,
          userInput: coaching.dreamStatement ?? projectDescription ?? "",
        }),
      });
      const data = (await res.json()) as { suggestions?: AiTaskSuggestion[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? tx("提案の取得に失敗しました", "Failed to get suggestions"));
      setTaskSuggestions((data.suggestions ?? []).slice(0, 5));
    } catch (e) {
      setAiNote(e instanceof Error ? e.message : tx("エラーが発生しました", "Something went wrong"));
      setTaskSuggestions(null);
    } finally {
      setAiLoading(false);
    }
  }, [situation, projectName, projectDescription, coaching.dreamStatement, tx]);

  const addTodayAsIssues = async () => {
    if (!todayItems?.length) return;
    setAdding(true);
    try {
      await onCreateIssues(
        todayItems.map((item) => ({
          title: item.title,
          description: item.fallback ? `${tx("困ったとき", "If you get stuck")}: ${item.fallback}` : undefined,
          priority: mapPriorityLabel(item.priorityLabel),
          phaseId: activePhaseId(phases),
          fallback: item.fallback,
        })),
      );
      setAiNote(tx("課題に追加しました。", "Added to issues."));
    } catch (e) {
      setAiNote(e instanceof Error ? e.message : tx("追加に失敗しました", "Failed to add"));
    } finally {
      setAdding(false);
    }
  };

  const addSuggestionsAsIssues = async () => {
    if (!taskSuggestions?.length) return;
    setAdding(true);
    try {
      await onCreateIssues(
        taskSuggestions.map((s) => ({
          title: s.title,
          description: s.fallback ? `${tx("困ったとき", "If you get stuck")}: ${s.fallback}\n${s.description ?? ""}`.trim() : s.description,
          priority:
            s.priority === "high" ? "high" : s.priority === "low" ? "low" : mapPriorityLabel(s.priorityLabel),
          phaseId: activePhaseId(phases),
          fallback: s.fallback,
        })),
      );
      setAiNote(tx("課題に追加しました。", "Added to issues."));
    } catch (e) {
      setAiNote(e instanceof Error ? e.message : tx("追加に失敗しました", "Failed to add"));
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="rounded-md border border-orange-200 bg-gradient-to-br from-[#FFF8F0] to-white p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-orange-600" aria-hidden />
        <h2 className="text-sm font-semibold text-[#1A1A1A]">{tx("AIコーチ（今日動ける提案）", "AI coach (steps you can take today)")}</h2>
        {resolvedSituation ? (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-900">
            {tx(userSituationShortLabel(resolvedSituation) ?? "", {
              festival: "School event",
              study: "Class / inquiry",
              startup: "Startup / build",
              community: "Community",
              unclear: "Still figuring it out",
            }[resolvedSituation] ?? "")}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">
        {tx("難しい言葉は使わず、15分〜1時間でできる具体的な一歩だけを提案します。", "Plain language only — concrete steps you can do in 15–60 minutes.")}
      </p>

      <div className="mt-3">
        <UserSituationPicker
          value={situation}
          onChange={(v) => void saveSituation(v)}
          disabled={!canEdit || savingSituation}
          compact={Boolean(resolvedSituation)}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {variant === "issues" ? (
          <button
            type="button"
            disabled={!canEdit || aiLoading || !situation}
            onClick={() => void fetchTaskSuggestions()}
            className="min-h-[40px] rounded-lg bg-[#FF5C35] px-3 text-xs font-bold text-white disabled:opacity-50"
          >
            {aiLoading ? tx("考え中…", "Thinking…") : tx("課題をAI提案", "Suggest issues with AI")}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canEdit || aiLoading || !situation}
            onClick={() => void fetchTodayTodos()}
            className="min-h-[40px] rounded-lg bg-[#FF5C35] px-3 text-xs font-bold text-white disabled:opacity-50"
          >
            {aiLoading ? tx("考え中…", "Thinking…") : tx("今日やることを提案", "Suggest what to do today")}
          </button>
        )}
        {variant === "page" ? (
          <button
            type="button"
            disabled={!canEdit || aiLoading || !situation}
            onClick={() => void fetchTaskSuggestions()}
            className="min-h-[40px] rounded-lg border border-orange-300 bg-white px-3 text-xs font-bold text-orange-950 disabled:opacity-50"
          >
            {aiLoading ? tx("考え中…", "Thinking…") : tx("課題をAI提案", "Suggest issues with AI")}
          </button>
        ) : null}
      </div>

      {aiNote ? <p className="mt-2 text-[11px] text-amber-800">{aiNote}</p> : null}

      {todayItems && todayItems.length > 0 ? (
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#1A1A1A]">
          {todayItems.map((item, i) => (
            <li key={`${item.title}-${i}`} className="leading-snug">
              <span className="font-medium">{item.title}</span>
              <span className="ml-1 text-xs text-[#6B7280]">
                （{item.estimatedMinutes ?? item.minutes}
                {tx("分", " min")}
                {item.difficulty
                  ? ` · ${
                      item.difficulty === "すぐできる"
                        ? tx("すぐできる", "Easy")
                        : item.difficulty === "ちょっと勇気がいる"
                          ? tx("ちょっと勇気がいる", "Needs a bit of courage")
                          : tx("誰かと一緒にやろう", "Do it with someone")
                    }`
                  : ""}
                ）
              </span>
              {item.fallback ? (
                <p className="mt-0.5 text-[11px] text-[#6B7280]">
                  {tx("困ったとき", "If you get stuck")}: {item.fallback}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {taskSuggestions && taskSuggestions.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {taskSuggestions.map((s, i) => (
            <li key={`${s.title}-${i}`} className="rounded-lg border border-sky-200 bg-sky-50/80 p-2.5 text-sm">
              <p className="font-semibold text-[#1A1A1A]">{s.title}</p>
              {s.description ? <p className="mt-0.5 text-[12px] text-[#6B7280]">{s.description}</p> : null}
              <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-[#6B7280]">
                {s.estimatedMinutes ? <span>{tx(`約${s.estimatedMinutes}分`, `~${s.estimatedMinutes} min`)}</span> : null}
                {s.difficulty ? (
                  <span>
                    ·{" "}
                    {s.difficulty === "すぐできる"
                      ? tx("すぐできる", "Easy")
                      : s.difficulty === "ちょっと勇気がいる"
                        ? tx("ちょっと勇気がいる", "Needs a bit of courage")
                        : tx("誰かと一緒にやろう", "Do it with someone")}
                  </span>
                ) : null}
                {s.priorityLabel ? (
                  <span>
                    ·{" "}
                    {s.priorityLabel === "今日やるべき"
                      ? tx("今日やるべき", "Do today")
                      : s.priorityLabel === "今週中にやる"
                        ? tx("今週中にやる", "This week")
                        : tx("余裕があれば", "If you have time")}
                  </span>
                ) : null}
              </div>
              {s.fallback ? (
                <p className="mt-1 text-[11px] text-[#6B7280]">
                  {tx("困ったとき", "If you get stuck")}: {s.fallback}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {canEdit && todayItems && todayItems.length > 0 ? (
        <button
          type="button"
          disabled={adding}
          onClick={() => void addTodayAsIssues()}
          className="mt-3 min-h-[40px] w-full rounded-lg border border-orange-300 bg-white text-xs font-bold text-orange-950 disabled:opacity-50"
        >
          {adding ? tx("追加中…", "Adding…") : tx("提案を課題に追加", "Add suggestions as issues")}
        </button>
      ) : null}

      {canEdit && taskSuggestions && taskSuggestions.length > 0 ? (
        <button
          type="button"
          disabled={adding}
          onClick={() => void addSuggestionsAsIssues()}
          className="mt-3 min-h-[40px] w-full rounded-lg border border-orange-300 bg-white text-xs font-bold text-orange-950 disabled:opacity-50"
        >
          {adding ? tx("追加中…", "Adding…") : tx("提案を課題に追加", "Add suggestions as issues")}
        </button>
      ) : null}
    </section>
  );
}
