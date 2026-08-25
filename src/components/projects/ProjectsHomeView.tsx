"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProjectTabGlide, type AppFeatureKey } from "@/components/projects/ProjectTabGlide";
import { supabase } from "@/lib/supabase";

export function ProjectsHomeView() {
  const router = useRouter();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [displayName, setDisplayName] = useState("moni");

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const apply = (session: { user: { id: string; email?: string | null } } | null) => {
      setHasSession(Boolean(session));
      setSessionEmail(session?.user.email ?? null);
      if (session?.user.id) {
        void client
          .from("profiles")
          .select("display_name")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data: p }) => {
            const name = ((p as { display_name?: string | null } | null)?.display_name ?? "").trim();
            if (name) setDisplayName(name);
          });
      }
    };
    void client.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const onNavigate = (key: AppFeatureKey) => {
    if (key === "projects") return;
    if (key === "account") {
      router.push("/login");
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
  };

  return (
    <div
      id="moni-app"
      className="relative flex min-h-[100dvh] flex-col bg-white pt-[env(safe-area-inset-top,0px)] text-zinc-900 antialiased"
    >
      <div className="relative mx-auto flex w-full max-w-none flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 sm:px-5 lg:px-6">
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">moni</h1>
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
            {hasSession ? (
              <div className="hidden max-w-[40vw] truncate text-right text-xs text-zinc-500 sm:block">{sessionEmail ?? ""}</div>
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-[40px] shrink-0 touch-manipulation items-center rounded-lg border border-zinc-900 bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                ログイン
              </Link>
            )}
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col">
          <ProjectTabGlide
            displayName={displayName}
            sessionEmail={sessionEmail}
            hasSession={hasSession}
            onNavigate={onNavigate}
            fillViewport
          />
        </main>
      </div>
    </div>
  );
}
