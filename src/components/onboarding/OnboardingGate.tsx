"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import {
  resolveOnboardingCompleted,
  writeLocalOnboardingDone,
} from "@/lib/profile/onboardingStatus";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const SignupOnboardingWizard = dynamic(
  () => import("@/components/onboarding/SignupOnboardingWizard").then((m) => m.SignupOnboardingWizard),
  { loading: () => <main className="min-h-[100dvh] bg-[#f6f5f2]" aria-busy="true" /> },
);

function shouldBypassOnboarding(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname.startsWith("/dev")) return true;
  if (pathname.startsWith("/shift")) return true;
  if (pathname.startsWith("/bunkasai")) return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/api")) return true;
  return false;
}

/**
 * ログイン済みかつオンボーディング未完了なら、どの画面にいてもウィザードを出す。
 * （サインアップ直後に /projects へ飛んでもすぐ初期設定できるようにする）
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  const bypass = shouldBypassOnboarding(pathname);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      setSession(null);
      setOnboardingDone(true);
      return;
    }
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
      if (!next) setOnboardingDone(true);
      else setOnboardingDone(null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (bypass || !authReady) return;
    if (!session) {
      setOnboardingDone(true);
      return;
    }
    let cancelled = false;
    setOnboardingDone(null);
    void resolveOnboardingCompleted(supabase, session.user.id).then((done) => {
      if (!cancelled) setOnboardingDone(done);
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, bypass, session]);

  if (bypass || !authReady || !session) {
    return <>{children}</>;
  }

  if (onboardingDone === null) {
    return <main className="min-h-[100dvh] bg-[#f6f5f2]" aria-busy="true" />;
  }

  if (!onboardingDone) {
    const metaName =
      ((session.user.user_metadata as { display_name?: string } | undefined)?.display_name ?? "").trim() ||
      "";
    return (
      <SignupOnboardingWizard
        session={session}
        initialNickname={metaName}
        onComplete={() => {
          writeLocalOnboardingDone(session.user.id);
          setOnboardingDone(true);
          router.replace(HOME_PROJECTS_HREF);
        }}
      />
    );
  }

  return <>{children}</>;
}
