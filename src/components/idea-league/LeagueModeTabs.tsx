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
      className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1"
      role="tablist"
      aria-label={tx("対戦モード", "Play mode")}
    >
      {(
        [
          ["league", tx("リーグ戦", "League")],
          ["friend", tx("フレンドマッチ", "Friends")],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          onClick={() => onChange(id)}
          className={`min-h-10 rounded-lg text-sm font-semibold transition ${
            mode === id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
