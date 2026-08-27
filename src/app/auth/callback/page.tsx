"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resolveAppEntryHref } from "@/lib/navigation/homeProjects";

/**
 * OAuth / メールマジックリンクの戻り先。Supabase の Redirect URLs に
 * http://127.0.0.1:3002/auth/callback と http://localhost:3002/auth/callback を追加すること。
 *
 * PKCE では URL に ?code= が付くため、getSession だけではセッションが取れない。
 * 必ず exchangeCodeForSession(code) してから getSession する。
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [note, setNote] = useState(() =>
    supabase ? "ログイン処理中…" : "Supabase 未設定です。.env.local を確認してください。",
  );

  useEffect(() => {
    if (!supabase) return;

    const params = new URLSearchParams(window.location.search);
    const err = params.get("error_description") ?? params.get("error");
    if (err) {
      queueMicrotask(() =>
        setNote(`ログインエラー: ${decodeURIComponent(err.replace(/\+/g, " "))}`),
      );
      return;
    }

    void (async () => {
      const code = params.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setNote(`ログインに失敗: ${exchangeError.message}`);
          return;
        }
      }

      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      if (tokenHash && type) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          type: type as "email" | "signup" | "magiclink" | "recovery" | "invite" | "email_change",
          token_hash: tokenHash,
        });
        if (otpError) {
          setNote(`ログインに失敗: ${otpError.message}`);
          return;
        }
      }

      // メール確認リンクが #access_token / #refresh_token を付ける構成のとき（implicit）
      const hashRaw = window.location.hash.replace(/^#/, "");
      if (hashRaw) {
        const hp = new URLSearchParams(hashRaw);
        const access_token = hp.get("access_token");
        const refresh_token = hp.get("refresh_token");
        if (access_token && refresh_token) {
          const { error: hashErr } = await supabase.auth.setSession({ access_token, refresh_token });
          if (hashErr) {
            setNote(`ログインに失敗: ${hashErr.message}`);
            return;
          }
          window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setNote(`セッション取得に失敗: ${error.message}`);
        return;
      }
      if (!data.session) {
        setNote(
          "セッションが見つかりません。リンクの有効期限切れの可能性があります。もう一度ログインを試してください。",
        );
        return;
      }
      router.replace(resolveAppEntryHref());
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fafafa] px-4 text-center text-[#262626]">
      <p className="text-sm">{note}</p>
      <button
        type="button"
        className="rounded-lg border border-[#dbdbdb] bg-white px-4 py-2 text-sm font-semibold text-[#262626] hover:bg-[#fafafa]"
        onClick={() => router.replace(resolveAppEntryHref())}
      >
        トップへ戻る
      </button>
    </div>
  );
}
