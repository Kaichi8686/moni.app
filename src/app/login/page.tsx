"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { resolveAppEntryHref } from "@/lib/navigation/homeProjects";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return resolveAppEntryHref();
  return raw;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const afterAuth = safeNextPath(searchParams.get("next"));

  const goHome = useCallback(() => {
    router.push("/");
  }, [router]);

  const goApp = useCallback(() => {
    router.replace(afterAuth);
  }, [afterAuth, router]);

  useEffect(() => {
    if (!supabase || !supabaseEnabled) return;
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(afterAuth);
    });
  }, [afterAuth, router]);

  if (!supabaseEnabled || !supabase) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-4 py-10">
        <p className="text-sm text-rose-700">
          Supabase が未設定です。`.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定してください。
        </p>
        <Link href="/" className="text-sm font-semibold text-zinc-800 hover:underline">
          ホームへ戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#fafaf8]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgba(255,92,53,0.14),transparent_55%),radial-gradient(ellipse_50%_40%_at_100%_0%,rgba(255,180,120,0.12),transparent_50%)]"
      />
      <p className="pointer-events-none absolute inset-x-0 top-[16%] text-center font-[family-name:var(--font-moni-script),cursive] text-5xl tracking-[0.01em] text-[var(--brand,#ff5c35)]/20">
        moni
      </p>
      <AuthModal mode={mode} onClose={goHome} onAuthenticated={goApp} />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[50vh] items-center justify-center bg-[#f7f6f3] text-sm text-zinc-600">読み込み中…</main>}>
      <LoginPageContent />
    </Suspense>
  );
}
