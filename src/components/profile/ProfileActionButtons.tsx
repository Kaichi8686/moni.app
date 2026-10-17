"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Flag, MessageCircle, MoreHorizontal, Pencil, X } from "lucide-react";
import { areMutualFollowers, toggleFollowRelation } from "@/lib/profile/followActions";
import { navigateToDirectMessage } from "@/lib/messages/openDirectMessage";
import { submitUserReport } from "@/lib/report/submitUserReport";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  isOwnProfile: boolean;
  isFollowing: boolean;
  isPending: boolean;
  profileId: string;
  profileDisplayName?: string;
  onFollowChange: () => void;
};

const btnBase =
  "inline-flex min-h-[40px] touch-manipulation items-center justify-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition active:scale-[0.98]";
const btnPrimary = `${btnBase} bg-zinc-900 text-white hover:bg-zinc-800`;
const btnSecondary = `${btnBase} border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50`;
const iconBtn =
  "flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.98]";

export function ProfileActionButtons({
  isOwnProfile,
  isFollowing,
  isPending,
  profileId,
  profileDisplayName,
  onFollowChange,
}: Props) {
  const router = useRouter();
  const { tx } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(isFollowing);
  const [pending, setPending] = useState(isPending);
  const [loading, setLoading] = useState(false);
  const [followAnim, setFollowAnim] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [canMessage, setCanMessage] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    setFollowing(isFollowing);
    setPending(isPending);
  }, [isFollowing, isPending]);

  useEffect(() => {
    if (!supabase || isOwnProfile) {
      setCanMessage(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) {
        if (!cancelled) setCanMessage(false);
        return;
      }
      const mutual = await areMutualFollowers(supabase, uid, profileId);
      if (!cancelled) setCanMessage(mutual);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, profileId, following]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleFollow() {
    if (!supabase) {
      setActionError(tx("Supabase が未設定です", "Supabase is not configured"));
      return;
    }
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) {
      router.push("/login");
      return;
    }
    setLoading(true);
    setActionError("");
    setActionSuccess("");
    try {
      const result = await toggleFollowRelation(supabase, uid, profileId);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setFollowing(result.state === "following");
      setPending(result.state === "pending");
      if (result.state === "following" || result.state === "pending") {
        setFollowAnim(true);
        window.setTimeout(() => setFollowAnim(false), 400);
      }
      onFollowChange();
    } finally {
      setLoading(false);
    }
  }

  async function openMessage() {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user.id) {
      router.push("/login");
      return;
    }
    setActionError("");
    setActionSuccess("");
    const result = await navigateToDirectMessage(supabase, router, profileId);
    if (!result.ok && result.reason === "not_mutual") {
      setActionError(tx("相互フォローになるとメールできます", "Mail unlocks after you follow each other"));
    }
  }

  function openReport() {
    setMenuOpen(false);
    setActionError("");
    setActionSuccess("");
    setReportReason("");
    setReportOpen(true);
  }

  async function handleSubmitReport() {
    setReportSubmitting(true);
    setActionError("");
    setActionSuccess("");
    try {
      const result = await submitUserReport({
        targetUserId: profileId,
        reason: reportReason.trim() || undefined,
        excerpt: profileDisplayName?.trim() || undefined,
        targetType: "profile",
      });
      if (!result.ok) {
        if (result.needsLogin) {
          setReportOpen(false);
          router.push("/login");
          return;
        }
        setActionError(result.error);
        return;
      }
      setReportOpen(false);
      setReportReason("");
      setActionSuccess(
        tx(
          "報告を受け付けました。運営に通知しました。",
          "Report submitted. The owner has been notified.",
        ),
      );
    } finally {
      setReportSubmitting(false);
    }
  }

  if (isOwnProfile) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/profile/edit" className={btnPrimary}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          {tx("編集", "Edit")}
        </Link>
        <Link href="/mybook" className={btnSecondary} title={tx("マイブック", "My Book")}>
          <BookOpen className="h-3.5 w-3.5" aria-hidden />
          {tx("マイブック", "My Book")}
        </Link>
      </div>
    );
  }
  const followLabel = following
    ? tx("フォロー中", "Following")
    : pending
      ? tx("申請中", "Requested")
      : tx("フォロー", "Follow");

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleFollow()}
          disabled={loading}
          className={`flex-1 disabled:opacity-50 ${followAnim ? "btn-follow-animate" : ""} ${
            following || pending ? btnSecondary : btnPrimary
          }`}
        >
          {loading ? tx("処理中…", "Working…") : followLabel}
        </button>
        <button
          type="button"
          onClick={() => void openMessage()}
          className={`${iconBtn} ${canMessage ? "" : "opacity-50"}`}
          aria-label={
            canMessage
              ? tx("メッセージ", "Message")
              : tx("相互フォローになるとメールできます", "Mail unlocks after you follow each other")
          }
          title={
            canMessage
              ? tx("メッセージ", "Message")
              : tx("相互フォローになるとメールできます", "Mail unlocks after you follow each other")
          }
        >
          <MessageCircle className="h-[18px] w-[18px]" />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className={iconBtn}
            aria-label={tx("その他", "More")}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal className="h-[18px] w-[18px]" />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-sm"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-rose-700 transition hover:bg-rose-50"
                onClick={openReport}
              >
                <Flag className="h-4 w-4 shrink-0" aria-hidden />
                {tx("報告する", "Report")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {actionError ? <p className="text-[11px] text-rose-600">{actionError}</p> : null}
      {actionSuccess ? <p className="text-[11px] text-emerald-700">{actionSuccess}</p> : null}

      {reportOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={tx("閉じる", "Close")}
            onClick={() => !reportSubmitting && setReportOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-user-title"
            className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="report-user-title" className="text-[16px] font-bold text-zinc-900">
                  {tx("ユーザーを報告", "Report user")}
                </h2>
                <p className="mt-1 text-[12px] text-zinc-500">
                  {tx(
                    `${profileDisplayName?.trim() || "このユーザー"}さんを報告します。運営に通知されます。`,
                    `Report ${profileDisplayName?.trim() || "this user"}. The owner will be notified.`,
                  )}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
                aria-label={tx("閉じる", "Close")}
                disabled={reportSubmitting}
                onClick={() => setReportOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 block">
              <span className="text-[12px] font-semibold text-zinc-700">
                {tx("理由（任意）", "Reason (optional)")}
              </span>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={3}
                maxLength={1000}
                disabled={reportSubmitting}
                placeholder={tx("例: 不適切な投稿・なりすましなど", "e.g. harassment, impersonation")}
                className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className={`${btnSecondary} flex-1`}
                disabled={reportSubmitting}
                onClick={() => setReportOpen(false)}
              >
                {tx("キャンセル", "Cancel")}
              </button>
              <button
                type="button"
                className={`${btnPrimary} flex-1 bg-rose-700 hover:bg-rose-800`}
                disabled={reportSubmitting}
                onClick={() => void handleSubmitReport()}
              >
                {reportSubmitting ? tx("送信中…", "Sending…") : tx("報告する", "Report")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
