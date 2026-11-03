"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * ログインは LP 上の AuthModal で行う。
 * /login への直リンク・旧導線は LP に寄せる（バツでタブ画面に出ないように）。
 */
function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const mode = searchParams.get("mode") === "signup" ? "signup" : "signin";
    const next = searchParams.get("next");
    const params = new URLSearchParams();
    params.set("auth", mode);
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      params.set("next", next);
    }
    router.replace(`/?${params.toString()}`);
  }, [router, searchParams]);

  return <main className="min-h-[100dvh] bg-[#fafaf8]" aria-busy="true" />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-[#fafaf8]" aria-busy="true" />}>
      <LoginRedirect />
    </Suspense>
  );
}
