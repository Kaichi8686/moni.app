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
    <main className="relative min-h-[100dvh] bg-[#f7f6f3]">
      <p className="pointer-events-none absolute inset-x-0 top-[18%] text-center font-[family-name:var(--font-geist-sans)] text-3xl font-medium tracking-[-0.06em] text-zinc-900/15">
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
