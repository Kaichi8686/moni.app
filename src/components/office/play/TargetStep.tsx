"use client";

import { DuoButton } from "@/components/idea-garden/DuoButton";
import { TargetAvatar } from "@/components/office/play/TargetAvatar";
import { OFFICE_TARGET_OTHER_MAX } from "@/lib/office/constants";
import type { IncidentTargetPublic } from "@/lib/office/types";

type Props = {
  targets: IncidentTargetPublic[];
  selectedIds: string[];
  otherText: string;
  onToggle: (id: string) => void;
  onOtherText: (text: string) => void;
  onConfirm: () => void;
};

export function TargetStep({
  targets,
  selectedIds,
  otherText,
  onToggle,
  onOtherText,
  onConfirm,
}: Props) {
  const hasOther = selectedIds.includes("other");
  const otherOk =
    !hasOther ||
    (otherText.trim().length >= 1 && otherText.trim().length <= OFFICE_TARGET_OTHER_MAX);
  const showConfirm = selectedIds.length === 1 && otherOk;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-black text-zinc-900">お客さんを選ぶ</h3>
        <p className="text-xs tabular-nums text-zinc-400">{selectedIds.length}/2</p>
      </div>
      <p className="text-sm text-zinc-500">最大2人まで。2人選ぶと次へ進むよ。</p>

      <div className="grid grid-cols-2 gap-3">
        {targets.map((t) => {
          const on = selectedIds.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              className={`rounded-2xl border px-3 py-3 text-center transition duration-300 ${
                on
                  ? "-translate-y-0.5 border-[#FF9600] bg-[#FFF7E8] shadow-md"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              }`}
            >
              <TargetAvatar seed={t.id + t.label} selected={on} />
              <p className="mt-2 text-sm font-bold leading-snug text-zinc-800">{t.label}</p>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onToggle("other")}
          className={`rounded-2xl border px-3 py-3 text-center transition duration-300 ${
            hasOther
              ? "-translate-y-0.5 border-[#FF9600] bg-[#FFF7E8] shadow-md"
              : "border-dashed border-zinc-300 bg-zinc-50 hover:border-zinc-400"
          }`}
        >
          <TargetAvatar seed="other" selected={hasOther} />
          <p className="mt-2 text-sm font-bold text-zinc-800">その他</p>
        </button>
      </div>

      {hasOther ? (
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-600">どんなお客さん？</span>
          <input
            value={otherText}
            onChange={(e) => onOtherText(e.target.value.slice(0, OFFICE_TARGET_OTHER_MAX))}
            className="w-full rounded-2xl border border-zinc-200 px-3.5 py-3 text-sm outline-none ring-[#FF9600] focus:ring-2"
            placeholder="例：近所の中学生"
            maxLength={OFFICE_TARGET_OTHER_MAX}
          />
          <span className="mt-1 block text-right text-[11px] tabular-nums text-zinc-400">
            {otherText.length}/{OFFICE_TARGET_OTHER_MAX}
          </span>
        </label>
      ) : null}

      {showConfirm ? (
        <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={onConfirm}>
          決定
        </DuoButton>
      ) : null}
    </div>
  );
}
