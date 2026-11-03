"use client";

import { useState } from "react";
import { animate, motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SeedBagArt } from "@/components/idea-garden/illustrations/SeedBagArt";
import { SEED_BAGS } from "@/lib/idea-garden/seedBags";
import type { FlowerKind } from "@/lib/idea-garden/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** スロット間隔。横の袋が途切れない幅に */
const SLOT = 152;

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
  busy,
  onSelect,
  label,
}: {
  off: number;
  kind: FlowerKind;
  x: MotionValue<number>;
  busy: boolean;
  onSelect: () => void;
  label: string;
}) {
  // スライド中から中央距離に応じて拡大／縮小
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

  return (
    <div
      className="absolute flex shrink-0 items-center justify-center"
      style={{
        width: SLOT,
        transform: `translateX(${off * SLOT}px)`,
      }}
    >
      <motion.div style={{ scale, opacity }} className="flex origin-center items-center justify-center">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (Math.abs(off * SLOT + x.get()) < SLOT * 0.45) onSelect();
          }}
          className="relative z-10 shrink-0 outline-none transition active:scale-95 disabled:pointer-events-none"
          aria-label={label}
        >
          <SeedBagArt kind={kind} selected className="h-56 w-44" />
        </button>
      </motion.div>
    </div>
  );
}

/** 種袋カルーセル — スライド中から中央は大きく・外れは小さく */
export function SeedBagCarousel({ index, onIndexChange, onSelect }: Props) {
  const { tx, locale } = useI18n();
  const x = useMotionValue(0);
  const [busy, setBusy] = useState(false);
  const bag = SEED_BAGS[index]!;

  const slide = (dir: -1 | 1) => {
    if (busy) return;
    setBusy(true);
    const target = -dir * SLOT;
    void animate(x, target, {
      type: "spring",
      stiffness: 320,
      damping: 34,
      mass: 0.75,
    }).then(() => {
      onIndexChange(wrap(index + dir));
      x.set(0);
      setBusy(false);
    });
  };

  const offsets = [-2, -1, 0, 1, 2] as const;

  return (
    <div className="relative mt-8 flex flex-1 flex-col items-center justify-center">
      <button
        type="button"
        disabled={busy}
        className="absolute left-0 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md disabled:opacity-50"
        onClick={() => slide(-1)}
        aria-label={tx("前の袋", "Previous bag")}
      >
        <ChevronLeft />
      </button>

      <div className="relative w-full max-w-[26rem] px-1">
        <div className="relative mx-auto h-56 w-full overflow-x-clip overflow-y-visible">
          <motion.div
            className="relative mx-auto flex h-56 w-full items-center justify-center"
            style={{ x }}
          >
            {offsets.map((off) => {
              const meta = SEED_BAGS[wrap(index + off)]!;
              return (
                <BagSlot
                  key={off}
                  off={off}
                  kind={meta.id}
                  x={x}
                  busy={busy}
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
        disabled={busy}
        className="absolute right-0 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md disabled:opacity-50"
        onClick={() => slide(1)}
        aria-label={tx("次の袋", "Next bag")}
      >
        <ChevronRight />
      </button>

      <motion.p
        key={bag.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="mt-3 text-center text-[16px] font-extrabold text-[#3C3C3C]"
      >
        {locale === "en" ? bag.labelEn : bag.labelJa}
      </motion.p>
    </div>
  );
}
