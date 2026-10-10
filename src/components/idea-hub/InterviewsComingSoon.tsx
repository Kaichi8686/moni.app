"use client";

import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import type { InterviewArticle } from "@/lib/idea-hub/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

const TONE: Record<InterviewArticle["coverTone"], string> = {
  sky: "from-sky-200/80 to-sky-100/60",
  amber: "from-amber-200/80 to-amber-100/60",
  rose: "from-rose-200/80 to-rose-100/60",
};

export function InterviewsComingSoon({ articles }: { articles: InterviewArticle[] }) {
  const { tx } = useI18n();
  return (
    <div className="relative mx-auto max-w-lg px-4 py-5">
      <div className="pointer-events-none select-none space-y-3 opacity-40" aria-hidden>
        {articles.map((article) => (
          <article
            key={article.id}
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
          >
            <div className={`h-20 bg-gradient-to-br ${TONE[article.coverTone]}`} />
            <div className="space-y-1.5 px-4 py-3.5">
              <p className="text-[12px] font-medium text-zinc-500">
                {article.authorLabel} · {article.publishedAt}
              </p>
              <h2 className="text-[16px] font-semibold leading-snug text-zinc-900">{article.title}</h2>
              <p className="text-[14px] leading-relaxed text-zinc-500">{article.excerpt}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2">
        <div className="rounded-2xl border border-[var(--brand-muted,#ffd9cc)] bg-white px-5 py-6 text-center shadow-md shadow-zinc-900/8">
          <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-soft,#fff4f0)] text-[var(--brand-ink,#9a3412)]">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{tx("近日公開", "Coming soon")}</h2>
          <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-zinc-500">
            {tx(
              "あとでもっと人が集まってきたら、実際に活動した先輩たちのインタビューをお届けします。",
              "Once more people are using moni, we’ll share interviews with people who’ve already shipped.",
            )}
          </p>
          <p className="mx-auto mt-4 max-w-xs rounded-xl bg-[var(--brand-soft,#fff4f0)] px-3 py-2.5 text-left text-[12px] leading-relaxed text-[var(--brand-ink,#9a3412)]">
            <span className="font-semibold">{tx("次の一手:", "Next step:")}</span>{" "}
            {tx(
              "いまは自分のアイデアを見つけて、メモしてみましょう。",
              "For now, find your own idea and jot it down.",
            )}
          </p>
          <Link href="/idea" className="moni-btn-primary mt-4 inline-flex gap-1.5 px-4">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {tx("アイデアを見つける", "Find ideas")}
          </Link>
        </div>
      </div>
    </div>
  );
}
