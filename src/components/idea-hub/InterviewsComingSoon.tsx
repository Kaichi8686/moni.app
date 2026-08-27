"use client";

import { Lock } from "lucide-react";
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
        <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-6 text-center shadow-md shadow-zinc-900/8">
          <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-[12px] font-semibold tracking-wide text-zinc-400 uppercase">Coming Soon</p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-900">{tx("近日公開", "Coming soon")}</h2>
          <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-zinc-500">
            {tx(
              "ユーザーが増えてきたら、実際に活動した先輩たちのインタビューをお届けします。",
              "Once more people are using moni, we’ll share interviews with students who’ve already shipped.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
