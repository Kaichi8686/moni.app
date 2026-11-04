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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<DraftMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [proposed, setProposed] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [goalDetailOpen, setGoalDetailOpen] = useState(false);
  /** パス末尾の＋が見えている間は FAB を出さない（初期は隠す） */
  const [createNodeInView, setCreateNodeInView] = useState(true);
  const createNodeInViewRef = useRef(true);
  const createNodeRef = useRef<HTMLDivElement | null>(null);

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

  const selectedStep = useMemo(
    () => (selectedId ? steps.find((step) => step.id === selectedId) ?? null : null),
    [selectedId, steps],
  );

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

  const showPathCreate = roadmap.canEdit && !createSpaceOpen;

  useEffect(() => {
    if (!showPathCreate) {
      createNodeInViewRef.current = false;
      setCreateNodeInView(false);
      return;
    }

    let alive = true;
    let settleTimer = 0;
    let raf = 0;
    let resizeObserver: ResizeObserver | null = null;

    const apply = (nextInView: boolean) => {
      if (!alive || nextInView === createNodeInViewRef.current) return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (!alive) return;
        createNodeInViewRef.current = nextInView;
        setCreateNodeInView(nextInView);
      }, 90);
    };

    /** ＋マスが画面内（FAB 帯を除く）にどれだけ見えるかで判定。IO の取りこぼしを避ける */
    const measure = () => {
      const el = createNodeRef.current;
      if (!el) {
        // まだ測れないときは FAB を出して見逃しを防ぐ
        apply(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const fabZone = Math.min(128, Math.max(88, vh * 0.16));
      const viewTop = 0;
      const viewBottom = vh - fabZone;
      const overlap = Math.max(0, Math.min(rect.bottom, viewBottom) - Math.max(rect.top, viewTop));
      const ratio = rect.height > 0 ? overlap / rect.height : 0;
      const wasInView = createNodeInViewRef.current;
      if (wasInView) {
        if (ratio < 0.18) apply(false);
      } else if (ratio >= 0.42) {
        apply(true);
      }
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    };

    // 初期は一度測る（デフォルトで隠したままにしない）
    measure();
    const boot = window.requestAnimationFrame(() => {
      measure();
      const el = createNodeRef.current;
      if (!el || !alive) return;
      resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(el);
    });
    const retryA = window.setTimeout(scheduleMeasure, 80);
    const retryB = window.setTimeout(scheduleMeasure, 250);

    window.addEventListener("scroll", scheduleMeasure, true);
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      alive = false;
      window.cancelAnimationFrame(boot);
      window.cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
      window.clearTimeout(retryA);
      window.clearTimeout(retryB);
      window.removeEventListener("scroll", scheduleMeasure, true);
      window.removeEventListener("resize", scheduleMeasure);
      resizeObserver?.disconnect();
    };
  }, [showPathCreate, steps.length]);

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
    setCreateSpaceOpen(true);
    persistCreateSpaceOpen(true);
  }

  function closeCreateSpace() {
    setCreateSpaceOpen(false);
    persistCreateSpaceOpen(false);
  }

  function openCreateBelowSheet() {
    if (!roadmap.canEdit || busy) return;
    setCreateChooserOpen(false);
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
        status: steps.length === 0 ? "in_progress" : "planned",
      });
      await workspaceReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("ステップを追加できませんでした", "Couldn’t add the step"));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  function insertIndexForDraft(
    working: Array<{ id: string }>,
    draft: CreateSpaceDraft,
  ): number {
    if (typeof draft.insertAt === "number" && Number.isFinite(draft.insertAt)) {
      return Math.min(Math.max(Math.round(draft.insertAt), 0), working.length);
    }
    if (draft.prevId) {
      const prevAt = working.findIndex((item) => item.id === draft.prevId);
      if (prevAt >= 0) return prevAt + 1;
    }
    if (draft.nextId) {
      const nextAt = working.findIndex((item) => item.id === draft.nextId);
      if (nextAt >= 0) return nextAt;
    }
    return working.length;
  }

  async function confirmCreateSpaceDrafts(doneDrafts: CreateSpaceDraft[]) {
    if (!roadmap.canEdit || doneDrafts.length === 0) {
      throw new Error(tx("追加できるマスがありません", "Nothing to add"));
    }
    if (!supabase) {
      throw new Error(tx("接続できませんでした", "Couldn’t connect"));
    }
    setBusy(true);
    setError("");
    try {
      const client = supabase;
      // 最終的な並びを先に組み立ててから、一時 order → 本番 order で衝突なく書き込む
      const working = steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => ({ id: step.id, icon: step.icon as string | null | undefined }));

      const start = new Date();
      const end = addDays(start, 14);
      const insertedIds: string[] = [];

      for (const [index, draft] of doneDrafts.entries()) {
        const at = insertIndexForDraft(
          working.map((row, order) => ({ id: row.id, order })),
          draft,
        );
        const title = tx(`新しいステップ ${steps.length + index + 1}`, `New step ${steps.length + index + 1}`);
        const tempOrder = 50_000 + index;
        const base = {
          project_id: projectId,
          title,
          goal: "",
          description: "",
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          status: working.length === 0 ? ("in_progress" as const) : ("planned" as const),
          color: "amber",
          order: tempOrder,
          icon: draft.icon,
        };
        let { data, error: insertError } = await client
          .from("project_phases")
          .insert(base)
          .select("id")
          .single();
        if (insertError && /icon/i.test(insertError.message)) {
          const { icon: _drop, ...withoutIcon } = base;
          void _drop;
          ({ data, error: insertError } = await client
            .from("project_phases")
            .insert(withoutIcon)
            .select("id")
            .single());
        }
        if (insertError || !data?.id) {
          throw new Error(insertError?.message || tx("ステップを追加できませんでした", "Couldn’t add the step"));
        }
        const newId = String(data.id);
        insertedIds.push(newId);
        working.splice(at, 0, { id: newId, icon: draft.icon });
      }

      // 衝突回避のため一度ずらしてから 0..n-1 に整列
      const TEMP = 100_000;
      for (const [index, row] of working.entries()) {
        const { error: tempError } = await client
          .from("project_phases")
          .update({ order: TEMP + index })
          .eq("id", row.id);
        if (tempError) throw new Error(tempError.message);
      }
      for (const [order, row] of working.entries()) {
        const { error: orderError } = await client
          .from("project_phases")
          .update({ order })
          .eq("id", row.id);
        if (orderError) throw new Error(orderError.message);
      }

      void insertedIds;
      await syncReload();
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
  const createFabAllowed =
    roadmap.canEdit && !createSpaceOpen && !selectedId && mode === "manual";
  const showCreateFab = createFabAllowed && !createNodeInView;

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
              : tx("右下のマス作成、または＋のマスから最初のステップを追加しよう。", "Add the first step from Create step or the + node.")}
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
        segmentCleared={Array.from(
          { length: Math.max(steps.length + (showPathCreate ? 1 : 0) - 1, 0) },
          () => true,
        )}
      >
        {steps.map((step, orderIndex) => {
          const stepNumber = orderIndex + 1;
          const expanded = selectedId === step.id;
          /** 編集画面では全マスをオレンジで表示（灰色にしない・キラキラなし） */
          const tone = "active" as const;
          return (
            <RoadmapPathItem key={step.id} index={orderIndex}>
              <RoadmapPathNode
                tone={tone}
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

        {showPathCreate ? (
          <RoadmapPathItem index={steps.length}>
            <div ref={createNodeRef} data-roadmap-create-node className="flex w-full justify-center">
              <RoadmapPathNode
                tone="create"
                disabled={busy}
                onClick={openCreateChooser}
                aria-label={
                  steps.length === 0
                    ? tx("ロードマップを作成する", "Create roadmap")
                    : tx("次のステップを追加", "Add the next step")
                }
              >
                <RoadmapStepMark index={steps.length} tone="create" />
              </RoadmapPathNode>
            </div>
          </RoadmapPathItem>
        ) : null}
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

      {createFabAllowed ? (
        <div
          className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 transition-[opacity,transform] duration-200 ease-out md:right-[max(1.5rem,calc((100vw-48rem)/2+1rem))] ${
            showCreateFab
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0"
          }`}
          aria-hidden={!showCreateFab}
        >
          <DuoButton
            type="button"
            tone="orange"
            size="md"
            onClick={openCreateChooser}
            disabled={busy || !showCreateFab}
            tabIndex={showCreateFab ? 0 : -1}
            className="gap-2 !px-4 !py-3.5 !text-[15px]"
            aria-label={tx("マスを作成", "Create step")}
          >
            <Plus className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2.5} />
            {tx("マス作成", "Create step")}
          </DuoButton>
        </div>
      ) : null}

      <RoadmapPhaseEditSheet
        open={Boolean(selectedStep) && roadmap.canEdit && !createSpaceOpen}
        phase={
          selectedStep
            ? {
                id: selectedStep.id,
                title: selectedStep.title,
                goal: selectedStep.goal,
                description: selectedStep.description,
                icon: selectedStep.icon,
                stepNumber: steps.findIndex((item) => item.id === selectedStep.id) + 1,
              }
            : null
        }
        busy={busy}
        onClose={() => setSelectedId(null)}
        onSave={async (patch) => {
          if (!selectedStep) return;
          await roadmap.updatePhase(selectedStep.id, {
            title: patch.title,
            goal: patch.goal,
            description: patch.description,
            icon: patch.icon,
          });
          await workspaceReload();
        }}
        onDelete={
          selectedStep
            ? async () => {
                await removeStep(selectedStep.id);
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
        initialIcon={resolveRoadmapMarkId(undefined, steps.length)}
        onClose={() => setCreateSheetOpen(false)}
        onSubmit={createStepBelow}
      />

      {createSpaceOpen && roadmap.canEdit ? (
        <RoadmapCreateSpace
          existingSteps={steps.map((step) => ({
            id: step.id,
            title: step.title,
            icon: step.icon,
            order: step.order,
            status: step.status,
          }))}
          busy={busy}
          onClose={closeCreateSpace}
          onConfirm={confirmCreateSpaceDrafts}
        />
      ) : null}

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
