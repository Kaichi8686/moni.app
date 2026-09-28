"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Map, Plus, Sparkles, Trash2 } from "lucide-react";
import { addDays } from "date-fns";
import { AiChatRichText } from "@/components/ai/AiChatRichText";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { useRoadmapProject } from "@/lib/roadmap/useRoadmapProject";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/I18nProvider";

type DraftMessage = { id: string; role: "user" | "assistant"; content: string };

/** 一覧は未完了から最大この件数まで常時表示し、残りは「もっと見る」 */
const ROADMAP_VISIBLE_LIMIT = 6;

function parseProposedSteps(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*・]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length >= 2 && line.length <= 40)
    .slice(0, 8);
}

export function RoadmapMapEditor() {
  const { tx } = useI18n();
  const router = useRouter();
  const { projectId } = useProjectWorkspace();
  const roadmap = useRoadmapProject(projectId);
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [draftTitle, setDraftTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<DraftMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [proposed, setProposed] = useState<string[]>([]);
  const [listExpanded, setListExpanded] = useState(false);

  const steps = useMemo(
    () => [...roadmap.phases].sort((a, b) => a.order - b.order),
    [roadmap.phases],
  );

  /** 未完了を先頭に、完了済みはその後ろ（いずれも order 順） */
  const displaySteps = useMemo(() => {
    const active = steps.filter((step) => step.status !== "completed");
    const done = steps.filter((step) => step.status === "completed");
    return [...active, ...done];
  }, [steps]);

  const visibleSteps = useMemo(
    () => (listExpanded ? displaySteps : displaySteps.slice(0, ROADMAP_VISIBLE_LIMIT)),
    [displaySteps, listExpanded],
  );
  const hiddenCount = Math.max(0, displaySteps.length - visibleSteps.length);

  useEffect(() => {
    setListExpanded(false);
  }, [projectId]);

  async function addStep(title: string) {
    const name = title.trim();
    if (!name || !roadmap.canEdit) return;
    setBusy(true);
    setError("");
    try {
      const start = new Date();
      const end = addDays(start, 14);
      await roadmap.createPhase({
        title: name,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        status: "planned",
      });
      setDraftTitle("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("ステップを追加できませんでした", "Couldn’t add the step"));
    } finally {
      setBusy(false);
    }
  }

  async function removeStep(phaseId: string) {
    if (!roadmap.canEdit) return;
    setBusy(true);
    setError("");
    try {
      await roadmap.deletePhase(phaseId);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("削除できませんでした", "Couldn’t delete"));
    } finally {
      setBusy(false);
    }
  }

  async function reorder(fromId: string, toId: string) {
    if (!supabase || !roadmap.canEdit || fromId === toId) return;
    const client = supabase;
    const ids = steps.map((step) => step.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setBusy(true);
    setError("");
    try {
      const results = await Promise.all(
        next.map((id, index) =>
          client.from("project_phases").update({ order: index, updated_at: new Date().toISOString() }).eq("id", id),
        ),
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw new Error(failed.error.message);
      await roadmap.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("並び替えに失敗しました", "Couldn’t reorder"));
    } finally {
      setBusy(false);
    }
  }

  async function askAi(event?: FormEvent) {
    event?.preventDefault();
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    const history = [...aiMessages, { id: `u-${Date.now()}`, role: "user" as const, content: text }];
    setAiMessages(history);
    setAiInput("");
    setAiLoading(true);
    setError("");
    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...history.map(({ role, content }) => ({ role, content })),
            {
              role: "user",
              content:
                "上の相談をもとに、この挑戦のロードマップ案を出してください。説明は短く、最後にステップ案だけを「・」で始まる行で3〜6個書いてください。1行は20文字以内のステップ名にしてください。",
            },
          ],
        }),
      });
      const result = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !result.reply) throw new Error(result.error || tx("AIの提案を取得できませんでした", "Couldn’t get an AI suggestion"));
      setAiMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: result.reply! }]);
      setProposed(parseProposedSteps(result.reply));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("AIの提案を取得できませんでした", "Couldn’t get an AI suggestion"));
    } finally {
      setAiLoading(false);
    }
  }

  async function adoptProposed() {
    const titles = proposed.map((title) => title.trim()).filter(Boolean);
    if (!supabase || titles.length === 0 || !roadmap.canEdit) return;
    setBusy(true);
    setError("");
    try {
      const maxOrder = steps.reduce((max, step) => Math.max(max, step.order), -1);
      const start = new Date();
      const rows = titles.map((title, index) => ({
        project_id: projectId,
        title,
        goal: "",
        start_date: start.toISOString(),
        end_date: addDays(start, 14).toISOString(),
        status: "planned",
        color: "purple",
        order: maxOrder + 1 + index,
      }));
      const { error: insertError } = await supabase.from("project_phases").insert(rows);
      if (insertError) throw new Error(insertError.message);
      await roadmap.reload();
      setProposed([]);
      setMode("manual");
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("ステップを追加できませんでした", "Couldn’t add the step"));
    } finally {
      setBusy(false);
    }
  }

  if (roadmap.loading) {
    return <p className="p-6 text-sm text-zinc-500">{tx("読み込み中...", "Loading…")}</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-1 pb-8">
      <div className="flex items-center gap-2">
        <Map className="h-6 w-6 text-orange-500" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">
          {tx("この挑戦の地図を、今から描こう", "Draw the map for this challenge")}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`min-h-[52px] rounded-2xl border px-3 text-sm font-semibold transition ${
            mode === "manual" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700"
          }`}
        >
          {tx("手動で作る", "Build manually")}
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold shadow-sm transition ${
            mode === "ai"
              ? "border-violet-600 bg-violet-600 text-white"
              : "border-violet-200 bg-violet-50 text-violet-800"
          }`}
        >
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${mode === "ai" ? "bg-white/20" : "bg-violet-600 text-white"}`}>
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          {tx("AI診断", "AI draft")}
        </button>
      </div>

      {mode === "ai" ? (
        <section className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3">
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {aiMessages.length === 0 ? (
              <p className="px-1 py-2 text-sm text-zinc-600">
                {tx("やりたいことを話すと、ステップの叩き台を提案します。", "Describe the challenge and I’ll draft the steps.")}
              </p>
            ) : (
              aiMessages.map((message) =>
                message.role === "assistant" ? (
                  <AiChatRichText
                    key={message.id}
                    text={message.content}
                    className="rounded-xl bg-orange-100/80 px-3 py-2 text-sm leading-relaxed text-zinc-800"
                  />
                ) : (
                  <p
                    key={message.id}
                    className="whitespace-pre-wrap rounded-xl bg-white px-3 py-2 text-sm leading-relaxed text-zinc-800"
                  >
                    {message.content}
                  </p>
                ),
              )
            )}
            {aiLoading ? <p className="text-sm text-zinc-500">{tx("考え中…", "Thinking…")}</p> : null}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={(event) => void askAi(event)}>
            <input
              value={aiInput}
              onChange={(event) => setAiInput(event.target.value)}
              placeholder={tx("例: 文化祭でカフェを出したい", "e.g. I want to run a festival cafe")}
              className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-orange-200 bg-white px-3 text-sm outline-none focus:border-orange-400"
            />
            <button
              type="submit"
              disabled={aiLoading || !aiInput.trim()}
              className="min-h-[44px] rounded-xl bg-zinc-900 px-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {tx("送る", "Send")}
            </button>
          </form>
          {proposed.length > 0 ? (
            <div className="mt-3 space-y-2">
              {proposed.map((title, index) => (
                <input
                  key={`proposal-${index}`}
                  value={title}
                  onChange={(event) =>
                    setProposed((prev) => prev.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                  }
                  className="min-h-[40px] w-full rounded-xl border border-orange-200 bg-white px-3 text-sm"
                />
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => void adoptProposed()}
                className="min-h-[44px] w-full rounded-full bg-orange-500 text-sm font-bold text-white disabled:opacity-40"
              >
                {tx("この案をステップにする", "Use these steps")}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <ul className="space-y-2">
        {visibleSteps.map((step) => {
          const stepNumber = steps.findIndex((item) => item.id === step.id) + 1;
          const isDone = step.status === "completed";
          return (
            <li
              key={step.id}
              draggable={roadmap.canEdit}
              onDragStart={() => setDragId(step.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragId) void reorder(dragId, step.id);
                setDragId(null);
              }}
              className={`flex items-center gap-2 rounded-2xl border px-2 py-2 shadow-sm ${
                isDone ? "border-emerald-100 bg-emerald-50/70" : "border-zinc-200 bg-white"
              }`}
            >
              <button type="button" className="cursor-grab px-1 text-zinc-400 active:cursor-grabbing" aria-label={tx("並び替え", "Reorder")}>
                <GripVertical className="h-4 w-4" />
              </button>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isDone ? "bg-emerald-600 text-white" : "bg-orange-100 text-orange-800"
                }`}
              >
                {isDone ? "✓" : stepNumber}
              </span>
              <p className={`min-w-0 flex-1 truncate text-sm font-semibold ${isDone ? "text-emerald-950" : "text-zinc-900"}`}>
                {step.title}
              </p>
              {roadmap.canEdit ? (
                <button
                  type="button"
                  onClick={() => void removeStep(step.id)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={tx(`${step.title}を削除`, `Delete ${step.title}`)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setListExpanded(true)}
          className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
        >
          {tx(`もっと見る（あと${hiddenCount}件）`, `Show more (${hiddenCount} more)`)}
        </button>
      ) : listExpanded && displaySteps.length > ROADMAP_VISIBLE_LIMIT ? (
        <button
          type="button"
          onClick={() => setListExpanded(false)}
          className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
        >
          {tx(`閉じる（${ROADMAP_VISIBLE_LIMIT}件まで表示）`, `Show fewer (up to ${ROADMAP_VISIBLE_LIMIT})`)}
        </button>
      ) : null}

      {roadmap.canEdit ? (
        adding ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void addStep(draftTitle);
            }}
          >
            <input
              autoFocus
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder={tx("ステップ名", "Step name")}
              className="min-h-[48px] min-w-0 flex-1 rounded-2xl border border-zinc-300 px-3 text-sm outline-none focus:border-orange-400"
            />
            <button type="submit" disabled={busy || !draftTitle.trim()} className="min-h-[48px] rounded-2xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-40">
              {tx("追加", "Add")}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-center transition hover:border-orange-300 hover:bg-orange-50/40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-orange-500 shadow-sm">
              <Plus className="h-5 w-5" />
            </span>
            <span className="mt-2 text-sm font-bold text-zinc-900">{tx("次のステップを追加", "Add the next step")}</span>
            <span className="mt-0.5 text-xs text-zinc-500">{tx("思いついたことをどんどん書こう", "Write down ideas as they come")}</span>
          </button>
        )
      ) : null}

      {error || roadmap.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error || roadmap.error}</p>
      ) : null}

      <button
        type="button"
        disabled={steps.length === 0 || busy}
        onClick={() => router.push(`/projects/${projectId}/overview`)}
        className="min-h-[52px] w-full rounded-full bg-orange-500 text-base font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {tx("この地図を、歩き始める", "Start walking this map")}
      </button>
    </div>
  );
}
