"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
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

const NODE = 72;
const EXISTING_X = 72;
const DRAFT_X = 260;
const TOP = 28;
const GAP = 108;
const TRACK_W = 360;

function centerOf(index: number, columnX: number) {
  return {
    x: columnX + NODE / 2,
    y: TOP + index * GAP + NODE / 2,
  };
}

function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildInitialDrafts(existing: CreateSpaceExistingStep[]): CreateSpaceDraft[] {
  const count = Math.max(3, 1);
  return Array.from({ length: count }, (_, index) => {
    const prev = existing[existing.length - 1 + index] ?? existing[existing.length - 1] ?? null;
    // 追加列はいったん末尾接続の候補として並べる（後で棒スライドで付け替え）
    return {
      id: newDraftId(),
      icon: resolveRoadmapMarkId(undefined, existing.length + index),
      prevId: prev?.id ?? null,
      nextId: null,
      done: false,
    };
  });
}

/**
 * マス作成専用空間：
 * - 現存マスは灰色
 * - 追加マスはオレンジ列。押すと光り、他の追加は消え、上下の棒が出る
 * - 棒の先をスライドして、どの現存マスとつなぐか変えられる
 * - 1マスの接続が終わるまで次の追加マスには進めない
 */
export function RoadmapCreateSpace({ existingSteps, busy = false, onClose, onConfirm }: Props) {
  const { tx } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [drafts, setDrafts] = useState<CreateSpaceDraft[]>(() => buildInitialDrafts(existingSteps));
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<"prev" | "next" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const existingById = useMemo(() => {
    const map = new Map<string, CreateSpaceExistingStep & { index: number }>();
    existingSteps.forEach((step, index) => map.set(step.id, { ...step, index }));
    return map;
  }, [existingSteps]);

  const activeIndex = drafts.findIndex((draft) => draft.id === activeDraftId);
  const activeDraft = activeIndex >= 0 ? drafts[activeIndex] : null;

  /** 完了済みの直後の未完了だけ作業可能 */
  const unlockedIndex = drafts.findIndex((draft) => !draft.done);
  const workIndex = unlockedIndex < 0 ? drafts.length : unlockedIndex;

  useEffect(() => {
    // 既存が変わったら未確定ドラフトだけ付け替え候補を更新しない（選択中を壊さない）
  }, [existingSteps]);

  const contentHeight = Math.max(
    TOP + Math.max(existingSteps.length, drafts.length, 1) * GAP + 48,
    420,
  );

  const findNearestExisting = useCallback(
    (clientX: number, clientY: number) => {
      const root = rootRef.current;
      if (!root) return null;
      const rootRect = root.getBoundingClientRect();
      const localX = clientX - rootRect.left;
      const localY = clientY - rootRect.top;
      let bestId: string | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      existingSteps.forEach((step, index) => {
        const c = centerOf(index, EXISTING_X);
        const dx = c.x - localX;
        const dy = c.y - localY;
        const d = Math.hypot(dx, dy);
        if (d < bestDist) {
          bestDist = d;
          bestId = step.id;
        }
      });
      // 近すぎるときだけ吸着
      return bestDist <= 88 ? bestId : null;
    },
    [existingSteps],
  );

  useEffect(() => {
    if (!dragEnd || !activeDraftId) return;

    const onMove = (event: PointerEvent) => {
      const nearest = findNearestExisting(event.clientX, event.clientY);
      if (!nearest) return;
      setDrafts((prev) =>
        prev.map((draft) => {
          if (draft.id !== activeDraftId) return draft;
          if (dragEnd === "prev") {
            if (nearest === draft.nextId) return draft;
            return { ...draft, prevId: nearest };
          }
          if (nearest === draft.prevId) return draft;
          return { ...draft, nextId: nearest };
        }),
      );
    };

    const onUp = () => setDragEnd(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragEnd, activeDraftId, findNearestExisting]);

  function selectDraft(draftId: string) {
    const index = drafts.findIndex((draft) => draft.id === draftId);
    if (index < 0 || index > workIndex) return;
    if (drafts[index]?.done) return;
    setActiveDraftId(draftId);
  }

  function clearSelection() {
    setActiveDraftId(null);
    setDragEnd(null);
  }

  function markActiveDone() {
    if (!activeDraft) return;
    if (!activeDraft.prevId && !activeDraft.nextId && existingSteps.length > 0) {
      setError(tx("上下どちらかの棒を現存マスにつないでください", "Connect at least one bar to an existing step"));
      return;
    }
    setError("");
    setDrafts((prev) =>
      prev.map((draft) => (draft.id === activeDraft.id ? { ...draft, done: true } : draft)),
    );
    setActiveDraftId(null);
  }

  function addDraftColumn() {
    setDrafts((prev) => {
      const lastDoneOrTail = prev[prev.length - 1];
      const fallbackPrev =
        lastDoneOrTail?.prevId ??
        existingSteps[existingSteps.length - 1]?.id ??
        null;
      return [
        ...prev,
        {
          id: newDraftId(),
          icon: resolveRoadmapMarkId(undefined, existingSteps.length + prev.length),
          prevId: fallbackPrev,
          nextId: null,
          done: false,
        },
      ];
    });
  }

  async function handleConfirm() {
    const ready = drafts.filter((draft) => draft.done);
    if (ready.length === 0) {
      setError(tx("接続を完了したマスがありません", "No connected steps to add yet"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm(ready);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("追加に失敗しました", "Couldn’t add steps"));
    } finally {
      setSaving(false);
    }
  }

  const showingSelection = Boolean(activeDraft);

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
            "オレンジの追加マスを1つ選び、上下の棒をスライドして現存マスとつなぎます。1つ終わるまで次には進めません。",
            "Pick one orange step, slide the bars to existing steps. Finish one before the next.",
          )}
        </p>

        <div
          ref={rootRef}
          className="relative mx-auto mt-5"
          style={{ width: TRACK_W, minHeight: contentHeight }}
        >
          {/* 現存マス（灰色） */}
          {existingSteps.map((step, index) => {
            const c = centerOf(index, EXISTING_X);
            const linked =
              activeDraft &&
              (activeDraft.prevId === step.id || activeDraft.nextId === step.id);
            return (
              <div
                key={step.id}
                className="absolute"
                style={{ left: c.x - NODE / 2, top: c.y - NODE / 2, width: NODE, height: NODE }}
              >
                <RoadmapPathNode
                  tone="upcoming"
                  selected={Boolean(linked)}
                  className="!w-auto"
                  aria-label={step.title}
                >
                  <RoadmapStepMark markId={step.icon} index={index} tone="upcoming" />
                </RoadmapPathNode>
              </div>
            );
          })}

          {/* 追加マス列 */}
          {drafts.map((draft, index) => {
            if (showingSelection && draft.id !== activeDraftId) return null;
            const locked = index > workIndex;
            const c = centerOf(index, DRAFT_X);
            const isActive = draft.id === activeDraftId;
            return (
              <div
                key={draft.id}
                className="absolute"
                style={{ left: c.x - NODE / 2, top: c.y - NODE / 2, width: NODE, height: NODE }}
              >
                <RoadmapPathNode
                  tone={draft.done ? "done" : "create"}
                  sparkle={isActive}
                  selected={isActive || draft.done}
                  disabled={locked || draft.done || busy || saving}
                  className="!w-auto"
                  onClick={() => selectDraft(draft.id)}
                  aria-label={tx(`追加マス ${index + 1}`, `New step ${index + 1}`)}
                >
                  <RoadmapStepMark
                    markId={draft.icon}
                    index={existingSteps.length + index}
                    tone={draft.done ? "done" : "create"}
                  />
                </RoadmapPathNode>
              </div>
            );
          })}

          {/* 選択中の上下棒 */}
          {activeDraft ? (
            <svg
              className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
              width={TRACK_W}
              height={contentHeight}
              viewBox={`0 0 ${TRACK_W} ${contentHeight}`}
              aria-hidden
            >
              {(["prev", "next"] as const).map((end) => {
                const targetId = end === "prev" ? activeDraft.prevId : activeDraft.nextId;
                if (!targetId) return null;
                const target = existingById.get(targetId);
                if (!target) return null;
                const from = centerOf(activeIndex, DRAFT_X);
                const to = centerOf(target.index, EXISTING_X);
                return (
                  <g key={end}>
                    <path
                      d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                      fill="none"
                      stroke="#F97316"
                      strokeWidth={12}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            </svg>
          ) : null}

          {/* 棒の先（ドラッグハンドル） */}
          {activeDraft
            ? (["prev", "next"] as const).map((end) => {
                const targetId = end === "prev" ? activeDraft.prevId : activeDraft.nextId;
                const target = targetId ? existingById.get(targetId) : null;
                const from = centerOf(activeIndex, DRAFT_X);
                const handle = target
                  ? centerOf(target.index, EXISTING_X)
                  : {
                      x: from.x - 70,
                      y: end === "prev" ? from.y - 56 : from.y + 56,
                    };
                return (
                  <button
                    key={`handle-${end}`}
                    type="button"
                    className={`absolute z-[2] h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${
                      dragEnd === end ? "bg-orange-600" : "bg-orange-400"
                    }`}
                    style={{ left: handle.x, top: handle.y }}
                    aria-label={
                      end === "prev"
                        ? tx("上の棒をスライド", "Slide upper bar")
                        : tx("下の棒をスライド", "Slide lower bar")
                    }
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setDragEnd(end);
                    }}
                  />
                );
              })
            : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[75] border-t border-zinc-100 bg-white/95 px-4 pt-3 backdrop-blur-sm pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          {activeDraft ? (
            <>
              <DuoButton
                type="button"
                tone="orange"
                size="md"
                fullWidth
                disabled={busy || saving}
                onClick={markActiveDone}
                className="gap-2 !text-[15px]"
              >
                <Check className="h-4 w-4" aria-hidden />
                {tx("このマスの接続を完了", "Finish this connection")}
              </DuoButton>
              <DuoButton type="button" tone="zinc" size="md" fullWidth onClick={clearSelection} className="!text-[15px]">
                {tx("選択をやめる", "Deselect")}
              </DuoButton>
            </>
          ) : (
            <>
              <DuoButton
                type="button"
                tone="peach"
                size="md"
                fullWidth
                disabled={busy || saving}
                onClick={addDraftColumn}
                className="gap-2 !text-[15px]"
              >
                <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />
                {tx("列にマスを追加", "Add another in the column")}
              </DuoButton>
              <DuoButton
                type="button"
                tone="orange"
                size="md"
                fullWidth
                disabled={busy || saving || drafts.every((draft) => !draft.done)}
                onClick={() => void handleConfirm()}
                className="!text-[15px]"
              >
                {saving
                  ? tx("反映中…", "Saving…")
                  : tx("つなぎ終えたマスをロードマップへ", "Add finished steps to roadmap")}
              </DuoButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
