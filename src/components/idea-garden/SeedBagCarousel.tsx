"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
  type PanInfo,
} from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SeedBagArt } from "@/components/idea-garden/illustrations/SeedBagArt";
import { SEED_BAGS } from "@/lib/idea-garden/seedBags";
import type { FlowerKind } from "@/lib/idea-garden/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** スロット間隔。横の袋が途切れない幅に */
const SLOT = 152;
const SPRING = { type: "spring" as const, stiffness: 380, damping: 36, mass: 0.7 };

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
  onSelect,
  label,
}: {
  off: number;
  kind: FlowerKind;
  x: MotionValue<number>;
  onSelect: () => void;
  label: string;
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
      className="absolute flex shrink-0 items-center justify-center"
      style={{
        width: SLOT,
        transform: `translateX(${off * SLOT}px)`,
      }}
    >
      <motion.div style={{ scale, opacity }} className="flex origin-center items-center justify-center">
        <motion.button
          type="button"
          onClick={() => {
            if (Math.abs(off * SLOT + x.get()) < SLOT * 0.45) onSelect();
          }}
          className="relative z-10 shrink-0 outline-none"
          aria-label={label}
          whileTap={isCenter ? { scale: 1.04 } : undefined}
        >
          <motion.div
            layoutId={isCenter ? `idea-seed-bag-${kind}` : undefined}
            transition={{ type: "spring", stiffness: 220, damping: 24, mass: 0.95 }}
            className="flex items-center justify-center"
          >
            <SeedBagArt kind={kind} selected className="h-56 w-44" />
          </motion.div>
        </motion.button>
      </motion.div>
    </div>
  );
}

/** 種袋カルーセル — 矢印連打可・名前即時・指スワイプ */
export function SeedBagCarousel({ index, onIndexChange, onSelect }: Props) {
  const { tx, locale } = useI18n();
  const x = useMotionValue(0);
  const [displayIndex, setDisplayIndex] = useState(index);
  const displayIndexRef = useRef(displayIndex);
  displayIndexRef.current = displayIndex;

  useEffect(() => {
    setDisplayIndex(index);
  }, [index]);

  const bag = SEED_BAGS[displayIndex]!;

  /** インデックスを先に更新 → 名前即時反映。矢印はロックしない */
  const slide = (dir: -1 | 1) => {
    const from = displayIndexRef.current;
    const next = wrap(from + dir);
    displayIndexRef.current = next;
    setDisplayIndex(next);
    onIndexChange(next);
    x.stop();
    // 新中央が dir 側から入ってくるように、一度ずらしてから 0 へ
    x.set(dir * SLOT);
    void animate(x, 0, SPRING);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const dx = info.offset.x;
    const vx = info.velocity.x;
    if (dx < -SLOT * 0.22 || vx < -450) {
      // 左へフリック → 次の袋。ドラッグ中の x を補正してから着地
      const next = wrap(displayIndexRef.current + 1);
      displayIndexRef.current = next;
      setDisplayIndex(next);
      onIndexChange(next);
      x.stop();
      x.set(x.get() + SLOT);
      void animate(x, 0, SPRING);
      return;
    }
    if (dx > SLOT * 0.22 || vx > 450) {
      const next = wrap(displayIndexRef.current - 1);
      displayIndexRef.current = next;
      setDisplayIndex(next);
      onIndexChange(next);
      x.stop();
      x.set(x.get() - SLOT);
      void animate(x, 0, SPRING);
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
        <div className="relative mx-auto h-56 w-full touch-pan-y overflow-x-clip overflow-y-visible">
          <motion.div
            className="relative mx-auto flex h-56 w-full cursor-grab items-center justify-center active:cursor-grabbing"
            style={{ x }}
            drag="x"
            dragConstraints={{ left: -SLOT, right: SLOT }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
          >
            {offsets.map((off) => {
              const meta = SEED_BAGS[wrap(displayIndex + off)]!;
              return (
                <BagSlot
                  key={off}
                  off={off}
                  kind={meta.id}
                  x={x}
                  onSelect={() => onSelect(meta.id)}
                  label={locale === "en" ? meta.labelEn : meta.labelJa}
                />
              );
            })}
          </motion.div>
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

      {/* 花が変わったらすぐ名前も更新（フェード待ちなし） */}
      <p className="mt-3 text-center text-[16px] font-extrabold text-[#3C3C3C]">
        {locale === "en" ? bag.labelEn : bag.labelJa}
      </p>
    </div>
  );
}
