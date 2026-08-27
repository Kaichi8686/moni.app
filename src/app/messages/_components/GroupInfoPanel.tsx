"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { X } from "lucide-react";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import { ensureInviteCode } from "@/lib/messages/api";
import { profileToSender } from "@/lib/messages/mappers";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  conversationId: string;
  title: string;
  onClose: () => void;
};

export function GroupInfoPanel({ conversationId, title, onClose }: Props) {
  const { tx } = useI18n();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string; avatarUrl?: string | null }>>([]);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const code = await ensureInviteCode(supabase, conversationId);
      setInviteCode(code);
      const { data: mems } = await supabase
        .from("conversation_members")
        .select("user_id, is_muted")
        .eq("conversation_id", conversationId);
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      const mine = mems?.find((m) => m.user_id === uid);
      setMuted(Boolean(mine?.is_muted));
      const ids = (mems ?? []).map((m) => m.user_id as string);
      if (!ids.length) return;
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      setMembers(
        (profiles ?? []).map((p) => ({
          id: p.id as string,
          name: profileToSender(p).displayName,
          avatarUrl: p.avatar_url as string | null,
        })),
      );
    })();
  }, [conversationId]);

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = inviteCode ? `${base}/messages/join/${inviteCode}` : "";

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/30">
      <div className="h-full w-full max-w-sm overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-6 p-4">
          {inviteUrl ? (
            <div className="flex flex-col items-center gap-2">
              <QRCode value={inviteUrl} size={160} />
              <p className="text-center text-xs text-zinc-500">{tx("QRコードでグループに招待", "Invite to the group with this QR code")}</p>
              <p className="break-all text-center text-[10px] text-zinc-400">{inviteUrl}</p>
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-500">{tx("メンバー", "Members")} ({members.length})</p>
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <MemberAvatarBubble userId={m.id} name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                  <span className="text-sm">{m.name}</span>
                </li>
              ))}
            </ul>
          </div>
          <label className="flex items-center justify-between text-sm">
            <span>{tx("通知をミュート", "Mute notifications")}</span>
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => {
                const next = e.target.checked;
                setMuted(next);
                if (!supabase) return;
                void supabase.auth.getSession().then(({ data }) => {
                  const client = supabase;
                  if (!client) return;
                  const uid = data.session?.user.id;
                  if (!uid) return;
                  void client
                    .from("conversation_members")
                    .update({ is_muted: next })
                    .eq("conversation_id", conversationId)
                    .eq("user_id", uid);
                });
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
