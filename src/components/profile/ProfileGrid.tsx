"use client";

import Link from "next/link";
import { useState } from "react";
import { ImageIcon, PenLine } from "lucide-react";
import { parseActivityCaption } from "@/lib/feed/activityRecord";
import type { ProfilePost } from "@/lib/profile/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  posts: ProfilePost[];
  isOwnProfile?: boolean;
};

function formatDate(iso: string, locale: "ja" | "en") {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale === "en" ? "en-US" : "ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

export function ProfileGrid({ posts, isOwnProfile = false }: Props) {
  const { tx, locale } = useI18n();
  const [selected, setSelected] = useState<ProfilePost | null>(null);

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500">
          <PenLine className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-[15px] font-semibold tracking-tight text-zinc-900">{tx("まだ投稿がありません", "No posts yet")}</p>
        <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-zinc-500">
          {isOwnProfile
            ? tx("活動記録で最初の投稿をして、実績の土台を残しましょう。", "Share your first activity post to start a record of what you’ve done.")
            : tx("このユーザーの投稿はまだありません。", "This user hasn’t posted yet.")}
        </p>
        {isOwnProfile ? (
          <Link
            href="/?tab=posts&community=progress"
            className="mt-5 inline-flex min-h-[40px] items-center rounded-lg bg-zinc-900 px-4 text-[13px] font-semibold text-white transition hover:bg-zinc-800"
          >
            {tx("最初の投稿をしてみよう", "Make your first post")}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
        {posts.map((post) => {
          const parsed = parseActivityCaption(post.caption || "");
          const title = parsed.title || parsed.displayCaption || tx("投稿", "Post");
          const detail = parsed.detail;
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => setSelected(post)}
              className="flex min-h-[120px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-[0_1px_0_rgba(24,24,27,0.04)] transition hover:border-zinc-300"
            >
              {post.imageUrl ? (
                <div className="aspect-[16/9] w-full overflow-hidden bg-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
              ) : (
                <div className="flex aspect-[16/9] w-full items-center justify-center bg-zinc-50 text-zinc-300">
                  <ImageIcon className="h-6 w-6" aria-hidden />
                </div>
              )}
              <div className="flex flex-1 flex-col px-3.5 py-3">
                <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug tracking-tight text-zinc-900">
                  {title}
                </h3>
                {detail ? (
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">{detail}</p>
                ) : null}
                <p className="mt-auto pt-2 text-[11px] font-medium text-zinc-400">{formatDate(post.createdAt, locale)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-zinc-900/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-xl border border-zinc-200 bg-white p-5 shadow-xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {selected.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.imageUrl} alt="" className="mb-4 max-h-64 w-full rounded-lg object-cover" />
            ) : null}
            {(() => {
              const parsed = parseActivityCaption(selected.caption || "");
              return (
                <>
                  <h3 className="text-[17px] font-semibold tracking-tight text-zinc-900">
                    {parsed.title || tx("投稿", "Post")}
                  </h3>
                  {parsed.detail ? (
                    <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-600">{parsed.detail}</p>
                  ) : !parsed.title && parsed.displayCaption ? (
                    <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-600">
                      {parsed.displayCaption}
                    </p>
                  ) : null}
                  <p className="mt-3 text-[12px] text-zinc-400">{formatDate(selected.createdAt, locale)}</p>
                </>
              );
            })()}
            <button
              type="button"
              className="mt-5 w-full rounded-lg bg-zinc-900 py-2.5 text-[13px] font-semibold text-white transition hover:bg-zinc-800"
              onClick={() => setSelected(null)}
            >
              {tx("閉じる", "Close")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
