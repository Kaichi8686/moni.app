"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, MessageCircle, MoreHorizontal, Pencil } from "lucide-react";
import { shareProjectMembership } from "@/lib/messages/api";
import { areMutualFollowers, toggleFollowRelation } from "@/lib/profile/followActions";
import { navigateToDirectMessage } from "@/lib/messages/openDirectMessage";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  isOwnProfile: boolean;
  isFollowing: boolean;
  isPending: boolean;
  profileId: string;
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
  onFollowChange,
}: Props) {
  const router = useRouter();
  const { tx } = useI18n();
  const [following, setFollowing] = useState(isFollowing);
  const [pending, setPending] = useState(isPending);
  const [loading, setLoading] = useState(false);
  const [followAnim, setFollowAnim] = useState(false);
  const [actionError, setActionError] = useState("");
  const [canMessage, setCanMessage] = useState(false);

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
      const projectPeer = mutual ? true : await shareProjectMembership(supabase, uid, profileId);
      if (!cancelled) setCanMessage(mutual || projectPeer);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, profileId, following]);

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
    const result = await navigateToDirectMessage(supabase, router, profileId);
    if (!result.ok && result.reason === "not_mutual") {
      setActionError(
        tx(
          "同じプロジェクトのメンバーか、相互フォローになるとメールできます",
          "Mail unlocks for project teammates or mutual follows",
        ),
      );
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
              : tx(
                  "同じプロジェクトのメンバーか、相互フォローになるとメールできます",
                  "Mail unlocks for project teammates or mutual follows",
                )
          }
          title={
            canMessage
              ? tx("メッセージ", "Message")
              : tx(
                  "同じプロジェクトのメンバーか、相互フォローになるとメールできます",
                  "Mail unlocks for project teammates or mutual follows",
                )
          }
        >
          <MessageCircle className="h-[18px] w-[18px]" />
        </button>
        <button type="button" className={iconBtn} aria-label={tx("その他", "More")}>
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </button>
      </div>
      {actionError ? <p className="text-[11px] text-rose-600">{actionError}</p> : null}
    </div>
  );
}
