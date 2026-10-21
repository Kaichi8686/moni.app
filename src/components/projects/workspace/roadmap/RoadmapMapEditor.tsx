"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Map, Sparkles } from "lucide-react";
import { addDays } from "date-fns";
import { AiChatCopyButton } from "@/components/ai/AiChatCopyButton";
import { AiChatRichText } from "@/components/ai/AiChatRichText";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { RoadmapPath, RoadmapPathItem } from "@/components/projects/workspace/roadmap/RoadmapPath";
import { RoadmapPathNode } from "@/components/projects/workspace/roadmap/RoadmapPathNode";
import { RoadmapPhaseDetailExpand } from "@/components/projects/workspace/roadmap/RoadmapPhaseDetailExpand";
import {
  RoadmapMarkPicker,
  RoadmapStepMark,
  resolveRoadmapMarkId,
  type RoadmapMarkId,
} from "@/components/projects/workspace/roadmap/roadmapPathMarks";
import { useRoadmapProject } from "@/lib/roadmap/useRoadmapProject";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/I18nProvider";

type DraftMessage = { id: string; role: "user" | "assistant"; content: string };

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
  const searchParams = useSearchParams();
  const { projectId, reload: workspaceReload } = useProjectWorkspace();
  const roadmap = useRoadmapProject(projectId);
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftGoal, setDraftGoal] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftIcon, setDraftIcon] = useState<RoadmapMarkId>("star");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<DraftMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [proposed, setProposed] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** 地図編集と概要タブのフェーズ一覧を同じ DB 状態に揃える */
  async function syncReload() {
    await Promise.all([roadmap.reload(), workspaceReload()]);
  }

  const steps = useMemo(
    () => [...roadmap.phases].sort((a, b) => a.order - b.order),
    [roadmap.phases],
  );

  useEffect(() => {
    setSelectedId(null);
  }, [projectId]);

  const phaseIdFromUrl = searchParams.get("phase");
  useEffect(() => {
    if (!phaseIdFromUrl || steps.length === 0) return;
    if (steps.some((step) => step.id === phaseIdFromUrl)) setSelectedId(phaseIdFromUrl);
  }, [phaseIdFromUrl, steps]);

  function resetDraft() {
    setDraftTitle("");
    setDraftGoal("");
    setDraftDescription("");
    setDraftIcon(resolveRoadmapMarkId(undefined, steps.length));
    setAdding(false);
  }

  async function addStep() {
    const name = draftTitle.trim();
    if (!name || !roadmap.canEdit) return;
    setBusy(true);
    setError("");
    try {
      const start = new Date();
      const end = addDays(start, 14);
      await roadmap.createPhase({
        title: name,
        goal: draftGoal.trim() || undefined,
        description: draftDescription.trim() || undefined,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        status: "planned",
        icon: draftIcon,
      });
      await workspaceReload();
      resetDraft();
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
      await workspaceReload();
      setSelectedId((current) => (current === phaseId ? null : current));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("削除できませんでした", "Couldn’t delete"));
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
        color: "amber",
        icon: resolveRoadmapMarkId(undefined, maxOrder + 1 + index),
        order: maxOrder + 1 + index,
      }));
      let { error: insertError } = await supabase.from("project_phases").insert(rows);
      if (insertError && /icon/i.test(insertError.message)) {
        ({ error: insertError } = await supabase.from("project_phases").insert(
          rows.map((row) => {
            const { icon, ...rest } = row;
            void icon;
            return rest;
          }),
        ));
      }
      if (insertError) throw new Error(insertError.message);
      await syncReload();
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
                  <div key={message.id} className="rounded-xl bg-orange-100/80 px-3 py-2 text-sm leading-relaxed text-zinc-800">
                    <AiChatRichText text={message.content} />
                    <div className="mt-1.5">
                      <AiChatCopyButton text={message.content} className="text-zinc-600" />
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="rounded-xl bg-white px-3 py-2 text-sm leading-relaxed text-zinc-800">
                    <p className="select-text whitespace-pre-wrap">{message.content}</p>
                    <div className="mt-1.5">
                      <AiChatCopyButton text={message.content} className="text-zinc-600" />
                    </div>
                  </div>
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

      <RoadmapPath
        segmentCleared={steps.map((step, orderIndex) => {
          const currentIndex = steps.findIndex((item) => item.status !== "completed");
          const cursor = currentIndex >= 0 ? currentIndex : 0;
          return step.status === "completed" || orderIndex < cursor;
        })}
      >
        {steps.map((step, orderIndex) => {
          const stepNumber = orderIndex + 1;
          const isDone = step.status === "completed";
          const expanded = selectedId === step.id;
          const currentIndex = steps.findIndex((item) => item.status !== "completed");
          const cursor = currentIndex >= 0 ? currentIndex : 0;
          const isCurrent =
            step.status === "in_progress" || (!isDone && orderIndex === cursor);
          const upcoming = !isDone && !isCurrent && orderIndex > cursor;
          const tone = isDone ? "done" : upcoming ? "upcoming" : "active";
          return (
            <RoadmapPathItem
              key={step.id}
              index={orderIndex}
              below={
                expanded ? (
                  <>
                    <RoadmapPhaseDetailExpand
                      open={expanded}
                      title={step.title}
                      goal={step.goal}
                      description={step.description}
                      icon={step.icon}
                      stepNumber={stepNumber}
                      canEdit={roadmap.canEdit}
                      onSave={
                        roadmap.canEdit
                          ? async (patch) => {
                              await roadmap.updatePhase(step.id, {
                                title: patch.title,
                                goal: patch.goal,
                                description: patch.description,
                                icon: patch.icon,
                              });
                              await workspaceReload();
                            }
                          : undefined
                      }
                    />
                    {roadmap.canEdit ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeStep(step.id)}
                        className="mt-2 min-h-[40px] w-full rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                      >
                        {tx("このステップを削除", "Delete this step")}
                      </button>
                    ) : null}
                  </>
                ) : null
              }
            >
              <RoadmapPathNode
                tone={tone}
                sparkle={isCurrent}
                selected={expanded}
                onClick={() => setSelectedId((current) => (current === step.id ? null : step.id))}
                aria-label={tx(`ステップ ${stepNumber}: ${step.title}`, `Step ${stepNumber}: ${step.title}`)}
              >
                <RoadmapStepMark markId={step.icon} index={orderIndex} tone={tone} />
              </RoadmapPathNode>
            </RoadmapPathItem>
          );
        })}

        {roadmap.canEdit && !adding ? (
          <RoadmapPathItem index={steps.length}>
            <RoadmapPathNode
              tone="create"
              disabled={busy}
              onClick={() => {
                setDraftIcon(resolveRoadmapMarkId(undefined, steps.length));
                setAdding(true);
              }}
              aria-label={
                steps.length === 0
                  ? tx("ロードマップを作成する", "Create roadmap")
                  : tx("次のステップを追加", "Add the next step")
              }
            >
              <RoadmapStepMark index={steps.length} tone="create" />
            </RoadmapPathNode>
          </RoadmapPathItem>
        ) : null}
      </RoadmapPath>

      {roadmap.canEdit && adding ? (
        <form
          className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void addStep();
          }}
        >
          <div>
            <label htmlFor="roadmap-draft-title" className="block text-xs font-semibold text-zinc-600">
              {tx("ステップ名", "Step name")}
            </label>
            <input
              id="roadmap-draft-title"
              autoFocus
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder={tx("例：ヒアリング", "e.g. Interviews")}
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-orange-400"
            />
          </div>
          <RoadmapMarkPicker
            value={draftIcon}
            onChange={setDraftIcon}
            disabled={busy}
            label={tx("マスの絵", "Step icon")}
          />
          <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-3">
            <label htmlFor="roadmap-draft-goal" className="block text-xs font-bold text-orange-900">
              {tx("このステップのゴール", "Goal for this step")}
            </label>
            <p className="mt-0.5 text-[11px] leading-snug text-orange-800/80">
              {tx("達成したら「できた」と言えること", "What “done” looks like")}
            </p>
            <textarea
              id="roadmap-draft-goal"
              value={draftGoal}
              onChange={(event) => setDraftGoal(event.target.value)}
              placeholder={tx("例：10人に話を聞く", "e.g. Talk to 10 people")}
              rows={2}
              className="mt-2 w-full resize-none rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400"
            />
          </div>
          <div>
            <label htmlFor="roadmap-draft-overview" className="block text-xs font-semibold text-zinc-600">
              {tx("概要", "Overview")}
            </label>
            <textarea
              id="roadmap-draft-overview"
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              placeholder={tx("このステップでやること", "What you’ll do in this step")}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetDraft}
              className="min-h-[44px] rounded-2xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {tx("キャンセル", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={busy || !draftTitle.trim()}
              className="min-h-[44px] flex-1 rounded-2xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
            >
              {tx("追加", "Add")}
            </button>
          </div>
        </form>
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
