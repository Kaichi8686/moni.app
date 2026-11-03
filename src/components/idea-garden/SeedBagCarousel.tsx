"use client";

import { useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SeedBagArt } from "@/components/idea-garden/illustrations/SeedBagArt";
import { SEED_BAGS } from "@/lib/idea-garden/seedBags";
import type { FlowerKind } from "@/lib/idea-garden/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** 中央スロット幅（袋 + 余白）。スライド量に使う */
const SLOT = 176;

type Props = {
  index: number;
  onIndexChange: (next: number) => void;
  onSelect: (kind: FlowerKind) => void;
};

function wrap(i: number) {
  const n = SEED_BAGS.length;
  return ((i % n) + n) % n;
}

/** 種袋カルーセル — 矢印でぬるっと流れる */
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
      stiffness: 280,
      damping: 32,
      mass: 0.85,
    }).then(() => {
      onIndexChange(wrap(index + dir));
      x.set(0);
      setBusy(false);
    });
  };

  // 中央前後を多めに描画して、スライド中も途切れないようにする
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

      <div className="relative w-full max-w-[22rem] overflow-hidden">
        <motion.div
          className="relative mx-auto flex h-56 w-full items-center justify-center"
          style={{ x }}
        >
          {offsets.map((off) => {
            const kind = SEED_BAGS[wrap(index + off)]!.id;
            const isCenter = off === 0;
            const far = Math.abs(off) >= 2;
            return (
              <div
                key={off}
                className="absolute flex shrink-0 items-center justify-center"
                style={{
                  width: SLOT,
                  transform: `translateX(${off * SLOT}px)`,
                }}
              >
                {isCenter ? (
                  <motion.button
                    type="button"
                    whileTap={busy ? undefined : { scale: 0.96 }}
                    disabled={busy}
                    onClick={() => onSelect(kind)}
                    className="relative z-10 shrink-0 outline-none"
                    aria-label={
                      locale === "en"
                        ? SEED_BAGS[wrap(index)]!.labelEn
                        : SEED_BAGS[wrap(index)]!.labelJa
                    }
                  >
                    <SeedBagArt kind={kind} selected className="h-56 w-44" />
                  </motion.button>
                ) : (
                  <SeedBagArt
                    kind={kind}
                    className={`h-36 w-28 shrink-0 scale-90 ${far ? "opacity-0" : "opacity-40"}`}
                  />
                )}
              </div>
            );
          })}
        </motion.div>
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
        transition={{ duration: 0.22 }}
        className="mt-3 text-center text-[16px] font-extrabold text-[#3C3C3C]"
      >
        {locale === "en" ? bag.labelEn : bag.labelJa}
      </motion.p>
    </div>
  );
}
