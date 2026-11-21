"use client";

import { PixelSprite } from "@/components/office/visual/PixelSprite";
import { MOCK_SHOP, MOCK_TERM } from "@/components/office/visual/mockData";
import { SPRITE_SECRETARY } from "@/components/office/visual/sprites";

type Props = {
  onNext: () => void;
};

export function CoachScreen({ onNext }: Props) {
  return (
    <div className="space-y-3">
      <div className="ov-panel p-4">
        <div className="flex gap-3">
          <PixelSprite {...SPRITE_SECRETARY} scale={6} title="秘書" />
          <div className="min-w-0 flex-1">
            <p className="ov-title text-sm text-[var(--ov-gold)]">秘書</p>
            <div
              className="mt-2 rounded-2xl px-3 py-2 text-sm leading-relaxed"
              style={{ background: "rgba(255,244,220,0.08)", border: "1px solid var(--ov-border)" }}
            >
              待ちを整えると回転が上がるよ。客数と単価、両方を見るのがコツ。
            </div>
          </div>
        </div>
      </div>

      <div className="ov-panel p-4">
        <div className="flex items-center gap-2">
          <p className="ov-title text-sm text-[var(--ov-mint)]">{MOCK_TERM.name}</p>
          <span className="rounded-md bg-[var(--ov-accent)] px-1.5 py-0.5 text-[10px] font-black text-[#1a1220]">
            NEW
          </span>
        </div>
        <p className="ov-muted mt-2">{MOCK_TERM.shortDesc}</p>
        <p className="ov-num mt-2 text-xs text-[var(--ov-gold)]">{MOCK_TERM.formula}</p>
      </div>

      <div className="ov-panel p-4">
        <p className="ov-title text-sm text-[var(--ov-gold)]">仕入れ（見た目）</p>
        <ul className="mt-3 space-y-2">
          {MOCK_SHOP.cards.map((c) => (
            <li
              key={c.id}
              className="ov-card-paper flex min-h-[44px] items-center justify-between gap-2 px-3 py-2"
            >
              <span>
                <span className="block text-sm font-bold">{c.name}</span>
                <span className="block text-xs opacity-80">{c.blurb}</span>
              </span>
              <span className="ov-num text-sm font-bold">{c.price}</span>
            </li>
          ))}
          <li className="ov-card-paper flex min-h-[44px] items-center justify-between gap-2 px-3 py-2">
            <span>
              <span className="block text-sm font-bold">{MOCK_SHOP.employee.name}</span>
              <span className="block text-xs opacity-80">{MOCK_SHOP.employee.blurb}</span>
            </span>
            <span className="ov-num text-sm font-bold">{MOCK_SHOP.employee.price}</span>
          </li>
        </ul>
      </div>

      <button type="button" className="ov-btn" onClick={onNext}>
        次の営業日へ
      </button>
    </div>
  );
}
