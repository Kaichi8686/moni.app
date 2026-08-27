"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import { getOrCreateDirectConversation } from "@/lib/messages/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  currentUserId: string;
  onClose: () => void;
  onCreated: () => void;
};

type UserRow = { id: string; display_name: string | null; avatar_url: string | null };

export function NewConversationModal({ currentUserId, onClose, onCreated }: Props) {
  const { tx } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .neq("id", currentUserId)
      .order("display_name")
      .limit(40)
      .then(({ data }) => setUsers((data ?? []) as UserRow[]));
  }, [currentUserId]);

  const filtered = users.filter((u) => {
    const name = (u.display_name ?? "").toLowerCase();
    return name.includes(query.trim().toLowerCase());
  });

  const startDm = async (otherId: string) => {
    if (!supabase) return;
    setLoading(true);
    const convId = await getOrCreateDirectConversation(supabase, otherId);
    setLoading(false);
    if (convId) {
      onCreated();
      router.push(`/messages/${convId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[85dvh] w-full max-w-lg overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-zinc-900">{tx("新しいチャット", "New chat")}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b px-4 py-2">
          <input
            className="w-full rounded-xl bg-zinc-100 px-3 py-2 text-sm outline-none"
            placeholder={tx("名前で検索", "Search by name")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ul className="max-h-[50dvh] overflow-y-auto">
          {filtered.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                disabled={loading}
                onClick={() => void startDm(u.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
              >
                <MemberAvatarBubble
                  userId={u.id}
                  name={(u.display_name?.trim() || tx("ユーザー", "User")) as string}
                  avatarUrl={u.avatar_url}
                  size="sm"
                />
                <span className="text-sm font-medium text-zinc-900">
                  {u.display_name?.trim() || tx("ユーザー", "User")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
