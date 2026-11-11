"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  onStart?: () => void;
  compact?: boolean;
};

/** Quiet one-liner — not a marketing card. */
export function HowToEarnPoints({ onStart }: Props) {
  const { tx } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-3">
      <p className="text-[13px] text-zinc-600">
        {tx(
          "お題に提出 → その場でpt → 12ptで昇格。毎日11時に更新。",
          "Submit → instant pt → 12pt promotes. Resets daily at 11:00.",
        )}
      </p>
      {onStart ? (
        <button
          type="button"
          onClick={onStart}
          className="shrink-0 text-[13px] font-semibold text-zinc-900 underline-offset-2 hover:underline"
        >
          {tx("提出する", "Submit")}
        </button>
      ) : null}
    </div>
  );
}
