"use client";

import { FormEvent, useMemo } from "react";
import { MessageCircle } from "lucide-react";
import {
  categoryLabel,
  computeActivityStats,
  formatActivityTime,
  groupPostsByDay,
  parseActivityCaption,
} from "@/lib/feed/activityRecord";
import { avatarInitial, avatarToneFromName } from "@/lib/ui/avatarTone";

export type ActivityFeedItem = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  caption: string;
  imageUrl: string | null;
  imageUrls?: string[];
  recordedAt?: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  comments: Array<{ id: string; authorName: string; body: string }>;
};

type Props = {
  posts: ActivityFeedItem[];
  currentUserId: string | null;
  locale?: "ja" | "en";
  commentsOpen: Record<string, boolean>;
  commentDrafts: Record<string, string>;
  onOpenAuthor: (authorId: string, authorName: string) => void;
  onToggleLike: (post: ActivityFeedItem) => void;
  onToggleComments: (postId: string) => void;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (post: ActivityFeedItem) => void;
  onDelete?: (post: ActivityFeedItem) => void;
  canDelete: (post: ActivityFeedItem) => boolean;
  emptyHint?: string;
};

export function ActivityTimeline({
  posts,
  currentUserId,
  locale = "ja",
  commentsOpen,
  commentDrafts,
  onOpenAuthor,
  onToggleLike,
  onToggleComments,
  onCommentDraftChange,
  onSubmitComment,
  onDelete,
  canDelete,
  emptyHint,
}: Props) {
  const stats = useMemo(
    () => (currentUserId ? computeActivityStats(posts, currentUserId) : { streakDays: 0, monthCount: 0 }),
    [posts, currentUserId],
  );

  const groups = useMemo(() => groupPostsByDay(posts, locale), [posts, locale]);

  return (
    <div className="bg-white pb-10 pt-1">
      {/* Linear-style property strip — full width */}
      {currentUserId ? (
        <div className="mobile-content-inset flex flex-wrap items-center gap-x-5 gap-y-2 py-3.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] text-zinc-400">{locale === "ja" ? "連続" : "Streak"}</span>
            <span className="text-[15px] font-semibold tabular-nums tracking-tight text-zinc-900">
              {stats.streakDays}
              <span className="ml-0.5 text-[12px] font-medium text-zinc-400">{locale === "ja" ? "日" : "d"}</span>
            </span>
          </div>
          <span className="hidden h-3 w-px bg-zinc-200 sm:block" aria-hidden />
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] text-zinc-400">{locale === "ja" ? "今月" : "This month"}</span>
            <span className="text-[15px] font-semibold tabular-nums tracking-tight text-zinc-900">
              {stats.monthCount}
              <span className="ml-0.5 text-[12px] font-medium text-zinc-400">{locale === "ja" ? "件" : ""}</span>
            </span>
          </div>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="mobile-content-inset py-20 text-center">
          <p className="text-[17px] font-semibold tracking-tight text-zinc-800">
            {locale === "ja" ? "まだ記録がありません" : "No activity yet"}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
            {emptyHint ?? (locale === "ja" ? "右上の「記録」から始められます。" : "Tap Record to start.")}
          </p>
        </div>
      ) : (
        <div className="mobile-content-inset space-y-6 pb-6">
          {groups.map((group) => (
            <section key={group.dateKey}>
              <h3 className="mb-3 text-[13px] font-medium tracking-[-0.01em] text-zinc-400">{group.label}</h3>
              <ul className="space-y-3">
                {group.items.map((post) => {
                  const isMine = Boolean(currentUserId && post.authorId === currentUserId);
                  const parsed = parseActivityCaption(post.caption);
                  const images =
                    post.imageUrls && post.imageUrls.length > 0
                      ? post.imageUrls
                      : post.imageUrl
                        ? [post.imageUrl]
                        : [];
                  const when = post.recordedAt || post.createdAt;
                  const open = Boolean(commentsOpen[post.id]);
                  const detailPreview = parsed.detail
                    ? parsed.detail.length > 220
                      ? `${parsed.detail.slice(0, 220)}…`
                      : parsed.detail
                    : !parsed.title && parsed.displayCaption
                      ? parsed.displayCaption.length > 220
                        ? `${parsed.displayCaption.slice(0, 220)}…`
                        : parsed.displayCaption
                      : "";
                  const cat = categoryLabel(parsed.category, locale);
                  const heading =
                    parsed.title || parsed.displayCaption || (locale === "ja" ? "（無題）" : "(Untitled)");

                  return (
                    <li key={post.id}>
                      <article
                        className={[
                          "overflow-hidden rounded-xl border bg-white shadow-[0_1px_0_rgba(24,24,27,0.04)] transition",
                          isMine
                            ? "border-zinc-300 ring-1 ring-zinc-900/[0.04]"
                            : "border-zinc-200/90 hover:border-zinc-300",
                        ].join(" ")}
                      >
                        {/* Craft-like document body */}
                        <div className="px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
                          <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-zinc-500">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 font-medium text-zinc-600 transition hover:text-zinc-800"
                              onClick={() => onOpenAuthor(post.authorId, post.authorName)}
                            >
                              <span
                                className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold text-white"
                                style={
                                  post.authorAvatarUrl
                                    ? undefined
                                    : { backgroundColor: avatarToneFromName(post.authorName) }
                                }
                              >
                                {post.authorAvatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={post.authorAvatarUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  avatarInitial(post.authorName)
                                )}
                              </span>
                              {post.authorName}
                            </button>
                            <span aria-hidden>·</span>
                            <time dateTime={when}>{formatActivityTime(when, locale)}</time>
                            {cat ? (
                              <>
                                <span aria-hidden>·</span>
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[12px] font-medium text-zinc-600">
                                  {cat}
                                </span>
                              </>
                            ) : null}
                            {isMine ? (
                              <>
                                <span aria-hidden>·</span>
                                <span className="text-[12px] font-medium text-zinc-500">
                                  {locale === "ja" ? "自分の記録" : "Yours"}
                                </span>
                              </>
                            ) : null}
                            {canDelete(post) && onDelete ? (
                              <button
                                type="button"
                                className="ml-auto text-[13px] font-medium text-zinc-400 transition hover:text-rose-600"
                                onClick={() => onDelete(post)}
                              >
                                {locale === "ja" ? "削除" : "Delete"}
                              </button>
                            ) : null}
                          </div>

                          <h4 className="text-[1.25rem] font-semibold leading-[1.35] tracking-[-0.02em] text-zinc-900 sm:text-[1.5rem]">
                            {heading}
                          </h4>

                          {detailPreview ? (
                            <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-[1.75] text-zinc-600">
                              {detailPreview}
                            </p>
                          ) : null}

                          {images.length > 0 ? (
                            <div
                              className={`mt-5 grid gap-2 ${
                                images.length === 1
                                  ? "grid-cols-1"
                                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                              }`}
                            >
                              {images.slice(0, 6).map((src) => (
                                <div
                                  key={src}
                                  className={`overflow-hidden rounded-lg bg-zinc-100 ${
                                    images.length === 1 ? "max-h-[min(58vw,320px)]" : "aspect-[4/3]"
                                  }`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={src}
                                    alt=""
                                    className={`w-full object-cover ${
                                      images.length === 1 ? "max-h-[min(58vw,320px)]" : "h-full"
                                    }`}
                                    loading="lazy"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        {/* Quiet action row — Linear issue footer feel */}
                        <div className="flex items-center gap-1 border-t border-zinc-100 px-5 py-2 sm:px-6">
                          <button
                            type="button"
                            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2 text-[12px] text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700"
                            onClick={() => onToggleLike(post)}
                            aria-label={
                              post.likedByMe
                                ? locale === "ja"
                                  ? "いいねを取り消す"
                                  : "Unlike"
                                : locale === "ja"
                                  ? "いいねする"
                                  : "Like"
                            }
                          >
                            <span className={post.likedByMe ? "text-rose-500" : ""}>{post.likedByMe ? "♥" : "♡"}</span>
                            <span className={`tabular-nums ${post.likedByMe ? "font-medium text-rose-500" : ""}`}>
                              {post.likeCount}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2 text-[12px] text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700"
                            onClick={() => onToggleComments(post.id)}
                            aria-expanded={open}
                          >
                            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                            <span className={`tabular-nums ${open ? "font-medium text-zinc-700" : ""}`}>
                              {post.commentCount}
                            </span>
                          </button>
                        </div>

                        {open ? (
                          <div className="space-y-3 border-t border-zinc-100 bg-zinc-50 px-5 py-4 sm:px-6">
                            {post.comments.length > 0 ? (
                              <ul className="max-h-52 space-y-3 overflow-y-auto">
                                {post.comments.map((c) => (
                                  <li key={c.id} className="text-[13px] leading-relaxed text-zinc-600">
                                    <span className="font-semibold text-zinc-800">{c.authorName}</span>{" "}
                                    <span className="whitespace-pre-wrap break-words">{c.body}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[12px] text-zinc-400">
                                {locale === "ja" ? "まだコメントはありません" : "No comments yet"}
                              </p>
                            )}
                            <form
                              className="flex items-center gap-2"
                              onSubmit={(e: FormEvent) => {
                                e.preventDefault();
                                onSubmitComment(post);
                              }}
                            >
                              <input
                                id={`comment-input-${post.id}`}
                                className="min-h-[38px] flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-400 sm:text-sm"
                                placeholder={locale === "ja" ? "コメント…" : "Comment…"}
                                value={commentDrafts[post.id] ?? ""}
                                onChange={(e) => onCommentDraftChange(post.id, e.target.value)}
                                maxLength={280}
                              />
                              <button
                                type="submit"
                                className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-35"
                                disabled={!(commentDrafts[post.id] ?? "").trim()}
                              >
                                {locale === "ja" ? "送信" : "Post"}
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
