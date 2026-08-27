"use client";

import { USER_SITUATION_OPTIONS, type UserSituation } from "@/lib/projects/userSituation";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  value: UserSituation | null;
  onChange: (value: UserSituation) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function UserSituationPicker({ value, onChange, disabled, compact }: Props) {
  const { tx } = useI18n();
  const enLabel: Record<UserSituation, string> = {
    festival: "School festival, club, or school events",
    study: "Classes, inquiry, or reports",
    startup: "Startup, pitch contests, or apps",
    community: "Local activity or volunteering",
    unclear: "Not sure yet — I just want to start",
  };
  return (
    <div className="space-y-2">
      {!compact ? (
        <p className="text-sm font-semibold text-[#1A1A1A]" style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}>
          {tx("あなたの今の状況は？（1つ選んでください）", "Where are you now? (pick one)")}
        </p>
      ) : null}
      <div className="grid gap-2">
        {USER_SITUATION_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.key)}
            className={`flex min-h-[44px] w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition duration-200 ease-out disabled:opacity-50 ${
              value === opt.key
                ? "border-[#FF5C35] bg-[#FFF3D6] text-[#1A1A1A] ring-2 ring-[#FF5C35]/20"
                : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
            }`}
            style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}
          >
            <span className="text-lg leading-none" aria-hidden>
              {opt.emoji}
            </span>
            <span>{tx(opt.label, enLabel[opt.key])}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
