"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseEnabled } from "@/lib/supabase";

/** 未ログインでも開ける画面。タブバー付きのアプリ画面は含めない。 */
function isGuestAllowedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/api")) return true;
  // 文化祭シフト等の独立ツール（タブバー外）
  if (pathname.startsWith("/dev")) return true;
  if (pathname.startsWith("/shift")) return true;
  if (pathname.startsWith("/bunkasai")) return true;
  return false;
}

/**
 * 未ログインは LP（とログイン／認証コールバック）以外に入れない。
 * タブバー付き画面への直リンク・プレビュー侵入を防ぐ。
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseEnabled);

  const guestAllowed = isGuestAllowedPath(pathname);

  useEffect(() => {
    if (!supabase || !supabaseEnabled) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabaseEnabled || !authReady) return;
    if (session || guestAllowed) return;
    router.replace("/?landing=1");
  }, [authReady, guestAllowed, router, session]);

  // Auth 未設定環境ではゲートしない（ローカル確認用）
  if (!supabaseEnabled) {
    return <>{children}</>;
  }

  if (!authReady) {
    if (guestAllowed) return <>{children}</>;
    return <main className="min-h-[100dvh] bg-[#fafaf8]" aria-busy="true" />;
  }

  if (!session && !guestAllowed) {
    return <main className="min-h-[100dvh] bg-[#fafaf8]" aria-busy="true" />;
  }

  return <>{children}</>;
}
