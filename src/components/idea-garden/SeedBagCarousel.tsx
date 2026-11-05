"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { animate, motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SeedBagArt } from "@/components/idea-garden/illustrations/SeedBagArt";
import { SEED_BAGS } from "@/lib/idea-garden/seedBags";
import type { FlowerKind } from "@/lib/idea-garden/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** スロット間隔。横の袋が途切れない幅に */
const SLOT = 152;
const SPRING = { type: "spring" as const, stiffness: 480, damping: 40, mass: 0.55 };
const DRAG_SELECT_SLOP = 10;

type Props = {
  index: number;
  onIndexChange: (next: number) => void;
  onSelect: (kind: FlowerKind) => void;
};

function wrap(i: number) {
  const n = SEED_BAGS.length;
  return ((i % n) + n) % n;
}

function BagSlot({
  off,
  kind,
  x,
  label,
  handoff,
}: {
  off: number;
  kind: FlowerKind;
  x: MotionValue<number>;
  label: string;
  /** フォーカス画面への受け渡し時だけ layoutId を付ける */
  handoff: boolean;
}) {
  const scale = useTransform(x, (latest) => {
    const dist = Math.abs(off * SLOT + latest);
    const t = Math.max(0, Math.min(1, 1 - dist / SLOT));
    return 0.68 + 0.32 * t;
  });
  const opacity = useTransform(x, (latest) => {
    const dist = Math.abs(off * SLOT + latest);
    if (dist >= SLOT * 2.4) return 0.18;
    if (dist >= SLOT * 0.55) return 0.45;
    return 1;
  });

  const isCenter = off === 0;

  return (
    <div
      className="pointer-events-none absolute flex shrink-0 items-center justify-center"
      style={{
        width: SLOT,
        transform: `translateX(${off * SLOT}px)`,
      }}
    >
      <motion.div style={{ scale, opacity }} className="flex origin-center items-center justify-center">
        <div className="relative z-10 shrink-0" aria-hidden={!isCenter}>
          <motion.div
            layoutId={handoff && isCenter ? `idea-seed-bag-${kind}` : undefined}
            transition={{ type: "spring", stiffness: 220, damping: 24, mass: 0.95 }}
            className="flex items-center justify-center"
          >
            <SeedBagArt kind={kind} selected className="h-56 w-44" />
          </motion.div>
        </div>
      </motion.div>
      {isCenter ? (
        <span className="sr-only">{label}</span>
      ) : null}
    </div>
  );
}

/** 種袋カルーセル — 移動は先にアニメ、着地後に付け替え（矢印連打でも袋が消えない） */
export function SeedBagCarousel({ index, onIndexChange, onSelect }: Props) {
  const { tx, locale } = useI18n();
  const x = useMotionValue(0);
  const [displayIndex, setDisplayIndex] = useState(index);
  const [labelIndex, setLabelIndex] = useState(index);
  const [handoffKind, setHandoffKind] = useState<FlowerKind | null>(null);

  const displayIndexRef = useRef(displayIndex);
  displayIndexRef.current = displayIndex;
  const labelIndexRef = useRef(labelIndex);
  labelIndexRef.current = labelIndex;
  const movingRef = useRef(false);
  const pendingRemapRef = useRef<number | null>(null);
  const moveGenRef = useRef(0);
  /** 矢印連打分。+ は次へ、- は前へ */
  const queuedStepsRef = useRef(0);

  const ptrRef = useRef<{
    id: number;
    startClientX: number;
    originX: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (movingRef.current || pendingRemapRef.current != null) return;
    setDisplayIndex(index);
    setLabelIndex(index);
  }, [index]);

  useLayoutEffect(() => {
    if (pendingRemapRef.current == null) return;
    if (pendingRemapRef.current !== displayIndex) return;
    // 付け替えと同フレームで x を戻し、中央が空になるフレームを作らない
    x.set(0);
    pendingRemapRef.current = null;
    movingRef.current = false;

    const queued = queuedStepsRef.current;
    if (queued !== 0) {
      const dir: -1 | 1 = queued > 0 ? 1 : -1;
      queuedStepsRef.current -= dir;
      // 着地直後に次のスライドを開始（連打を1枚ずつ消化）
      startSlideRef.current(dir);
    }
  }, [displayIndex, x]);

  const bag = SEED_BAGS[labelIndex]!;

  const startSlide = (dir: -1 | 1) => {
    const next = wrap(displayIndexRef.current + dir);
    const gen = ++moveGenRef.current;
    labelIndexRef.current = next;
    setLabelIndex(next);
    movingRef.current = true;
    x.stop();
    x.set(0);
    // dir=1（次）→ 左へ -SLOT。隣（+1）が中央へ来る
    void animate(x, -dir * SLOT, {
      type: "tween",
      duration: 0.2,
      ease: [0.22, 1, 0.36, 1],
    }).then(() => {
      if (moveGenRef.current !== gen || !movingRef.current) return;
      displayIndexRef.current = next;
      pendingRemapRef.current = next;
      setDisplayIndex(next);
      onIndexChange(next);
    });
  };
  const startSlideRef = useRef(startSlide);
  startSlideRef.current = startSlide;

  /** 隣の袋を中央へ滑らせ、着地後に index 付け替え。連打はキューする */
  const slideBy = (dir: -1 | 1) => {
    if (handoffKind) return;
    if (movingRef.current || pendingRemapRef.current != null) {
      queuedStepsRef.current += dir;
      // 連打が溜まりすぎない（見た目の追従用に最大 ±4）
      if (queuedStepsRef.current > 4) queuedStepsRef.current = 4;
      if (queuedStepsRef.current < -4) queuedStepsRef.current = -4;
      return;
    }
    startSlide(dir);
  };

  const selectCenter = () => {
    if (movingRef.current || pendingRemapRef.current != null) {
      // 選択時は着地を確定してから
      moveGenRef.current += 1;
      x.stop();
      const landed =
        pendingRemapRef.current != null ? pendingRemapRef.current : labelIndexRef.current;
      pendingRemapRef.current = null;
      queuedStepsRef.current = 0;
      displayIndexRef.current = landed;
      labelIndexRef.current = landed;
      movingRef.current = false;
      flushSync(() => {
        setDisplayIndex(landed);
        setLabelIndex(landed);
      });
      onIndexChange(landed);
      x.set(0);
    }
    const kind = SEED_BAGS[displayIndexRef.current]!.id;
    flushSync(() => setHandoffKind(kind));
    onSelect(kind);
  };

  const endPointer = (clientX: number) => {
    const ptr = ptrRef.current;
    ptrRef.current = null;
    if (!ptr) return;

    const dx = clientX - ptr.startClientX;
    if (!ptr.moved && Math.abs(dx) < DRAG_SELECT_SLOP) {
      selectCenter();
      return;
    }

    if (dx < -SLOT * 0.22) {
      slideBy(1);
      return;
    }
    if (dx > SLOT * 0.22) {
      slideBy(-1);
      return;
    }
    void animate(x, 0, SPRING);
  };

  const offsets = [-2, -1, 0, 1, 2] as const;

  return (
    <div className="relative mt-8 flex flex-1 flex-col items-center justify-center">
      <button
        type="button"
        className="absolute left-0 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#3C3C3C] shadow-md active:scale-95"
        onClick={() => slideBy(-1)}
        aria-label={tx("前の袋", "Previous bag")}
      >
        <ChevronLeft />
      </button>

      <div className="relative w-full max-w-[26rem] px-1">
        <div
          className="relative mx-auto h-56 w-full touch-none overflow-x-clip overflow-y-visible"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            if (handoffKind) return;
            // ドラッグ開始時は進行中スライドを即着地
            if (movingRef.current || pendingRemapRef.current != null) {
              moveGenRef.current += 1;
              x.stop();
              const landed =
                pendingRemapRef.current != null ? pendingRemapRef.current : labelIndexRef.current;
              pendingRemapRef.current = null;
              queuedStepsRef.current = 0;
              displayIndexRef.current = landed;
              labelIndexRef.current = landed;
              movingRef.current = false;
              flushSync(() => {
                setDisplayIndex(landed);
                setLabelIndex(landed);
              });
              onIndexChange(landed);
              x.set(0);
            }
            x.stop();
            ptrRef.current = {
              id: e.pointerId,
              startClientX: e.clientX,
              originX: x.get(),
              moved: false,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const ptr = ptrRef.current;
            if (!ptr || ptr.id !== e.pointerId) return;
            const dx = e.clientX - ptr.startClientX;
            if (Math.abs(dx) > DRAG_SELECT_SLOP) ptr.moved = true;
            const nextX = Math.max(-SLOT * 1.15, Math.min(SLOT * 1.15, ptr.originX + dx));
            x.set(nextX);
          }}
          onPointerUp={(e) => {
            if (ptrRef.current?.id !== e.pointerId) return;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            endPointer(e.clientX);
          }}
          onPointerCancel={(e) => {
            if (ptrRef.current?.id !== e.pointerId) return;
            ptrRef.current = null;
            void animate(x, 0, SPRING);
          }}
        >
          <motion.div
            className="relative mx-auto flex h-56 w-full items-center justify-center"
            style={{ x }}
            role="listbox"
            aria-label={tx("種袋", "Seed bags")}
            aria-activedescendant={`seed-bag-${bag.id}`}
          >
            {offsets.map((off) => {
              const meta = SEED_BAGS[wrap(displayIndex + off)]!;
              return (
                <BagSlot
                  key={off}
                  off={off}
                  kind={meta.id}
                  x={x}
                  handoff={handoffKind === meta.id}
                  label={locale === "en" ? meta.labelEn : meta.labelJa}
                />
              );
            })}
          </motion.div>
          <button
            type="button"
            id={`seed-bag-${bag.id}`}
            className="sr-only"
            onClick={() => selectCenter()}
          >
            {tx(`${locale === "en" ? bag.labelEn : bag.labelJa}を選ぶ`, `Select ${bag.labelEn}`)}
          </button>
        </div>
      </div>

      <button
        type="button"
        className="absolute right-0 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#3C3C3C] shadow-md active:scale-95"
        onClick={() => slideBy(1)}
        aria-label={tx("次の袋", "Next bag")}
      >
        <ChevronRight />
      </button>

      <p className="mt-3 text-center text-[16px] font-extrabold text-[#3C3C3C]">
        {locale === "en" ? bag.labelEn : bag.labelJa}
      </p>
    </div>
  );
}
