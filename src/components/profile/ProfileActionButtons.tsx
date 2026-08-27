"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, MessageCircle, MoreHorizontal, Pencil } from "lucide-react";
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

  useEffect(() => {
    setFollowing(isFollowing);
    setPending(isPending);
  }, [isFollowing, isPending]);

  async function handleFollow() {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      if (following) {
        await supabase.from("follows").delete().eq("follower_id", uid).eq("following_id", profileId);
        setFollowing(false);
      } else if (pending) {
        await supabase
          .from("follow_requests")
          .delete()
          .eq("follower_id", uid)
          .eq("following_id", profileId)
          .eq("status", "pending");
        setPending(false);
      } else {
        const { error } = await supabase.from("follow_requests").insert({
          follower_id: uid,
          following_id: profileId,
          status: "pending",
        });
        if (!error || error.code === "23505") {
          setPending(true);
          setFollowAnim(true);
          window.setTimeout(() => setFollowAnim(false), 400);
        }
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
    await navigateToDirectMessage(supabase, router, profileId);
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
      : tx("フォローする", "Follow");

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => void handleFollow()}
        disabled={loading}
        className={`flex-1 disabled:opacity-50 ${followAnim ? "btn-follow-animate" : ""} ${
          following || pending ? btnSecondary : btnPrimary
        }`}
      >
        {followLabel}
      </button>
      <button type="button" onClick={() => void openMessage()} className={iconBtn} aria-label={tx("メッセージ", "Message")}>
        <MessageCircle className="h-[18px] w-[18px]" />
      </button>
      <button type="button" className={iconBtn} aria-label={tx("その他", "More")}>
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
