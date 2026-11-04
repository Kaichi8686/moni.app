"use client";

import { motion, useAnimation } from "framer-motion";
import { ChevronUp, ExternalLink, Map, ImageIcon } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import type { ContestIdea } from "@/lib/contest/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  idea: ContestIdea;
  onOpen: (idea: ContestIdea) => void;
  onToggleLike: (idea: ContestIdea) => Promise<void> | void;
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

function previewText(content: string, max = 110): string {
  const plain = content.replace(/[*_#>`\[\]()]/g, "").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trim()}…`;
}

export function IdeaCard({ idea, onOpen, onToggleLike, disabledLike }: Props) {
  const { tx, locale } = useI18n();
  const controls = useAnimation();
  const [busy, setBusy] = useState(false);

  async function handleLike(e: MouseEvent) {
    e.stopPropagation();
    if (busy || disabledLike) return;
    setBusy(true);
    try {
      await controls.start({ y: [0, -4, 0], scale: [1, 1.15, 1], transition: { duration: 0.28 } });
      await onToggleLike(idea);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(idea)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(idea);
        }
      }}
      className="flex cursor-pointer gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 transition hover:border-zinc-300 active:bg-zinc-50/80 sm:gap-4 sm:p-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <MemberAvatarBubble
            userId={idea.author.id}
            name={idea.author.displayName}
            avatarUrl={idea.author.avatarUrl}
            size="sm"
            className="!h-8 !w-8 !text-xs"
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-zinc-900">{idea.author.displayName}</p>
            <p className="text-[11px] text-zinc-400">{formatPostedAt(idea.createdAt, locale)}</p>
          </div>
        </div>

        <h3 className="mt-2.5 text-[15px] font-semibold leading-snug tracking-tight text-zinc-950">{idea.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-zinc-600">{previewText(idea.content)}</p>

        {idea.appeal ? (
          <p className="mt-2 text-[12px] font-medium text-zinc-500">
            <span className="text-zinc-400">“</span>
            {idea.appeal}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {idea.imageUrl ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
              <ImageIcon className="h-3 w-3" aria-hidden />
              {tx("画像", "Image")}
            </span>
          ) : null}
          {idea.roadmap ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
              <Map className="h-3 w-3" aria-hidden />
              {tx("ロードマップ", "Roadmap")}
            </span>
          ) : null}
          {idea.externalUrl ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
              <ExternalLink className="h-3 w-3" aria-hidden />
              Link
            </span>
          ) : null}
        </div>

        {idea.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={idea.imageUrl}
            alt=""
            className="mt-3 h-28 w-full rounded-xl border border-zinc-200 object-cover"
          />
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-center justify-start pt-0.5">
        <button
          type="button"
          onClick={(e) => void handleLike(e)}
          disabled={busy || disabledLike}
          aria-pressed={idea.likedByMe}
          aria-label={tx("共感した", "Upvote")}
          className={`flex w-11 flex-col items-center gap-0.5 rounded-xl border px-1.5 py-2 transition active:scale-95 disabled:opacity-50 ${
            idea.likedByMe
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
          }`}
        >
          <motion.span animate={controls} className="inline-flex">
            <ChevronUp className={`h-4 w-4 ${idea.likedByMe ? "stroke-[2.5]" : ""}`} aria-hidden />
          </motion.span>
          <span className="text-[12px] font-semibold tabular-nums leading-none">{idea.likeCount}</span>
        </button>
      </div>
    </article>
  );
}
