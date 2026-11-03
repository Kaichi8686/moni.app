"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { HOME_PROJECTS_HREF, resolveAppEntryHref } from "@/lib/navigation/homeProjects";
import { supabase, supabaseEnabled } from "@/lib/supabase";

const LandingFallback = () => <main className="min-h-screen bg-zinc-50" aria-busy="true" />;

const MoniLanding = dynamic(
  () => import("@/components/MoniLanding").then((m) => m.MoniLanding),
  { loading: LandingFallback },
);

const MoniHomeApp = dynamic(
  () => import("@/components/home/MoniHomeApp").then((m) => m.MoniHomeApp),
  { ssr: false, loading: LandingFallback },
);

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * Thin entry: guests stay on the landing page only (auth is an LP overlay).
 * Logged-in users are sent to /projects (or legacy ?tab= home shell).
 */
export default function HomePage() {
  const router = useRouter();
  const [clientReady, setClientReady] = useState(false);
  const [authReady, setAuthReady] = useState(!supabaseEnabled);
  const [session, setSession] = useState<Session | null>(null);
  const [showLandingPage, setShowLandingPage] = useState(false);
  const [initialAuthMode, setInitialAuthMode] = useState<"signin" | "signup" | null>(null);
  const [afterAuthPath, setAfterAuthPath] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("about") === "1" || params.get("landing") === "1") {
        setShowLandingPage(true);
      }
      const auth = params.get("auth");
      if (auth === "signup") setInitialAuthMode("signup");
      else if (auth === "1" || auth === "signin" || auth === "login") setInitialAuthMode("signin");
      setAfterAuthPath(safeNextPath(params.get("next")));
      setClientReady(true);
    });
  }, []);

  useEffect(() => {
    if (!supabase || !supabaseEnabled) return;
    let cancelled = false;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session ?? null);
        setAuthReady(true);
      })
      .catch(() => {
        if (!cancelled) setAuthReady(true);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!clientReady || !authReady) return;
    const params = new URLSearchParams(window.location.search);
    if (showLandingPage || params.get("landing") === "1" || params.get("about") === "1") {
      return;
    }

    // 未ログインは LP のみ。タブ系クエリでもアプリへ飛ばさない。
    if (!session) return;

    const tab = params.get("tab");
    const community = params.get("community");
    const mentor = params.get("mentor");
    if (tab === "projects") {
      router.replace(HOME_PROJECTS_HREF);
      return;
    }
    if (tab === "account") {
      router.replace("/profile");
      return;
    }
    if (tab === "posts" || community === "qna") {
      router.replace("/idea?tab=qna&view=board");
      return;
    }
    if (community === "progress") {
      router.replace(HOME_PROJECTS_HREF);
      return;
    }
    if (!tab && !mentor) {
      router.replace(afterAuthPath ?? HOME_PROJECTS_HREF);
    }
  }, [router, showLandingPage, clientReady, authReady, session, afterAuthPath]);

  if ((!clientReady || !authReady) && !showLandingPage) {
    return <LandingFallback />;
  }

  // 未ログインは常に LP。ログイン済みでも ?landing=1 / ?about=1 なら説明を表示。
  if (showLandingPage || !session) {
    return (
      <MoniLanding
        resumeMode={Boolean(session)}
        initialAuthMode={session ? null : initialAuthMode}
        onStart={() => {
          setShowLandingPage(false);
          router.push(resolveAppEntryHref());
        }}
        onAuthenticated={() => {
          setShowLandingPage(false);
          setInitialAuthMode(null);
          router.replace(afterAuthPath ?? resolveAppEntryHref());
        }}
      />
    );
  }

  return <MoniHomeApp />;
}
