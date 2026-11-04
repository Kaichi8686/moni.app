"use client";

import { motion, useAnimation } from "framer-motion";
import { Heart } from "lucide-react";
import { useState } from "react";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import type { ContestEntry } from "@/lib/contest/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  entry: ContestEntry;
  onToggleLike: (entry: ContestEntry) => Promise<void> | void;
  disabledLike?: boolean;
};

function formatPostedAt(iso: string, locale: "ja" | "en"): string {
  const d = new Date(iso);
  return d.toLocaleString(locale === "en" ? "en-US" : "ja-JP", {
    month: locale === "en" ? "short" : "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContestEntryCard({ entry, onToggleLike, disabledLike }: Props) {
  const { tx, locale } = useI18n();
  const controls = useAnimation();
  const [busy, setBusy] = useState(false);
  const steps = entry.roadmap.steps.slice(0, 4);

  async function handleLike() {
    if (busy || disabledLike) return;
    setBusy(true);
    try {
      await controls.start({ scale: [1, 1.35, 1], transition: { duration: 0.28 } });
      await onToggleLike(entry);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[var(--shadow-sm)] transition hover:border-zinc-300/90">
      <div className="flex items-center gap-2.5">
        <MemberAvatarBubble
          userId={entry.author.id}
          name={entry.author.displayName}
          avatarUrl={entry.author.avatarUrl}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900">{entry.author.displayName}</p>
          <p className="text-[11px] text-zinc-400">{formatPostedAt(entry.createdAt, locale)}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleLike()}
          disabled={busy || disabledLike}
          aria-pressed={entry.likedByMe}
          aria-label={tx("いいね", "Like")}
          className={`inline-flex min-h-10 min-w-[3.25rem] items-center justify-center gap-1 rounded-xl px-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${
            entry.likedByMe
              ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
              : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100"
          }`}
        >
          <motion.span animate={controls} className="inline-flex">
            <Heart className={`h-4 w-4 ${entry.likedByMe ? "fill-current" : ""}`} aria-hidden />
          </motion.span>
          <span className="tabular-nums">{entry.likeCount}</span>
        </button>
      </div>

      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-zinc-950">{entry.roadmap.title}</h3>

      {entry.comment ? (
        <blockquote className="mt-2 rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-2 text-sm leading-relaxed text-orange-950/80">
          <span className="mr-1 text-orange-400" aria-hidden>
            “
          </span>
          {entry.comment}
        </blockquote>
      ) : null}

      <ol className="mt-3 space-y-2">
        {steps.map((step, i) => (
          <li key={`${entry.id}-${i}`} className="flex gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#FFF3D6] text-[10px] font-bold text-[#C2410C]">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug text-zinc-800">{step.title}</p>
              {step.detail ? <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{step.detail}</p> : null}
            </div>
          </li>
        ))}
        {entry.roadmap.steps.length > steps.length ? (
          <li className="pl-7 text-[11px] font-medium text-zinc-400">
            {tx(`ほか ${entry.roadmap.steps.length - steps.length} ステップ`, `+${entry.roadmap.steps.length - steps.length} more`)}
          </li>
        ) : null}
      </ol>
    </article>
  );
}
