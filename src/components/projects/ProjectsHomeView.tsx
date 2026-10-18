"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { ProjectTabGlide, type AppFeatureKey } from "@/components/projects/ProjectTabGlide";
import { ProjectNoticeBell } from "@/components/projects/ProjectNoticeBell";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { loadMemberProjects } from "@/lib/projects/loadMemberProjects";
import { supabase } from "@/lib/supabase";
import { readLastProject, rememberLastProject } from "@/lib/workspace/lastProject";

function ProjectsHomeViewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tx } = useI18n();
  /** キューブ一覧を明示表示（スイッチャー「すべてのプロジェクト」など） */
  const forceList = searchParams.get("list") === "1";
  const startCreate = searchParams.get("create") === "1";
  const [hasSession, setHasSession] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  /**
   * 一度プロジェクトを開いたあとは /projects に戻ってもキューブではなく
   * 最後のプロジェクトへ飛ばす。?list=1 のときだけキューブ一覧。
   */
  const [resolving, setResolving] = useState(!forceList);

  useEffect(() => {
    let cancelled = false;

    const showList = () => {
      if (!cancelled) setResolving(false);
    };

    const applySession = (session: { user: { id: string; email?: string | null } } | null) => {
      if (cancelled) return;
      setHasSession(Boolean(session));
      setUserId(session?.user.id ?? null);
    };

    if (forceList) {
      if (!supabase) {
        const t = window.setTimeout(showList, 0);
        return () => {
          cancelled = true;
          window.clearTimeout(t);
        };
      }
      const client = supabase;
      void client.auth.getSession().then(({ data }) => applySession(data.session));
      const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
        applySession(session);
      });
      const t = window.setTimeout(showList, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
        sub.subscription.unsubscribe();
      };
    }

    if (!supabase) {
      const t = window.setTimeout(showList, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }

    const client = supabase;

    void (async () => {
      const { data } = await client.auth.getSession();
      if (cancelled) return;
      const session = data.session;
      applySession(session);
      const uid = session?.user.id;
      if (!uid) {
        // 未ログインはキューブ／空状態を出す
        showList();
        return;
      }

      try {
        const last = readLastProject();
        const rows = await loadMemberProjects(uid);
        if (cancelled) return;

        // 最後に開いたプロジェクトがまだ参加中ならそこへ（他タブから戻ってもキューブに戻さない）
        if (last?.id && rows.some((r) => r.id === last.id)) {
          router.replace(`/projects/${last.id}/overview`);
          return;
        }

        // まだ一度も開いていない／無効な last → キューブ一覧
        // （参加プロジェクトがあっても、最初はキューブから選ばせる）
        if (!last?.id) {
          showList();
          return;
        }

        // last が無効なら先頭へ寄せて記憶を直し、次回から戻れるようにする
        const first = rows[0];
        if (first) {
          rememberLastProject(first.id, first.name);
          router.replace(`/projects/${first.id}/overview`);
          return;
        }
        showList();
      } catch {
        showList();
      }
    })();

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [forceList, router]);

  function onNavigate(key: AppFeatureKey) {
    if (key === "projects") return;
    if (key === "account") {
      router.push("/profile");
      return;
    }
    if (key === "chat") {
      router.push("/?tab=chat");
      return;
    }
    router.push(`/?tab=${key}`);
  }

  if (resolving) {
    return (
      <div
        id="moni-app"
        className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-white pt-[env(safe-area-inset-top,0px)] text-zinc-500"
      >
        <p className="text-sm font-medium">{tx("プロジェクトを開いています…", "Opening project…")}</p>
      </div>
    );
  }

  return (
    <div
      id="moni-app"
      className="relative flex min-h-[100dvh] flex-col bg-white pt-[env(safe-area-inset-top,0px)] text-zinc-900 antialiased"
    >
      <div className="relative mx-auto flex w-full max-w-none flex-1 flex-col pb-bottom-nav">
        <AppBrandHeader
          right={
            !hasSession ? (
              <Link
                href="/login"
                className="inline-flex min-h-[40px] shrink-0 touch-manipulation items-center rounded-lg border border-zinc-900 bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                {tx("ログイン", "Log in")}
              </Link>
            ) : (
              <ProjectNoticeBell
                userId={userId}
                onAccepted={() => setListRefreshKey((k) => k + 1)}
              />
            )
          }
        />

        <main className="flex min-h-0 flex-1 flex-col">
          <ProjectTabGlide
            hasSession={hasSession}
            userId={userId}
            onNavigate={onNavigate}
            fillViewport
            reloadSignal={listRefreshKey}
            startCreate={startCreate}
          />
        </main>
      </div>
    </div>
  );
}

export function ProjectsHomeView() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-white text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <ProjectsHomeViewInner />
    </Suspense>
  );
}
