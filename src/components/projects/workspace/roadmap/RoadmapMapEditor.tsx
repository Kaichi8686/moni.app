"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Map, Plus, Sparkles } from "lucide-react";
import { addDays } from "date-fns";
import { AiChatCopyButton } from "@/components/ai/AiChatCopyButton";
import { AiChatRichText } from "@/components/ai/AiChatRichText";
import { ProjectGoalBanner } from "@/components/projects/workspace/ProjectGoalBanner";
import { ProjectGoalDetailSheet } from "@/components/projects/workspace/ProjectGoalDetailSheet";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { RoadmapPhaseEditSheet } from "@/components/projects/workspace/roadmap/RoadmapPhaseEditSheet";
import { RoadmapStepCreateSheet } from "@/components/projects/workspace/roadmap/RoadmapStepCreateSheet";
import { RoadmapStepList } from "@/components/projects/workspace/roadmap/RoadmapStepList";
import { resolveRoadmapMarkId } from "@/components/projects/workspace/roadmap/roadmapPathMarks";
import { persistProjectMotivationAndGoal } from "@/lib/projects/persistProjectBrief";
import { resolveProjectBrief } from "@/lib/projects/projectBrief";
import { buildStepListItems } from "@/lib/roadmap/buildStepListItems";
import { splitRoadmapPathLayout } from "@/lib/roadmap/pathLayout";
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
  const {
    projectId,
    project,
    coachingContext,
    canEdit: workspaceCanEdit,
    reload: workspaceReload,
    issues,
    uid,
  } = useProjectWorkspace();
  const roadmap = useRoadmapProject(projectId);
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<DraftMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [proposed, setProposed] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [goalDetailOpen, setGoalDetailOpen] = useState(false);

  const projectBrief = useMemo(
    () =>
      resolveProjectBrief({
        coachingContext,
        description: project?.description,
      }),
    [coachingContext, project?.description],
  );
  const projectGoal = projectBrief.projectGoal.trim();
  const problemMotivation = projectBrief.problemMotivation.trim();

  /** 地図編集と概要タブのフェーズ一覧を同じ DB 状態に揃える */
  async function syncReload() {
    await Promise.all([roadmap.reload(), workspaceReload()]);
  }

  const steps = useMemo(
    () => [...roadmap.phases].sort((a, b) => a.order - b.order),
    [roadmap.phases],
  );

  const { main: mainSteps } = useMemo(() => splitRoadmapPathLayout(steps), [steps]);

  const { items: stepListItems, currentMainIndex } = useMemo(
    () =>
      buildStepListItems(steps, {
        issues,
        assigneeUserId: uid,
        nextMoveLabel: tx("次の一手", "Next move"),
        dueLabelPrefix: tx("期限", "Due"),
      }),
    [issues, steps, tx, uid],
  );

  const selectedStep = useMemo(
    () => (selectedId ? steps.find((step) => step.id === selectedId) ?? null : null),
    [selectedId, steps],
  );
  /** reload の一瞬 steps が空でもシートを閉じない */
  const selectedStepRef = useRef(selectedStep);
  if (selectedStep) selectedStepRef.current = selectedStep;
  const sheetStep =
    selectedStep ??
    (selectedId && selectedStepRef.current?.id === selectedId ? selectedStepRef.current : null);

  const overviewHref = `/projects/${projectId}/overview`;

  useEffect(() => {
    setSelectedId(null);
    setExpandedId(null);
  }, [projectId]);

  const phaseIdFromUrl = searchParams.get("phase");
  useEffect(() => {
    if (!phaseIdFromUrl || steps.length === 0) return;
    if (steps.some((step) => step.id === phaseIdFromUrl)) {
      setExpandedId(phaseIdFromUrl);
      if (roadmap.canEdit) setSelectedId(phaseIdFromUrl);
    }
  }, [phaseIdFromUrl, steps, roadmap.canEdit]);

  const addFromUrl = searchParams.get("add") === "1";
  const roadmapHref = `/projects/${projectId}/roadmap`;

  useEffect(() => {
    if (!roadmap.canEdit || roadmap.loading) return;
    // ?add=1 は作成シートを直接開く（横/下の選択はしない）
    if (addFromUrl) {
      setCreateSheetOpen(true);
      router.replace(roadmapHref, { scroll: false });
    }
  }, [addFromUrl, roadmap.canEdit, roadmap.loading, roadmapHref, router]);

  function openCreateStep() {
    if (!roadmap.canEdit || busy) return;
    setSelectedId(null);
    setMode("manual");
    setCreateSheetOpen(true);
  }

  async function createStepBelow(values: {
    title: string;
    goal: string;
    description: string;
    icon: string;
  }) {
    if (!roadmap.canEdit) return;
    setBusy(true);
    setError("");
    try {
      const start = new Date();
      await roadmap.createPhase({
        title: values.title,
        goal: values.goal,
        description: values.description,
        icon: values.icon,
        startDate: start.toISOString(),
        endDate: addDays(start, 14).toISOString(),
        status: mainSteps.length === 0 ? "in_progress" : "planned",
      });
      await workspaceReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("ステップを追加できませんでした", "Couldn’t add the step"));
      throw e;
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
      throw e;
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

  const hasSteps = steps.length > 0;
  const showCreateFab = roadmap.canEdit && !selectedId && !createSheetOpen && mode === "manual";

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-5 px-1 pb-28 pt-1">
      <button
        type="button"
        onClick={() => router.push(overviewHref)}
        className="fixed left-[max(1rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-800 shadow-sm backdrop-blur-sm transition hover:bg-zinc-50"
        aria-label={tx("戻る", "Back")}
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </button>
      <div className="flex items-start gap-3 pl-[3.25rem]">
        <div className="min-w-0 pt-0.5">
          <div className="flex items-center gap-2">
            <Map className="h-6 w-6 shrink-0 text-orange-500" aria-hidden />
            <h1 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">
              {hasSteps
                ? tx("ロードマップを編集", "Edit roadmap")
                : tx("この挑戦の計画を、今から描こう", "Start building this plan")}
            </h1>
          </div>
          <p className="mt-1 text-[13px] text-zinc-500">
            {hasSteps
              ? tx(
                  "ステップをタップして詳細を開き、編集できます。",
                  "Tap a step to expand details and edit.",
                )
              : tx("右下のステップ作成から最初の一歩を追加しよう。", "Add the first step from Create step.")}
          </p>
        </div>
      </div>

      {project && projectGoal ? (
        <ProjectGoalBanner
          projectName={project.name}
          goal={projectGoal}
          onClick={() => setGoalDetailOpen(true)}
        />
      ) : null}

      {roadmap.canEdit ? (
        <button
          type="button"
          onClick={() => setMode((current) => (current === "ai" ? "manual" : "ai"))}
          className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold shadow-sm transition ${
            mode === "ai"
              ? "border-violet-600 bg-violet-600 text-white"
              : "border-violet-200 bg-violet-50 text-violet-800"
          }`}
        >
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
              mode === "ai" ? "bg-white/20" : "bg-violet-600 text-white"
            }`}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          {mode === "ai" ? tx("AIを閉じる", "Close AI") : tx("AIで作る", "AI draft")}
        </button>
      ) : null}

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

      <RoadmapStepList
        steps={stepListItems}
        currentIndex={currentMainIndex}
        expandedId={expandedId}
        showTasks={false}
        onToggle={(id) => {
          setExpandedId((current) => (current === id ? null : id));
        }}
        renderExpandedActions={(step) =>
          roadmap.canEdit ? (
            <button
              type="button"
              onClick={() => setSelectedId(step.id)}
              className="min-h-[44px] w-full rounded-full border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              {tx("このステップを編集", "Edit this step")}
            </button>
          ) : null
        }
        empty={
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-zinc-800">
              {tx("まだステップがありません", "No steps yet")}
            </p>
            <p className="mt-1 text-[13px] text-zinc-500">
              {tx("右下から最初のステップを追加できます。", "Add the first step from the button below.")}
            </p>
          </div>
        }
      />

      {error || roadmap.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error || roadmap.error}</p>
      ) : null}

      <button
        type="button"
        disabled={steps.length === 0 || busy}
        onClick={() => router.push(overviewHref)}
        className="min-h-[52px] w-full rounded-full bg-orange-500 text-base font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {tx("この計画で進める", "Continue with this plan")}
      </button>

      {showCreateFab ? (
        <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 md:right-[max(1.5rem,calc((100vw-48rem)/2+1rem))]">
          <button
            type="button"
            onClick={openCreateStep}
            disabled={busy}
            aria-label={tx("ステップを作成", "Create step")}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9600] px-4 py-3 text-[15px] font-semibold tracking-tight text-white shadow-[0_1px_3px_rgba(0,0,0,0.14),0_4px_14px_rgba(255,150,0,0.28)] transition hover:bg-[#F08C00] active:scale-[0.97] disabled:opacity-40"
          >
            <Plus className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2.25} />
            {tx("ステップ作成", "Create step")}
          </button>
        </div>
      ) : null}

      <RoadmapPhaseEditSheet
        open={Boolean(selectedId) && Boolean(sheetStep) && roadmap.canEdit}
        phase={
          sheetStep
            ? {
                id: sheetStep.id,
                title: sheetStep.title,
                goal: sheetStep.goal,
                description: sheetStep.description,
                icon: sheetStep.icon,
                stepNumber: (() => {
                  const mainAt = mainSteps.findIndex((item) => item.id === sheetStep.id);
                  if (mainAt >= 0) return mainAt + 1;
                  return steps.findIndex((item) => item.id === sheetStep.id) + 1;
                })(),
              }
            : null
        }
        busy={busy}
        onClose={() => setSelectedId(null)}
        onSave={async (patch) => {
          const targetId = sheetStep?.id ?? selectedId;
          if (!targetId) {
            throw new Error(tx("保存できませんでした", "Couldn’t save"));
          }
          setError("");
          try {
            await roadmap.updatePhase(targetId, {
              title: patch.title,
              goal: patch.goal,
              description: patch.description,
              icon: patch.icon,
            });
            await workspaceReload();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : tx("保存できませんでした", "Couldn’t save"),
            );
            throw e;
          }
        }}
        onDelete={
          sheetStep
            ? async () => {
                await removeStep(sheetStep.id);
              }
            : undefined
        }
      />

      <RoadmapStepCreateSheet
        open={createSheetOpen && roadmap.canEdit}
        busy={busy}
        initialIcon={resolveRoadmapMarkId(undefined, mainSteps.length)}
        onClose={() => setCreateSheetOpen(false)}
        onSubmit={createStepBelow}
      />

      {project && projectGoal ? (
        <ProjectGoalDetailSheet
          open={goalDetailOpen}
          onClose={() => setGoalDetailOpen(false)}
          projectName={project.name}
          goal={projectGoal}
          problemMotivation={problemMotivation}
          canEdit={workspaceCanEdit}
          onSave={
            workspaceCanEdit
              ? async ({ goal, problemMotivation: motivation }) => {
                  try {
                    await persistProjectMotivationAndGoal({
                      projectId,
                      coachingContext,
                      description: project.description,
                      problemMotivation: motivation,
                      projectGoal: goal,
                    });
                  } catch (e) {
                    if (e instanceof Error && e.message === "BRIEF_INCOMPLETE") {
                      throw new Error(
                        tx(
                          "きっかけとゴールの両方を入力してください。",
                          "Please fill in both the motivation and the goal.",
                        ),
                      );
                    }
                    throw e;
                  }
                  await workspaceReload();
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
