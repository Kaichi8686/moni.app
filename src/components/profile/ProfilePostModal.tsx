"use client";

import type { ProfilePost } from "@/lib/profile/types";

type Props = {
  post: ProfilePost;
  authorName: string;
  onClose: () => void;
};

export function ProfilePostModal({ post, authorName, onClose }: Props) {
  const caption = post.caption.trim();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="閉じる" />
      <div
        className="relative z-10 flex max-h-[88dvh] w-full max-w-[468px] flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="truncate text-sm font-semibold text-gray-900">{authorName}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-lg leading-none text-gray-500 hover:bg-gray-100"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {post.imageUrl ? (
          <div className="flex max-h-[min(52vh,380px)] w-full items-center justify-center bg-zinc-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt=""
              className="max-h-[min(52vh,380px)] w-full object-contain"
            />
          </div>
        ) : null}

        <div className="overflow-y-auto px-3 py-2.5">
          {caption ? (
            <p className="whitespace-pre-wrap text-[13px] leading-snug text-gray-900">{caption}</p>
          ) : (
            <p className="text-[13px] text-gray-500">（テキストのみの投稿）</p>
          )}
          <p className="mt-2 text-[10px] uppercase tracking-wide text-gray-400">
            {new Date(post.createdAt).toLocaleDateString("ja-JP", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
