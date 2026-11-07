"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Map, Plus, Sparkles } from "lucide-react";
import { addDays } from "date-fns";
import { AiChatCopyButton } from "@/components/ai/AiChatCopyButton";
import { AiChatRichText } from "@/components/ai/AiChatRichText";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { ProjectGoalBanner } from "@/components/projects/workspace/ProjectGoalBanner";
import { ProjectGoalDetailSheet } from "@/components/projects/workspace/ProjectGoalDetailSheet";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { RoadmapPath, RoadmapPathItem } from "@/components/projects/workspace/roadmap/RoadmapPath";
import { RoadmapPathNode } from "@/components/projects/workspace/roadmap/RoadmapPathNode";
import { RoadmapAddModeChooser } from "@/components/projects/workspace/roadmap/RoadmapAddModeChooser";
import {
  RoadmapCreateSpace,
  type CreateSpaceDraft,
} from "@/components/projects/workspace/roadmap/RoadmapCreateSpace";
import { RoadmapPhaseEditSheet } from "@/components/projects/workspace/roadmap/RoadmapPhaseEditSheet";
import { RoadmapStepCreateSheet } from "@/components/projects/workspace/roadmap/RoadmapStepCreateSheet";
import {
  RoadmapStepMark,
  resolveRoadmapMarkId,
} from "@/components/projects/workspace/roadmap/roadmapPathMarks";
import { persistProjectMotivationAndGoal } from "@/lib/projects/persistProjectBrief";
import { resolveProjectBrief } from "@/lib/projects/projectBrief";
import { splitRoadmapPathLayout, normalizeLane } from "@/lib/roadmap/pathLayout";
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
  } = useProjectWorkspace();
  const roadmap = useRoadmapProject(projectId);
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const [createChooserOpen, setCreateChooserOpen] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  /** 横追加：位置確定後に内容シートへ渡す下書き */
  const [pendingSideDraft, setPendingSideDraft] = useState<CreateSpaceDraft | null>(null);
  const [sideContentSheetOpen, setSideContentSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<DraftMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [proposed, setProposed] = useState<string[]>([]);
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

  const { main: mainSteps, bySideOf } = useMemo(
    () => splitRoadmapPathLayout(steps),
    [steps],
  );

  const currentMainIndex = useMemo(() => {
    const inProgress = mainSteps.findIndex((step) => step.status === "in_progress");
    if (inProgress >= 0) return inProgress;
    const firstOpen = mainSteps.findIndex((step) => step.status !== "completed");
    return Math.max(0, firstOpen >= 0 ? firstOpen : 0);
  }, [mainSteps]);
  const hasInProgressMain = mainSteps.some((step) => step.status === "in_progress");

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
  }, [projectId]);

  const phaseIdFromUrl = searchParams.get("phase");
  useEffect(() => {
    if (!phaseIdFromUrl || steps.length === 0) return;
    if (steps.some((step) => step.id === phaseIdFromUrl)) setSelectedId(phaseIdFromUrl);
  }, [phaseIdFromUrl, steps]);

  /** ?add=1 と sessionStorage で作成空間を維持（離脱して戻っても編集画面に落ちない） */
  const addFromUrl = searchParams.get("add") === "1";
  const createSpaceStorageKey = `moni-roadmap-create:${projectId}`;

  const roadmapHref = `/projects/${projectId}/roadmap`;
  const createSpaceHref = `${roadmapHref}?add=1`;

  function persistCreateSpaceOpen(open: boolean) {
    try {
      if (open) window.sessionStorage.setItem(createSpaceStorageKey, "1");
      else window.sessionStorage.removeItem(createSpaceStorageKey);
    } catch {
      /* ignore */
    }
    router.replace(open ? createSpaceHref : roadmapHref, { scroll: false });
  }

  useEffect(() => {
    if (!roadmap.canEdit || roadmap.loading) return;
    let stored = false;
    try {
      stored = window.sessionStorage.getItem(createSpaceStorageKey) === "1";
    } catch {
      stored = false;
    }
    // 横追加の途中なら作成空間を復元
    if (stored) {
      setCreateSpaceOpen(true);
      if (!addFromUrl) router.replace(createSpaceHref, { scroll: false });
      return;
    }
    setCreateSpaceOpen(false);
    // ?add=1 は追加方法の選択を開く（ロードマップ編集画面内）
    if (addFromUrl) {
      setCreateChooserOpen(true);
      router.replace(roadmapHref, { scroll: false });
    }
  }, [
    addFromUrl,
    roadmap.canEdit,
    roadmap.loading,
    createSpaceStorageKey,
    createSpaceHref,
    roadmapHref,
    router,
  ]);

  function openCreateChooser() {
    if (!roadmap.canEdit || busy) return;
    setSelectedId(null);
    setMode("manual");
    setCreateChooserOpen(true);
  }

  function openCreateSpace() {
    if (!roadmap.canEdit || busy) return;
    setSelectedId(null);
    setMode("manual");
    setCreateChooserOpen(false);
    setCreateSheetOpen(false);
    setPendingSideDraft(null);
    setSideContentSheetOpen(false);
    setCreateSpaceOpen(true);
    persistCreateSpaceOpen(true);
  }

  function closeCreateSpace() {
    setCreateSpaceOpen(false);
    setPendingSideDraft(null);
    setSideContentSheetOpen(false);
    persistCreateSpaceOpen(false);
  }

  function openCreateBelowSheet() {
    if (!roadmap.canEdit || busy) return;
    setCreateChooserOpen(false);
    setCreateSheetOpen(true);
  }

  function pickSidePosition(draft: CreateSpaceDraft) {
    setPendingSideDraft(draft);
    setSideContentSheetOpen(true);
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

  async function createStepBeside(values: {
    title: string;
    goal: string;
    description: string;
    icon: string;
  }) {
    if (!roadmap.canEdit || !pendingSideDraft) {
      throw new Error(tx("追加できるマスがありません", "Nothing to add"));
    }
    setBusy(true);
    setError("");
    try {
      const start = new Date();
      const sideOf = pendingSideDraft.sideOf;
      // 親が無い（空マップ）ときは本線の先頭として追加
      await roadmap.createPhase({
        title: values.title,
        goal: values.goal,
        description: values.description,
        icon: values.icon,
        startDate: start.toISOString(),
        endDate: addDays(start, 14).toISOString(),
        status: steps.length === 0 ? "in_progress" : "planned",
        sideOf: sideOf || null,
        lane: sideOf ? pendingSideDraft.lane : 0,
      });
      await workspaceReload();
      setPendingSideDraft(null);
      setSideContentSheetOpen(false);
      closeCreateSpace();
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
  const showCreateFab =
    roadmap.canEdit && !createSpaceOpen && !selectedId && mode === "manual";

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
                : tx("この挑戦の地図を、今から描こう", "Draw the map for this challenge")}
            </h1>
          </div>
          <p className="mt-1 text-[13px] text-zinc-500">
            {hasSteps
              ? tx(
                  "マスをタップして名前・絵・ゴール・詳細を編集できます。",
                  "Tap a step to edit its name, icon, goal, and details.",
                )
              : tx("右下のマス作成から最初のステップを追加しよう。", "Add the first step from Create step.")}
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

      <RoadmapPath
        /** 編集画面はマスも棒もすべてオレンジ（進行状況のグレー分けをしない） */
        segmentCleared={Array.from({ length: Math.max(mainSteps.length - 1, 0) }, () => true)}
      >
        {mainSteps.map((step, orderIndex) => {
          const stepNumber = orderIndex + 1;
          const expanded = selectedId === step.id;
          /** 編集画面では全マスをオレンジで表示（灰色にしない・キラキラなし） */
          const tone = "active" as const;
          const sidePhases = bySideOf.get(step.id) ?? [];
          const isCurrent =
            step.status === "in_progress" ||
            (!hasInProgressMain && orderIndex === currentMainIndex && step.status !== "completed");
          return (
            <RoadmapPathItem
              key={step.id}
              index={orderIndex}
              sides={sidePhases
                .map((side) => {
                  const lane = normalizeLane(side.lane);
                  if (lane !== -1 && lane !== 1) return null;
                  const sideTone = "active" as const;
                  const mainSparkle = isCurrent && step.status !== "completed";
                  return {
                    key: side.id,
                    lane,
                    children: (
                      <RoadmapPathNode
                        tone={sideTone}
                        sparkle={mainSparkle || side.status === "in_progress"}
                        selected={selectedId === side.id}
                        onClick={() => {
                          setSelectedId((current) => (current === side.id ? null : side.id));
                        }}
                        aria-label={tx(`横ステップ: ${side.title}`, `Side step: ${side.title}`)}
                      >
                        <RoadmapStepMark markId={side.icon} index={orderIndex} tone={sideTone} />
                      </RoadmapPathNode>
                    ),
                  };
                })
                .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot))}
            >
              <RoadmapPathNode
                tone={tone}
                sparkle={isCurrent && step.status !== "completed"}
                selected={expanded}
                onClick={() => {
                  setSelectedId((current) => (current === step.id ? null : step.id));
                }}
                aria-label={tx(`ステップ ${stepNumber}: ${step.title}`, `Step ${stepNumber}: ${step.title}`)}
              >
                <RoadmapStepMark markId={step.icon} index={orderIndex} tone={tone} />
              </RoadmapPathNode>
            </RoadmapPathItem>
          );
        })}
      </RoadmapPath>

      {error || roadmap.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error || roadmap.error}</p>
      ) : null}

      <button
        type="button"
        disabled={steps.length === 0 || busy}
        onClick={() => router.push(overviewHref)}
        className="min-h-[52px] w-full rounded-full bg-orange-500 text-base font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {tx("この地図を、歩き始める", "Start walking this map")}
      </button>

      {showCreateFab ? (
        <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 md:right-[max(1.5rem,calc((100vw-48rem)/2+1rem))]">
          <DuoButton
            type="button"
            tone="orange"
            size="md"
            onClick={openCreateChooser}
            disabled={busy}
            className="gap-2 !px-4 !py-3.5 !text-[15px]"
            aria-label={tx("マスを作成", "Create step")}
          >
            <Plus className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2.5} />
            {tx("マス作成", "Create step")}
          </DuoButton>
        </div>
      ) : null}

      <RoadmapPhaseEditSheet
        open={Boolean(selectedId) && Boolean(sheetStep) && roadmap.canEdit && !createSpaceOpen}
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
                  if (sheetStep.sideOf) {
                    const parentAt = mainSteps.findIndex((item) => item.id === sheetStep.sideOf);
                    if (parentAt >= 0) return parentAt + 1;
                  }
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
            // busy を立てない：アイコン即保存でシートがロック／閉じるのを防ぐ
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

      <RoadmapAddModeChooser
        open={createChooserOpen && roadmap.canEdit && !createSpaceOpen}
        onClose={() => setCreateChooserOpen(false)}
        onChooseBelow={openCreateBelowSheet}
        onChooseSide={openCreateSpace}
      />

      <RoadmapStepCreateSheet
        open={createSheetOpen && roadmap.canEdit && !createSpaceOpen}
        busy={busy}
        initialIcon={resolveRoadmapMarkId(undefined, mainSteps.length)}
        onClose={() => setCreateSheetOpen(false)}
        onSubmit={createStepBelow}
      />

      {createSpaceOpen && roadmap.canEdit ? (
        <RoadmapCreateSpace
          existingSteps={mainSteps.map((step) => ({
            id: step.id,
            title: step.title,
            icon: step.icon,
            order: step.order,
            status: step.status,
          }))}
          busy={busy}
          onClose={closeCreateSpace}
          onPickPosition={pickSidePosition}
        />
      ) : null}

      <RoadmapStepCreateSheet
        open={sideContentSheetOpen && Boolean(pendingSideDraft) && roadmap.canEdit}
        busy={busy}
        initialIcon={
          pendingSideDraft?.icon ?? resolveRoadmapMarkId(undefined, steps.length)
        }
        onClose={() => {
          setSideContentSheetOpen(false);
          setPendingSideDraft(null);
        }}
        onSubmit={createStepBeside}
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
