"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import {
  ROADMAP_PATH_LAYOUT,
  roadmapPathNodeCenter,
  roadmapPathSideCenter,
} from "@/components/projects/workspace/roadmap/RoadmapPath";
import { RoadmapPathNode } from "@/components/projects/workspace/roadmap/RoadmapPathNode";
import { RoadmapTrackViewport } from "@/components/projects/workspace/roadmap/RoadmapTrackViewport";
import {
  RoadmapStepMark,
  resolveRoadmapMarkId,
  type RoadmapMarkId,
} from "@/components/projects/workspace/roadmap/roadmapPathMarks";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  nextSidePlacement,
  ROADMAP_MAX_SIDES_PER_PARENT,
} from "@/lib/roadmap/pathLayout";

export type CreateSpaceExistingStep = {
  id: string;
  title: string;
  icon?: string | null;
  order: number;
  status?: string;
};

export type CreateSpaceExistingSide = {
  id: string;
  title: string;
  icon?: string | null;
  order: number;
  status?: string;
  sideOf: string;
  lane: -1 | 1;
  slotIndex: number;
};

export type CreateSpaceDraft = {
  id: string;
  icon: RoadmapMarkId;
  /** 上側の棒がつながる現存マス */
  prevId: string | null;
  /** 下側の棒がつながる現存マス */
  nextId: string | null;
  /** ロードマップへの挿入位置（0..n）※本線挿入の参考用 */
  insertAt: number;
  /** 横置きの親マス（本線のその行） */
  sideOf: string | null;
  /** 親マスから見て左(-1) / 右(1) */
  lane: -1 | 1;
  /** 同じ左右で何個目か（既存の外側に追加） */
  slotIndex: number;
  /** 接続作業が完了したか */
  done: boolean;
};

type Props = {
  existingSteps: CreateSpaceExistingStep[];
  /** すでに横に置いてあるマス（上書きせず外側へ足す） */
  existingSides?: CreateSpaceExistingSide[];
  busy?: boolean;
  onClose: () => void;
  /** 位置が決まったら内容シートを出す（まだ DB には書かない） */
  onPickPosition: (draft: CreateSpaceDraft) => void;
};

const { nodeSize: NODE, topPad: TOP, stepY: STEP_Y, trackWidth: TRACK_W } = ROADMAP_PATH_LAYOUT;
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

function existingCenter(index: number) {
  return roadmapPathNodeCenter(index);
}

function widerLaneForAnchor(anchorIndex: number, existingCount: number): -1 | 1 {
  if (existingCount <= 0) return 1;
  const i = Math.min(Math.max(anchorIndex, 0), existingCount - 1);
  const path = existingCenter(i);
  const leftSpace = path.x - NODE / 2;
  const rightSpace = TRACK_W - (path.x + NODE / 2);
  return rightSpace >= leftSpace ? 1 : -1;
}

function placementForAnchor(
  sides: CreateSpaceExistingSide[],
  steps: CreateSpaceExistingStep[],
  anchorIndex: number,
) {
  const clamped =
    steps.length === 0 ? 0 : Math.min(Math.max(anchorIndex, 0), steps.length - 1);
  const sideOf = steps[clamped]?.id ?? null;
  return nextSidePlacement(sides, sideOf, widerLaneForAnchor(clamped, steps.length));
}

/** その行の広い側・既存の外側スロットに追加マスを置く */
function draftCenterForAnchor(
  anchorIndex: number,
  existingCount: number,
  lane: -1 | 1,
  slotIndex: number,
) {
  if (existingCount <= 0) {
    return { x: TRACK_W / 2, y: TOP + NODE / 2 };
  }
  const i = Math.min(Math.max(anchorIndex, 0), existingCount - 1);
  return roadmapPathSideCenter(i, lane, slotIndex);
}

/** いま取り組んでいるマス（進行中 → 未完了の先頭） */
function currentStepIndex(steps: CreateSpaceExistingStep[]) {
  if (steps.length === 0) return 0;
  const inProgress = steps.findIndex((step) => step.status === "in_progress");
  if (inProgress >= 0) return inProgress;
  const firstOpen = steps.findIndex((step) => step.status !== "completed");
  return Math.max(0, firstOpen >= 0 ? firstOpen : 0);
}

/**
 * 自分のレーンから「一つ上」と「一つ下」へつなぐ。
 * 先頭は上棒なし / 末尾は下棒なし / 1マスだけのときは棒なし。
 */
function linksForAnchor(steps: CreateSpaceExistingStep[], anchorIndex: number) {
  if (steps.length === 0) {
    return { prevId: null as string | null, nextId: null as string | null, insertAt: 0 };
  }
  const last = steps.length - 1;
  const i = Math.min(Math.max(anchorIndex, 0), last);

  if (steps.length === 1) {
    return { prevId: null, nextId: null, insertAt: 0 };
  }
  if (i <= 0) {
    // 先頭: 上棒なし、下は一つ下
    return { prevId: null, nextId: steps[1]?.id ?? null, insertAt: 0 };
  }
  if (i >= last) {
    // 末尾: 下棒なし、上は一つ上
    return { prevId: steps[last - 1]?.id ?? null, nextId: null, insertAt: last };
  }
  return {
    prevId: steps[i - 1]?.id ?? null,
    nextId: steps[i + 1]?.id ?? null,
    insertAt: i,
  };
}

/** 棒の付け替え後の挿入位置 */
function insertAtFromLinks(
  steps: CreateSpaceExistingStep[],
  prevId: string | null,
  nextId: string | null,
) {
  if (prevId) {
    const prevAt = steps.findIndex((step) => step.id === prevId);
    if (prevAt >= 0) return prevAt + 1;
  }
  if (nextId) {
    const nextAt = steps.findIndex((step) => step.id === nextId);
    if (nextAt >= 0) return nextAt;
  }
  return steps.length;
}

/**
 * マス作成専用空間：
 * - 現存マスはメインタブと同じ中央の蛇行＋棒
 * - 追加マスは各行の広い側へ。上下スライドで行に吸着
 * - 棒は一つ上・一つ下へ。現存マスの下に描く
 */
export function RoadmapCreateSpace({
  existingSteps,
  existingSides = [],
  busy = false,
  onClose,
  onPickPosition,
}: Props) {
  const { tx } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const introTimersRef = useRef<number[]>([]);
  const [draft, setDraft] = useState<CreateSpaceDraft | null>(null);
  const [anchorIndex, setAnchorIndex] = useState(0);
  const [introPhase, setIntroPhase] = useState<IntroPhase>("idle");
  const [dragKind, setDragKind] = useState<"masu" | "prev" | "next" | null>(null);
  const [dragY, setDragY] = useState<number | null>(null);
  const [error, setError] = useState("");
  const currentIndex = useMemo(() => currentStepIndex(existingSteps), [existingSteps]);

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
      const placement = placementForAnchor(existingSides, existingSteps, clamped);
      if (!placement) {
        setError(
          tx(
            `このマスの横は${ROADMAP_MAX_SIDES_PER_PARENT}個までです。別のマスへスライドしてください。`,
            `Up to ${ROADMAP_MAX_SIDES_PER_PARENT} side steps here. Slide to another step.`,
          ),
        );
        return;
      }
      setError("");
      setAnchorIndex(clamped);
      const links = linksForAnchor(existingSteps, clamped);
      const sideOf = existingSteps[clamped]?.id ?? null;
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              prevId: links.prevId,
              nextId: links.nextId,
              insertAt: links.insertAt,
              sideOf,
              lane: placement.lane,
              slotIndex: placement.slotIndex,
            }
          : prev,
      );
    },
    [existingSteps, existingSides, tx],
  );

  const spawnDraft = useCallback(() => {
    if (busy) return;
    setDraft((current) => {
      if (current) return current;
      // いま取り組んでいるマスから開始。埋まっていれば空きのある親へ
      let startAnchor = currentStepIndex(existingSteps);
      let placement = placementForAnchor(existingSides, existingSteps, startAnchor);
      if (!placement && existingSteps.length > 0) {
        for (let i = 0; i < existingSteps.length; i++) {
          const candidate = placementForAnchor(existingSides, existingSteps, i);
          if (candidate) {
            startAnchor = i;
            placement = candidate;
            break;
          }
        }
      }
      if (!placement) {
        setError(
          tx(
            `横マスは各ステップ最大${ROADMAP_MAX_SIDES_PER_PARENT}個までです。`,
            `Each step can have up to ${ROADMAP_MAX_SIDES_PER_PARENT} side steps.`,
          ),
        );
        return current;
      }
      const links = linksForAnchor(existingSteps, startAnchor);
      const sideOf = existingSteps[startAnchor]?.id ?? null;
      const next: CreateSpaceDraft = {
        id: newDraftId(),
        icon: resolveRoadmapMarkId(undefined, existingSteps.length + existingSides.length),
        prevId: links.prevId,
        nextId: links.nextId,
        insertAt: links.insertAt,
        sideOf,
        lane: placement.lane,
        slotIndex: placement.slotIndex,
        done: false,
      };
      setAnchorIndex(startAnchor);
      setError("");
      queueMicrotask(() => runSelectionIntro(next));
      return next;
    });
  }, [busy, existingSteps, existingSides, runSelectionIntro, tx]);

  // 横追加で開いたらすぐマスを出す（もう一度＋を押させない）
  useEffect(() => {
    spawnDraft();
  }, [spawnDraft]);

  useEffect(() => {
    if (!dragKind || !draft || introPhase !== "ready") return;

    const onMove = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const localY = event.clientY - root.getBoundingClientRect().top;

      if (dragKind === "masu") {
        setDragY(localY);
        const nearest = nearestIndexFromY(localY);
        const snapY = existingCenter(nearest).y;
        if (Math.abs(localY - snapY) <= SNAP_PX) {
          applyAnchor(nearest);
          setDragY(snapY);
        }
        return;
      }

      // 棒を掴んで上下 → 近い現存マスへ接続先を付け替え
      const nearest = nearestIndexFromY(localY);
      const target = existingSteps[nearest];
      if (!target) return;
      setDraft((prev) => {
        if (!prev) return prev;
        if (dragKind === "prev") {
          if (target.id === prev.nextId) return prev;
          const prevId = target.id;
          return { ...prev, prevId, insertAt: insertAtFromLinks(existingSteps, prevId, prev.nextId) };
        }
        if (target.id === prev.prevId) return prev;
        const nextId = target.id;
        return { ...prev, nextId, insertAt: insertAtFromLinks(existingSteps, prev.prevId, nextId) };
      });
    };

    const onUp = () => {
      if (dragKind === "masu" && dragY != null) {
        applyAnchor(nearestIndexFromY(dragY));
      }
      setDragKind(null);
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
  }, [dragKind, draft, introPhase, dragY, nearestIndexFromY, applyAnchor, existingSteps]);

  function handlePickPosition() {
    if (!draft) {
      setError(tx("追加するマスがありません。＋で追加してください", "No step to add. Tap + first."));
      return;
    }
    if (introPhase !== "ready" || busy) return;
    setError("");
    onPickPosition({ ...draft, done: true });
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

  const draftLane =
    draft?.lane ??
    placementForAnchor(existingSides, existingSteps, anchorIndex)?.lane ??
    widerLaneForAnchor(anchorIndex, existingSteps.length);
  const draftSlot = draft?.slotIndex ?? 0;
  const draftCenter = useMemo(() => {
    const snapped = draftCenterForAnchor(
      anchorIndex,
      existingSteps.length,
      draftLane,
      draftSlot,
    );
    if (dragKind === "masu" && dragY != null) {
      return { x: snapped.x, y: dragY };
    }
    return snapped;
  }, [anchorIndex, existingSteps.length, draftLane, draftSlot, dragKind, dragY]);

  const prevTarget = draft?.prevId ? existingById.get(draft.prevId) : null;
  const nextTarget = draft?.nextId ? existingById.get(draft.nextId) : null;
  /** 外側スロットなら内側の既存横マスへ水平接続 */
  const innerSideTarget =
    draft && draft.slotIndex > 0
      ? existingSides.find(
          (side) =>
            side.sideOf === draft.sideOf &&
            side.lane === draft.lane &&
            side.slotIndex === draft.slotIndex - 1,
        )
      : null;

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

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-36 pt-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))]">
        <div className="mx-auto w-full max-w-lg px-4">
          <h1 className="text-lg font-bold text-zinc-950">{tx("マスを追加してつなぐ", "Add and connect steps")}</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
            {tx(
              `1つ目は広い側、2つ目は同じ側の外側、3つ目は2つ目の逆側に置きます（各ステップ最大${ROADMAP_MAX_SIDES_PER_PARENT}個）。上下にスライドして場所を変えられます。`,
              `1st on the wider side, 2nd outside it, 3rd opposite the 2nd (max ${ROADMAP_MAX_SIDES_PER_PARENT} per step). Slide to move.`,
            )}
          </p>
        </div>

        <RoadmapTrackViewport
          className="mt-5"
          width={TRACK_W}
          minHeight={contentHeight}
          trackRef={rootRef}
        >
          {/* 灰棒は最下層 */}
          <svg
            className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
            width={TRACK_W}
            height={contentHeight}
            viewBox={`0 0 ${TRACK_W} ${contentHeight}`}
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
          </svg>

          {/* オレンジ棒：現存マスより下。棒自体を掴んで付け替え */}
          {draft ? (
            <svg
              className={`absolute left-0 top-0 z-[1] overflow-visible ${
                interactive ? "touch-none" : "pointer-events-none"
              }`}
              width={TRACK_W}
              height={contentHeight}
              viewBox={`0 0 ${TRACK_W} ${contentHeight}`}
              aria-hidden
            >
              {draft.slotIndex === 0
                ? (["prev", "next"] as const).map((end) => {
                    const target = end === "prev" ? prevTarget : nextTarget;
                    if (!target) return null;
                    const visible = end === "prev" ? showPrevBar : showNextBar;
                    if (!visible) return null;
                    const drawing = end === "prev" ? introPhase === "prevBar" : introPhase === "nextBar";
                    const to = existingCenter(target.index);
                    const d = barPathTopToBottom(draftCenter, to);
                    return (
                      <g key={`${draft.id}-${end}-${drawing ? "draw" : "solid"}-${target.id}`}>
                        {interactive ? (
                          <path
                            d={d}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={28}
                            strokeLinecap="round"
                            className="cursor-grab active:cursor-grabbing"
                            style={{ pointerEvents: "stroke" }}
                            onPointerDown={(event) => {
                              if (busy) return;
                              event.preventDefault();
                              event.stopPropagation();
                              setDragKind(end);
                            }}
                          />
                        ) : null}
                        <path
                          d={d}
                          pathLength={1}
                          fill="none"
                          stroke="#F97316"
                          strokeWidth={14}
                          strokeLinecap="round"
                          className={drawing ? "roadmap-create-bar-draw" : undefined}
                          style={{ pointerEvents: "none" }}
                        />
                      </g>
                    );
                  })
                : null}
              {innerSideTarget && draft.sideOf ? (
                <path
                  d={`M ${roadmapPathSideCenter(anchorIndex, draft.lane, draft.slotIndex - 1).x} ${draftCenter.y} L ${draftCenter.x} ${draftCenter.y}`}
                  fill="none"
                  stroke="#F97316"
                  strokeWidth={14}
                  strokeLinecap="round"
                />
              ) : null}
            </svg>
          ) : null}

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
                  sparkle={index === currentIndex}
                  selected={Boolean(linked) || sameRow}
                  className="!w-auto"
                  aria-label={step.title}
                >
                  <RoadmapStepMark markId={step.icon} index={index} tone="upcoming" />
                </RoadmapPathNode>
              </div>
            );
          })}

          {/* 既存の横マス（上書きせず見えるように） */}
          {existingSides.map((side) => {
            const mainIndex = existingSteps.findIndex((step) => step.id === side.sideOf);
            if (mainIndex < 0) return null;
            const c = roadmapPathSideCenter(mainIndex, side.lane, side.slotIndex);
            return (
              <div
                key={side.id}
                className="absolute z-[2]"
                style={{ left: c.x - NODE / 2, top: c.y - NODE / 2, width: NODE, height: NODE }}
              >
                <RoadmapPathNode
                  tone="upcoming"
                  className="!w-auto"
                  aria-label={side.title}
                >
                  <RoadmapStepMark markId={side.icon} index={mainIndex} tone="upcoming" />
                </RoadmapPathNode>
              </div>
            );
          })}

          {/* 追加マス（広い側）— 登場中も色はそのまま */}
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
                if (!interactive || busy) return;
                event.preventDefault();
                (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
                setDragKind("masu");
                const root = rootRef.current;
                if (!root) return;
                setDragY(event.clientY - root.getBoundingClientRect().top);
              }}
            >
              <RoadmapPathNode
                tone="create"
                sparkle={interactive && dragKind !== "masu"}
                selected
                disabled={busy}
                className="!w-auto pointer-events-none"
                aria-label={tx("追加マス", "New step")}
              >
                <RoadmapStepMark markId={draft.icon} index={existingSteps.length} tone="create" />
              </RoadmapPathNode>
            </div>
          ) : null}
        </RoadmapTrackViewport>

        {error ? (
          <p className="mx-auto mt-3 w-full max-w-lg rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[75] border-t border-zinc-100 bg-white/95 px-4 pt-3 backdrop-blur-sm pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          <DuoButton
            type="button"
            tone="orange"
            size="md"
            fullWidth
            disabled={!draft || busy || introPlaying}
            onClick={handlePickPosition}
            className="gap-2 !text-[15px]"
          >
            <Check className="h-4 w-4" aria-hidden />
            {tx("この位置で内容を決める", "Set details for this spot")}
          </DuoButton>
          <DuoButton type="button" tone="zinc" size="md" fullWidth onClick={onClose} className="!text-[15px]">
            {tx("追加をやめる", "Cancel adding")}
          </DuoButton>
        </div>
      </div>
    </div>
  );
}
