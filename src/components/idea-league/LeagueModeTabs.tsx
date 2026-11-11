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
          ["league", tx("リーグ戦", "League"), "league"],
          ["friend", tx("フレンドマッチ", "Friend Match"), "friend"],
        ] as const
      ).map(([id, label, kind]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          onClick={() => onChange(id)}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${
            mode === id
              ? kind === "friend"
                ? "bg-teal-700 text-white"
                : "bg-zinc-900 text-white"
              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
          }`}
        >
          {kind === "league" ? <CupIcon active={mode === id} /> : <DuelIcon active={mode === id} />}
          {label}
        </button>
      ))}
    </div>
  );
}

function CupIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className={active ? "opacity-95" : "opacity-70"}>
      <path
        d="M8 4h8v3a4 4 0 01-8 0V4zM7 4H5.5A2.5 2.5 0 008 6.5M17 4h1.5A2.5 2.5 0 0116 6.5M10 14h4v2.5a1 1 0 01-1 1h-2a1 1 0 01-1-1V14zM9 19h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DuelIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className={active ? "opacity-95" : "opacity-70"}>
      <path
        d="M5 5l5.5 5.5M13.5 13.5L19 19M19 5l-5.5 5.5M10.5 13.5L5 19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
