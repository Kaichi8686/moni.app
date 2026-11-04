"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import {
  ROADMAP_PATH_LAYOUT,
  roadmapPathNodeCenter,
  roadmapPathOffsetX,
} from "@/components/projects/workspace/roadmap/RoadmapPath";
import { RoadmapPathNode } from "@/components/projects/workspace/roadmap/RoadmapPathNode";
import {
  RoadmapStepMark,
  resolveRoadmapMarkId,
  type RoadmapMarkId,
} from "@/components/projects/workspace/roadmap/roadmapPathMarks";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type CreateSpaceExistingStep = {
  id: string;
  title: string;
  icon?: string | null;
  order: number;
};

export type CreateSpaceDraft = {
  id: string;
  icon: RoadmapMarkId;
  /** 上側の棒がつながる現存マス */
  prevId: string | null;
  /** 下側の棒がつながる現存マス */
  nextId: string | null;
  /** 接続作業が完了したか */
  done: boolean;
};

type Props = {
  existingSteps: CreateSpaceExistingStep[];
  busy?: boolean;
  onClose: () => void;
  onConfirm: (drafts: CreateSpaceDraft[]) => Promise<void>;
};

const { nodeSize: NODE, topPad: TOP, stepY: STEP_Y, trackWidth: PATH_TRACK_W } = ROADMAP_PATH_LAYOUT;
/** 作成空間は左に広いレーンを確保し、現存パスを右へずらす */
const PATH_SHIFT_X = 56;
const CREATE_TRACK_W = PATH_TRACK_W + PATH_SHIFT_X + 8;
/** 追加マスは左側の広いスペースに固定 */
const DRAFT_LANE_X = 44 + NODE / 2;
const SNAP_PX = 46;

type IntroPhase = "idle" | "masu" | "prevBar" | "nextBar" | "pulse" | "ready";

const INTRO_MASU_MS = 320;
const INTRO_BAR_MS = 420;
const INTRO_PULSE_MS = 380;

function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function barPathTopToBottom(a: { x: number; y: number }, b: { x: number; y: number }) {
  const start = a.y <= b.y ? a : b;
  const end = a.y <= b.y ? b : a;
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

/** メインタブと同じ並びの座標を、作成空間用に右へずらす */
function existingCenter(index: number) {
  const c = roadmapPathNodeCenter(index);
  return { x: c.x + PATH_SHIFT_X, y: c.y };
}

function draftCenterForAnchor(anchorIndex: number, existingCount: number) {
  const y =
    existingCount > 0
      ? existingCenter(Math.min(Math.max(anchorIndex, 0), existingCount - 1)).y
      : TOP + NODE / 2;
  return { x: DRAFT_LANE_X, y };
}

/**
 * 自分のレーンから「一つ上」と「一つ下」の現存マスへつなぐ。
 * 先頭・末尾は片側だけ。
 */
function linksForAnchor(steps: CreateSpaceExistingStep[], anchorIndex: number) {
  if (steps.length === 0) return { prevId: null as string | null, nextId: null as string | null };
  const last = steps.length - 1;
  const i = Math.min(Math.max(anchorIndex, 0), last);
  if (i <= 0) {
    return { prevId: null, nextId: steps[0]?.id ?? null };
  }
  if (i >= last) {
    return { prevId: steps[last]?.id ?? null, nextId: null };
  }
  return {
    prevId: steps[i - 1]?.id ?? null,
    nextId: steps[i + 1]?.id ?? null,
  };
}

/**
 * マス作成専用空間：
 * - 現存マスはメインタブと同じ蛇行＋棒（右寄せ）
 * - 追加マスは左の広いレーン。上下スライドで行に吸着
 * - 棒はレーンから一つ上・一つ下へ。現存マスの下に描く
 */
export function RoadmapCreateSpace({ existingSteps, busy = false, onClose, onConfirm }: Props) {
  const { tx } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const introTimersRef = useRef<number[]>([]);
  const [draft, setDraft] = useState<CreateSpaceDraft | null>(null);
  const [anchorIndex, setAnchorIndex] = useState(0);
  const [introPhase, setIntroPhase] = useState<IntroPhase>("idle");
  const [draggingMasu, setDraggingMasu] = useState(false);
  const [dragY, setDragY] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const existingById = useMemo(() => {
    const map = new Map<string, CreateSpaceExistingStep & { index: number }>();
    existingSteps.forEach((step, index) => map.set(step.id, { ...step, index }));
    return map;
  }, [existingSteps]);

  const contentHeight = Math.max(
    TOP + Math.max(existingSteps.length, 1) * STEP_Y - (STEP_Y - NODE) + 48,
    360,
  );

  const clearIntroTimers = useCallback(() => {
    introTimersRef.current.forEach((id) => window.clearTimeout(id));
    introTimersRef.current = [];
  }, []);

  const runSelectionIntro = useCallback(
    (next: CreateSpaceDraft) => {
      clearIntroTimers();
      setIntroPhase("masu");
      const hasPrev = Boolean(next.prevId && existingById.has(next.prevId));
      const hasNext = Boolean(next.nextId && existingById.has(next.nextId));
      const schedule = (ms: number, fn: () => void) => {
        const id = window.setTimeout(fn, ms);
        introTimersRef.current.push(id);
      };
      let elapsed = INTRO_MASU_MS;
      if (hasPrev) {
        schedule(elapsed, () => setIntroPhase("prevBar"));
        elapsed += INTRO_BAR_MS;
      }
      if (hasNext) {
        schedule(elapsed, () => setIntroPhase("nextBar"));
        elapsed += INTRO_BAR_MS;
      }
      schedule(elapsed, () => setIntroPhase("pulse"));
      elapsed += INTRO_PULSE_MS;
      schedule(elapsed, () => setIntroPhase("ready"));
    },
    [clearIntroTimers, existingById],
  );

  useEffect(() => () => clearIntroTimers(), [clearIntroTimers]);

  const nearestIndexFromY = useCallback(
    (localY: number) => {
      if (existingSteps.length === 0) return 0;
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      existingSteps.forEach((_, index) => {
        const y = existingCenter(index).y;
        const d = Math.abs(y - localY);
        if (d < bestDist) {
          bestDist = d;
          best = index;
        }
      });
      return best;
    },
    [existingSteps],
  );

  const applyAnchor = useCallback(
    (index: number) => {
      const clamped =
        existingSteps.length === 0 ? 0 : Math.min(Math.max(index, 0), existingSteps.length - 1);
      setAnchorIndex(clamped);
      const links = linksForAnchor(existingSteps, clamped);
      setDraft((prev) => (prev ? { ...prev, prevId: links.prevId, nextId: links.nextId } : prev));
    },
    [existingSteps],
  );

  function spawnDraft() {
    if (busy || saving || draft) return;
    const startAnchor =
      existingSteps.length <= 2 ? Math.max(0, existingSteps.length - 1) : Math.min(2, existingSteps.length - 1);
    const links = linksForAnchor(existingSteps, startAnchor);
    const next: CreateSpaceDraft = {
      id: newDraftId(),
      icon: resolveRoadmapMarkId(undefined, existingSteps.length),
      prevId: links.prevId,
      nextId: links.nextId,
      done: false,
    };
    setAnchorIndex(startAnchor);
    setDraft(next);
    setError("");
    runSelectionIntro(next);
  }

  function clearDraft() {
    clearIntroTimers();
    setIntroPhase("idle");
    setDraggingMasu(false);
    setDragY(null);
    setDraft(null);
  }

  useEffect(() => {
    if (!draggingMasu || !draft || introPhase !== "ready") return;

    const onMove = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const localY = event.clientY - root.getBoundingClientRect().top;
      setDragY(localY);
      const nearest = nearestIndexFromY(localY);
      const snapY = existingCenter(nearest).y;
      if (Math.abs(localY - snapY) <= SNAP_PX) {
        applyAnchor(nearest);
        setDragY(snapY);
      }
    };

    const onUp = () => {
      if (dragY != null) applyAnchor(nearestIndexFromY(dragY));
      setDraggingMasu(false);
      setDragY(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [draggingMasu, draft, introPhase, dragY, nearestIndexFromY, applyAnchor]);

  async function handleConfirm() {
    if (!draft) {
      setError(tx("追加するマスがありません。＋で追加してください", "No step to add. Tap + first."));
      return;
    }
    if (introPhase !== "ready") return;
    if (!draft.prevId && !draft.nextId && existingSteps.length > 0) {
      setError(tx("上下どちらかの棒を現存マスにつないでください", "Connect at least one bar to an existing step"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm([{ ...draft, done: true }]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("追加に失敗しました", "Couldn’t add steps"));
    } finally {
      setSaving(false);
    }
  }

  const introPlaying = introPhase !== "idle" && introPhase !== "ready";
  const showPrevBar =
    introPhase === "prevBar" ||
    introPhase === "nextBar" ||
    introPhase === "pulse" ||
    introPhase === "ready";
  const showNextBar = introPhase === "nextBar" || introPhase === "pulse" || introPhase === "ready";
  const interactive = introPhase === "ready";
  const masuIntroClass =
    introPhase === "masu"
      ? "roadmap-create-masu-appear"
      : introPhase === "pulse"
        ? "roadmap-create-masu-pulse"
        : "";

  const existingCenters = useMemo(
    () => existingSteps.map((_, index) => existingCenter(index)),
    [existingSteps],
  );
  const existingPathD = useMemo(() => {
    if (existingCenters.length < 2) return "";
    const first = existingCenters[0];
    if (!first) return "";
    let d = `M ${first.x} ${first.y}`;
    for (let i = 1; i < existingCenters.length; i++) {
      const p = existingCenters[i];
      if (!p) continue;
      d += ` L ${p.x} ${p.y}`;
    }
    return d;
  }, [existingCenters]);

  const draftCenter = useMemo(() => {
    const snapped = draftCenterForAnchor(anchorIndex, existingSteps.length);
    if (draggingMasu && dragY != null) {
      return { x: snapped.x, y: dragY };
    }
    return snapped;
  }, [anchorIndex, existingSteps.length, draggingMasu, dragY]);

  const prevTarget = draft?.prevId ? existingById.get(draft.prevId) : null;
  const nextTarget = draft?.nextId ? existingById.get(draft.nextId) : null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white">
      <button
        type="button"
        onClick={onClose}
        className="fixed left-[max(1rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-[75] inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-800 shadow-sm backdrop-blur-sm"
        aria-label={tx("戻る", "Back")}
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </button>

      <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 pb-36 pt-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))]">
        <h1 className="text-lg font-bold text-zinc-950">{tx("マスを追加してつなぐ", "Add and connect steps")}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
          {tx(
            "＋でマスを1つ追加し、左の広いスペースで上下にスライドして行に吸着させます。棒は一つ上と下のマスにつながります。",
            "Add one step with +, slide it in the wide left lane to snap onto a row. Bars connect one above and one below.",
          )}
        </p>

        <div
          ref={rootRef}
          className="relative mx-auto mt-5"
          style={{ width: CREATE_TRACK_W, minHeight: contentHeight }}
        >
          {/* 棒はすべて現存マスより下（z-0） */}
          <svg
            className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
            width={CREATE_TRACK_W}
            height={contentHeight}
            viewBox={`0 0 ${CREATE_TRACK_W} ${contentHeight}`}
            aria-hidden
          >
            {existingPathD ? (
              <path
                d={existingPathD}
                fill="none"
                stroke="#D4D4D8"
                strokeWidth={14}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {draft
              ? (["prev", "next"] as const).map((end) => {
                  const target = end === "prev" ? prevTarget : nextTarget;
                  if (!target) return null;
                  const visible = end === "prev" ? showPrevBar : showNextBar;
                  if (!visible) return null;
                  const drawing = end === "prev" ? introPhase === "prevBar" : introPhase === "nextBar";
                  const to = existingCenter(target.index);
                  return (
                    <path
                      key={`${draft.id}-${end}-${drawing ? "draw" : "solid"}-${target.id}`}
                      d={barPathTopToBottom(draftCenter, to)}
                      pathLength={1}
                      fill="none"
                      stroke="#F97316"
                      strokeWidth={12}
                      strokeLinecap="round"
                      className={drawing ? "roadmap-create-bar-draw" : undefined}
                    />
                  );
                })
              : null}
          </svg>

          {/* 現存マス（棒の上） */}
          {existingSteps.map((step, index) => {
            const c = existingCenter(index);
            const linked =
              draft && (draft.prevId === step.id || draft.nextId === step.id);
            const sameRow = Boolean(draft) && index === anchorIndex;
            return (
              <div
                key={step.id}
                className="absolute z-[2]"
                style={{ left: c.x - NODE / 2, top: c.y - NODE / 2, width: NODE, height: NODE }}
              >
                <RoadmapPathNode
                  tone="upcoming"
                  selected={Boolean(linked) || sameRow}
                  className="!w-auto"
                  aria-label={step.title}
                >
                  <RoadmapStepMark markId={step.icon} index={index} tone="upcoming" />
                </RoadmapPathNode>
              </div>
            );
          })}

          {/* 追加マス（左レーン） */}
          {draft ? (
            <div
              className={`absolute z-[3] touch-none ${masuIntroClass} ${
                interactive ? "cursor-grab active:cursor-grabbing" : ""
              }`}
              style={{
                left: draftCenter.x - NODE / 2,
                top: draftCenter.y - NODE / 2,
                width: NODE,
                height: NODE,
              }}
              onPointerDown={(event) => {
                if (!interactive || busy || saving) return;
                event.preventDefault();
                (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
                setDraggingMasu(true);
                const root = rootRef.current;
                if (!root) return;
                setDragY(event.clientY - root.getBoundingClientRect().top);
              }}
            >
              <RoadmapPathNode
                tone="create"
                sparkle={interactive && !draggingMasu}
                selected
                disabled={introPlaying || busy || saving}
                className="!w-auto pointer-events-none"
                aria-label={tx("追加マス", "New step")}
              >
                <RoadmapStepMark markId={draft.icon} index={existingSteps.length} tone="create" />
              </RoadmapPathNode>
            </div>
          ) : null}

          {/* パス末尾の＋は1つだけ（追加マス未作成時） */}
          {!draft ? (
            <div
              className="absolute z-[2]"
              style={{
                left: PATH_TRACK_W / 2 + PATH_SHIFT_X + roadmapPathOffsetX(existingSteps.length) - NODE / 2,
                top: TOP + existingSteps.length * STEP_Y,
                width: NODE,
                height: NODE,
              }}
            >
              <RoadmapPathNode
                tone="create"
                className="!w-auto"
                onClick={spawnDraft}
                disabled={busy || saving}
                aria-label={tx("マスを追加", "Add step")}
              >
                <Plus className="h-8 w-8 text-white" strokeWidth={2.75} aria-hidden />
              </RoadmapPathNode>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[75] border-t border-zinc-100 bg-white/95 px-4 pt-3 backdrop-blur-sm pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          {draft ? (
            <>
              <DuoButton
                type="button"
                tone="orange"
                size="md"
                fullWidth
                disabled={busy || saving || introPlaying}
                onClick={() => void handleConfirm()}
                className="gap-2 !text-[15px]"
              >
                <Check className="h-4 w-4" aria-hidden />
                {saving
                  ? tx("反映中…", "Saving…")
                  : tx("このマスをロードマップへ", "Add this step to roadmap")}
              </DuoButton>
              <DuoButton type="button" tone="zinc" size="md" fullWidth onClick={clearDraft} className="!text-[15px]">
                {tx("追加をやめる", "Cancel adding")}
              </DuoButton>
            </>
          ) : (
            <DuoButton
              type="button"
              tone="peach"
              size="md"
              fullWidth
              disabled={busy || saving}
              onClick={spawnDraft}
              className="gap-2 !text-[15px]"
            >
              <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />
              {tx("マスを追加", "Add a step")}
            </DuoButton>
          )}
        </div>
      </div>
    </div>
  );
}
