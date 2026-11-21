"use client";

import { PixelSprite } from "@/components/office/visual/PixelSprite";
import {
  SPRITE_BANG,
  SPRITE_CUSTOMERS,
  SPRITE_SHOP,
  SPRITE_STAFF,
} from "@/components/office/visual/sprites";

type Props = {
  title: string;
};

/** 店外観＋行列。スプライトは固定スケール（6px/ドット） */
export function CafeStage({ title }: Props) {
  return (
    <div className="ov-panel overflow-hidden p-3">
      <div className="relative flex flex-col items-center gap-2">
        <div className="absolute right-2 top-2 z-10">
          <PixelSprite {...SPRITE_BANG} scale={6} title="注目" />
        </div>
        <PixelSprite {...SPRITE_SHOP} scale={6} title="夜のカフェ" />
        <div className="flex items-end justify-center gap-1 pt-1">
          {SPRITE_CUSTOMERS.map((c, i) => (
            <PixelSprite key={i} {...c} scale={6} title={`客${i + 1}`} />
          ))}
          <div className="ml-2">
            <PixelSprite {...SPRITE_STAFF} scale={6} title="店員" />
          </div>
        </div>
      </div>
      <p className="ov-title mt-3 text-center text-base text-[var(--ov-gold)]">{title}</p>
    </div>
  );
}
