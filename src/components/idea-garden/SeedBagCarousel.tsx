"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SeedBagArt } from "@/components/idea-garden/illustrations/SeedBagArt";
import { SEED_BAGS } from "@/lib/idea-garden/seedBags";
import type { FlowerKind } from "@/lib/idea-garden/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** スロット間隔。横の袋が途切れない幅に */
const SLOT = 152;
const SPRING = { type: "spring" as const, stiffness: 380, damping: 36, mass: 0.7 };
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
  shareLayout,
}: {
  off: number;
  kind: FlowerKind;
  x: MotionValue<number>;
  label: string;
  shareLayout: boolean;
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
            layoutId={shareLayout && isCenter ? `idea-seed-bag-${kind}` : undefined}
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

/** 種袋カルーセル — 指スワイプは一方向着地、誤付け替えなし */
export function SeedBagCarousel({ index, onIndexChange, onSelect }: Props) {
  const { tx, locale } = useI18n();
  const x = useMotionValue(0);
  const [displayIndex, setDisplayIndex] = useState(index);
  const [labelIndex, setLabelIndex] = useState(index);
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);

  const displayIndexRef = useRef(displayIndex);
  displayIndexRef.current = displayIndex;
  const settlingRef = useRef(false);
  const pendingRemapRef = useRef<number | null>(null);

  const ptrRef = useRef<{
    id: number;
    startClientX: number;
    originX: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (settlingRef.current || pendingRemapRef.current != null) return;
    setDisplayIndex(index);
    setLabelIndex(index);
  }, [index]);

  useLayoutEffect(() => {
    if (pendingRemapRef.current == null) return;
    if (pendingRemapRef.current !== displayIndex) return;
    x.set(0);
    pendingRemapRef.current = null;
    settlingRef.current = false;
    setSettling(false);
  }, [displayIndex, x]);

  const bag = SEED_BAGS[labelIndex]!;
  const shareLayout = !dragging && !settling;

  const slide = (dir: -1 | 1) => {
    if (settlingRef.current || pendingRemapRef.current != null) {
      x.stop();
      settlingRef.current = false;
      pendingRemapRef.current = null;
      setSettling(false);
    }
    const next = wrap(displayIndexRef.current + dir);
    displayIndexRef.current = next;
    setDisplayIndex(next);
    setLabelIndex(next);
    onIndexChange(next);
    x.stop();
    x.set(dir * SLOT);
    void animate(x, 0, SPRING);
  };

  const settleSwipe = (dir: -1 | 1) => {
    const next = wrap(displayIndexRef.current + dir);
    setLabelIndex(next);
    settlingRef.current = true;
    setSettling(true);
    x.stop();
    void animate(x, -dir * SLOT, SPRING).then(() => {
      displayIndexRef.current = next;
      pendingRemapRef.current = next;
      setDisplayIndex(next);
      onIndexChange(next);
    });
  };

  const endPointer = (clientX: number) => {
    const ptr = ptrRef.current;
    ptrRef.current = null;
    if (!ptr) return;
    setDragging(false);

    const dx = clientX - ptr.startClientX;
    if (!ptr.moved && Math.abs(dx) < DRAG_SELECT_SLOP) {
      // タップ = 中央の袋を選ぶ
      const kind = SEED_BAGS[displayIndexRef.current]!.id;
      onSelect(kind);
      void animate(x, 0, SPRING);
      return;
    }

    if (dx < -SLOT * 0.22) {
      settleSwipe(1);
      return;
    }
    if (dx > SLOT * 0.22) {
      settleSwipe(-1);
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
        onClick={() => slide(-1)}
        aria-label={tx("前の袋", "Previous bag")}
      >
        <ChevronLeft />
      </button>

      <div className="relative w-full max-w-[26rem] px-1">
        <div
          className="relative mx-auto h-56 w-full touch-none overflow-x-clip overflow-y-visible"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            if (settlingRef.current) return;
            x.stop();
            ptrRef.current = {
              id: e.pointerId,
              startClientX: e.clientX,
              originX: x.get(),
              moved: false,
            };
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const ptr = ptrRef.current;
            if (!ptr || ptr.id !== e.pointerId) return;
            const dx = e.clientX - ptr.startClientX;
            if (Math.abs(dx) > DRAG_SELECT_SLOP) ptr.moved = true;
            // 引きすぎ防止
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
            setDragging(false);
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
                  shareLayout={shareLayout}
                  label={locale === "en" ? meta.labelEn : meta.labelJa}
                />
              );
            })}
          </motion.div>
          <button
            type="button"
            id={`seed-bag-${bag.id}`}
            className="sr-only"
            onClick={() => onSelect(bag.id)}
          >
            {tx(`${locale === "en" ? bag.labelEn : bag.labelJa}を選ぶ`, `Select ${bag.labelEn}`)}
          </button>
        </div>
      </div>

      <button
        type="button"
        className="absolute right-0 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#3C3C3C] shadow-md active:scale-95"
        onClick={() => slide(1)}
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
