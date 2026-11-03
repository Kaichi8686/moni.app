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

/**
 * Thin entry: guests stay on the landing page only.
 * Logged-in users are sent to /projects (or legacy ?tab= home shell).
 */
export default function HomePage() {
  const router = useRouter();
  const [clientReady, setClientReady] = useState(false);
  const [authReady, setAuthReady] = useState(!supabaseEnabled);
  const [session, setSession] = useState<Session | null>(null);
  const [showLandingPage, setShowLandingPage] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("about") === "1" || params.get("landing") === "1") {
        setShowLandingPage(true);
      }
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
      router.replace(HOME_PROJECTS_HREF);
    }
  }, [router, showLandingPage, clientReady, authReady, session]);

  if ((!clientReady || !authReady) && !showLandingPage) {
    return <LandingFallback />;
  }

  // 未ログインは常に LP。ログイン済みでも ?landing=1 / ?about=1 なら説明を表示。
  if (showLandingPage || !session) {
    return (
      <MoniLanding
        resumeMode={Boolean(session)}
        onStart={() => {
          setShowLandingPage(false);
          if (session) {
            router.push(resolveAppEntryHref());
            return;
          }
          router.push("/login");
        }}
        onPreview={() => {
          // 未ログインのプレビュー侵入は不可。中を見るにはログインへ。
          setShowLandingPage(false);
          if (session) {
            router.push(resolveAppEntryHref());
            return;
          }
          router.push("/login");
        }}
      />
    );
  }

  return <MoniHomeApp />;
}
