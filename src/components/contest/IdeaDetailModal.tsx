"use client";

import { ChevronUp, ExternalLink, Map, X } from "lucide-react";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import type { ContestIdea } from "@/lib/contest/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  idea: ContestIdea | null;
  onClose: () => void;
  onToggleLike: (idea: ContestIdea) => Promise<void> | void;
  canLike?: boolean;
};

function formatPostedAt(iso: string, locale: "ja" | "en"): string {
  return new Date(iso).toLocaleString(locale === "en" ? "en-US" : "ja-JP", {
    year: "numeric",
    month: locale === "en" ? "short" : "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ごく軽い Markdown 風表示（見出し・太字・改行） */
function renderContent(content: string) {
  return content.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;
    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={i} className="mt-3 text-sm font-semibold text-zinc-900">
          {trimmed.slice(4)}
        </h4>
      );
    }
    if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
      return (
        <h3 key={i} className="mt-3 text-base font-semibold text-zinc-950">
          {trimmed.replace(/^#+\s*/, "")}
        </h3>
      );
    }
    const html = trimmed
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
    return (
      <p
        key={i}
        className="text-sm leading-relaxed text-zinc-700"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  });
}

export function IdeaDetailModal({ idea, onClose, onToggleLike, canLike = true }: Props) {
  const { tx, locale } = useI18n();
  if (!idea) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idea-detail-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2.5">
            <MemberAvatarBubble
              userId={idea.author.id}
              name={idea.author.displayName}
              avatarUrl={idea.author.avatarUrl}
              size="sm"
              className="!h-9 !w-9 !text-sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">{idea.author.displayName}</p>
              <p className="text-[11px] text-zinc-400">{formatPostedAt(idea.createdAt, locale)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100"
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <h2 id="idea-detail-title" className="text-xl font-semibold leading-snug tracking-tight text-zinc-950">
            {idea.title}
          </h2>

          {idea.appeal ? (
            <blockquote className="rounded-xl border border-orange-100 bg-orange-50/70 px-3.5 py-2.5 text-sm text-orange-950/85">
              {idea.appeal}
            </blockquote>
          ) : null}

          <div className="space-y-1">{renderContent(idea.content)}</div>

          {idea.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={idea.imageUrl} alt="" className="w-full rounded-xl object-cover ring-1 ring-zinc-100" />
          ) : null}

          {idea.roadmap ? (
            <div className="rounded-xl border border-[#D8DCFF] bg-[#F7F8FF] p-3.5">
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E6AD2]">
                <Map className="h-3.5 w-3.5" aria-hidden />
                {idea.roadmap.title}
              </p>
              <ol className="space-y-1.5">
                {idea.roadmap.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-700">
                    <span className="font-bold text-orange-500">{i + 1}.</span>
                    <span>
                      {s.title}
                      {s.detail ? <span className="text-zinc-400"> — {s.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {idea.externalUrl ? (
            <a
              href={idea.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {tx("リンクを開く", "Open link")}
            </a>
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            disabled={!canLike}
            onClick={() => void onToggleLike(idea)}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition active:scale-[0.99] disabled:opacity-50 ${
              idea.likedByMe
                ? "bg-orange-500 text-white shadow-[0_4px_0_#C2410C]"
                : "bg-zinc-900 text-white shadow-[0_4px_0_#18181b]"
            }`}
          >
            <ChevronUp className="h-5 w-5" aria-hidden />
            {tx("共感した", "Upvote")}
            <span className="tabular-nums opacity-90">{idea.likeCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
