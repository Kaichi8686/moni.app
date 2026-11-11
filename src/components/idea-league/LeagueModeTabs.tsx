"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

export type LeaguePlayMode = "league" | "friend";

type Props = {
  mode: LeaguePlayMode;
  onChange: (mode: LeaguePlayMode) => void;
};

export function LeagueModeTabs({ mode, onChange }: Props) {
  const { tx } = useI18n();

  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-2xl border border-zinc-200/90 bg-white p-1"
      role="tablist"
      aria-label={tx("対戦モード", "Play mode")}
    >
      {(
        [
          ["league", tx("🏆 リーグ戦", "🏆 League")],
          ["friend", tx("⚔️ フレンドマッチ", "⚔️ Friend Match")],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          onClick={() => onChange(id)}
          className={`min-h-11 rounded-xl text-sm font-semibold transition ${
            mode === id
              ? "bg-zinc-900 text-white"
              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
