"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { normalizeTagList } from "@/lib/profile/skillsTraits";

export type ChipOption = { id: string; label: string };

type Props = {
  presets: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  className?: string;
};

export function TagChipPicker({ presets, value, onChange, max = 12, className = "" }: Props) {
  const { tx } = useI18n();
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState("");

  const selected = new Set(value);
  const presetIds = new Set(presets.map((p) => p.id));
  const customSelected = value.filter((id) => !presetIds.has(id));
  const labelOf = (id: string) => presets.find((p) => p.id === id)?.label ?? id;

  function toggle(id: string) {
    if (selected.has(id)) {
      onChange(value.filter((t) => t !== id));
      return;
    }
    if (value.length >= max) return;
    onChange(normalizeTagList([...value, id], max));
  }

  function addCustom() {
    const t = customDraft.trim();
    if (!t) return;
    if (!selected.has(t) && value.length < max) {
      onChange(normalizeTagList([...value, t], max));
    }
    setCustomDraft("");
    setCustomOpen(false);
  }

  const chipBase =
    "inline-flex min-h-[36px] touch-manipulation items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition active:scale-[0.97]";
  const chipOn = `${chipBase} border-transparent bg-[var(--color-accent,#5b21b6)] text-white shadow-sm`;
  const chipOff = `${chipBase} border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500`;

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {presets.map((opt) => {
          const on = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(opt.id)}
              className={on ? chipOn : chipOff}
            >
              {opt.label}
            </button>
          );
        })}
        {customSelected.map((id) => (
          <button
            key={`custom-${id}`}
            type="button"
            aria-pressed
            onClick={() => toggle(id)}
            className={chipOn}
            title={tx("タップで解除", "Tap to remove")}
          >
            {labelOf(id)}
          </button>
        ))}
        {!customOpen ? (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className={`${chipOff} border-dashed`}
            disabled={value.length >= max}
          >
            {tx("+ 自由入力で追加", "+ Add your own")}
          </button>
        ) : (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <input
              autoFocus
              className="min-h-[36px] min-w-[10rem] flex-1 rounded-full border border-zinc-300 bg-white px-3 text-[13px] outline-none ring-[var(--color-accent,#5b21b6)] focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder={tx("タグを入力", "Enter a tag")}
              value={customDraft}
              maxLength={32}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
                if (e.key === "Escape") {
                  setCustomOpen(false);
                  setCustomDraft("");
                }
              }}
            />
            <button
              type="button"
              onClick={addCustom}
              className="inline-flex min-h-[36px] items-center rounded-full bg-zinc-900 px-3 text-[12px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {tx("追加", "Add")}
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomOpen(false);
                setCustomDraft("");
              }}
              className="text-[12px] font-medium text-zinc-500"
            >
              {tx("キャンセル", "Cancel")}
            </button>
          </div>
        )}
      </div>
      {value.length >= max ? (
        <p className="mt-2 text-[11px] text-zinc-400">{tx(`選択は最大${max}件です`, `Up to ${max} tags`)}</p>
      ) : null}
    </div>
  );
}
