"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProjectTabGlide, type AppFeatureKey } from "@/components/projects/ProjectTabGlide";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function ProjectsHomeView() {
  const router = useRouter();
  const { tx } = useI18n();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const applySession = (session: { user: { id: string; email?: string | null } } | null) => {
      setHasSession(Boolean(session));
      setSessionEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    };
    void client.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function onNavigate(key: AppFeatureKey) {
    if (key === "projects") return;
    if (key === "account") {
      router.push("/profile");
      return;
    }
    if (key === "posts") {
      router.push("/?tab=posts");
      return;
    }
    if (key === "chat") {
      router.push("/?tab=chat");
      return;
    }
    router.push(`/?tab=${key}`);
  }

  return (
    <div
      id="moni-app"
      className="relative flex min-h-[100dvh] flex-col bg-white pt-[env(safe-area-inset-top,0px)] text-zinc-900 antialiased"
    >
      <div className="relative mx-auto flex w-full max-w-none flex-1 flex-col pb-bottom-nav">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 sm:px-5 lg:px-6">
          <h1 className="moni-wordmark text-lg sm:text-xl">moni</h1>
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
            {!hasSession ? (
              <Link
                href="/login"
                className="inline-flex min-h-[40px] shrink-0 touch-manipulation items-center rounded-lg border border-zinc-900 bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                {tx("ログイン", "Log in")}
              </Link>
            ) : (
              <div className="hidden max-w-[40vw] truncate text-right text-xs text-zinc-500 sm:block">
                {sessionEmail ?? ""}
              </div>
            )}
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <ProjectTabGlide
            hasSession={hasSession}
            userId={userId}
            onNavigate={onNavigate}
            fillViewport
          />
        </main>
      </div>
    </div>
  );
}
