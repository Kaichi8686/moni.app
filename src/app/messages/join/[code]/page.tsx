"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { joinByInviteCode } from "@/lib/messages/api";
import { supabase } from "@/lib/supabase";

export default function JoinConversationPage() {
  const params = useParams();
  const router = useRouter();
  const code = typeof params.code === "string" ? params.code : "";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code || !supabase) return;
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.replace(`/login?next=/messages/join/${code}`);
        return;
      }
      const convId = await joinByInviteCode(supabase, code);
      if (convId) router.replace(`/messages/${convId}`);
      else setError("招待リンクが無効か期限切れです");
    })();
  }, [code, router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
      <p className="text-sm text-zinc-600">{error ?? "グループに参加しています..."}</p>
    </div>
  );
}
