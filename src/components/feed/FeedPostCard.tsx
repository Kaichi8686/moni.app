"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type FeedPostCardData = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  caption: string;
  imageUrl: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  comments: Array<{ id: string; authorName: string; body: string }>;
};

type Props = {
  post: FeedPostCardData;
  canDelete: boolean;
  commentDraft: string;
  onCommentDraftChange: (value: string) => void;
  onLike: () => void;
  onComment: () => void;
  onDelete: () => void;
  onOpenAuthor: () => void;
  formatTime: (iso: string) => string;
};

const CAPTION_CLAMP = 120;

export function FeedPostCard({
  post,
  canDelete,
  commentDraft,
  onCommentDraftChange,
  onLike,
  onComment,
  onDelete,
  onOpenAuthor,
  formatTime,
}: Props) {
  const { tx } = useI18n();
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const caption = post.caption.trim();
  const longCaption = caption.length > CAPTION_CLAMP;
  const captionShown =
    captionExpanded || !longCaption ? caption : `${caption.slice(0, CAPTION_CLAMP)}…`;

  return (
    <article className="border-b border-zinc-200/90 bg-white">
      <header className="flex items-center justify-between gap-2 px-4 py-2.5">
        <button type="button" className="flex min-w-0 items-center gap-2.5" onClick={onOpenAuthor}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-[13px] font-bold text-zinc-700">
            {post.authorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.authorAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (post.authorName.trim().charAt(0) || "?").toUpperCase()
            )}
          </span>
          <span className="min-w-0 text-left">
            <span className="block break-words text-[15px] font-semibold leading-snug text-zinc-900">{post.authorName}</span>
            <span className="block text-[12px] text-zinc-500">{formatTime(post.createdAt)}</span>
          </span>
        </button>
        {canDelete ? (
          <button type="button" className="shrink-0 text-[13px] font-medium text-rose-500" onClick={onDelete}>
            {tx("削除", "Delete")}
          </button>
        ) : null}
      </header>

      {post.imageUrl ? (
        <div className="mx-auto w-full max-w-full bg-zinc-100 sm:max-w-[468px]">
          <div className="relative w-full overflow-hidden aspect-[4/5] max-h-[min(70dvh,420px)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full max-w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      ) : null}

      <div className="px-4 py-2.5">
        <div className="flex items-center gap-3 text-[14px]">
          <button type="button" className="inline-flex items-center gap-0.5" onClick={onLike} aria-label={tx("いいね", "Like")}>
            <span className={post.likedByMe ? "text-rose-500" : "text-zinc-600"}>{post.likedByMe ? "♥" : "♡"}</span>
            <span className={post.likedByMe ? "font-semibold text-rose-500" : "text-zinc-700"}>
              {post.likeCount > 0 ? post.likeCount : ""}
            </span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-zinc-600"
            onClick={() => setCommentsOpen((v) => !v)}
          >
            <span>💬</span>
            {post.commentCount > 0 ? <span>{post.commentCount}</span> : null}
          </button>
        </div>

        {caption ? (
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-800">
            <span className="font-semibold">{post.authorName}</span>{" "}
            <span className="whitespace-pre-wrap break-words">{captionShown}</span>
            {longCaption && !captionExpanded ? (
              <button
                type="button"
                className="ml-1 text-[14px] font-medium text-zinc-500"
                onClick={() => setCaptionExpanded(true)}
              >
                {tx("続きを読む", "Read more")}
              </button>
            ) : null}
          </p>
        ) : null}

        {commentsOpen ? (
          <div className="mt-2 space-y-2 border-t border-zinc-100 pt-2">
            {post.comments.length > 0 ? (
              <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                {post.comments.slice(-5).map((c) => (
                  <li key={c.id} className="text-[14px] leading-relaxed text-zinc-800">
                    <span className="font-semibold">{c.authorName}</span>{" "}
                    <span className="whitespace-pre-wrap break-words">{c.body}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-zinc-500">{tx("まだコメントはありません", "No comments yet")}</p>
            )}
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                onComment();
              }}
            >
              <input
                className="min-h-[40px] flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-[15px] outline-none focus:border-sky-400"
                placeholder={tx("コメント…", "Comment…")}
                value={commentDraft}
                onChange={(e) => onCommentDraftChange(e.target.value)}
                maxLength={280}
              />
              <button
                type="submit"
                disabled={!commentDraft.trim()}
                className="shrink-0 rounded-full px-3 py-2 text-[14px] font-semibold text-sky-600 disabled:opacity-40"
              >
                {tx("送信", "Post")}
              </button>
            </form>
          </div>
        ) : post.commentCount > 0 ? (
          <button
            type="button"
            className="mt-1.5 text-[13px] text-zinc-500"
            onClick={() => setCommentsOpen(true)}
          >
            {tx(`コメント${post.commentCount}件を見る`, `View ${post.commentCount} comments`)}
          </button>
        ) : null}
      </div>
    </article>
  );
}
