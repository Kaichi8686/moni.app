"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { QnABoard } from "@/components/qna/QnABoard";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

function formatRelativeTime(iso: string, locale: "ja" | "en") {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60_000));
    if (mins < 1) return locale === "en" ? "just now" : "たった今";
    if (mins < 60) return locale === "en" ? `${mins}m` : `${mins}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return locale === "en" ? `${hours}h` : `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return locale === "en" ? `${days}d` : `${days}日前`;
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", {
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function IdeaQnAPanel({ active }: { active: boolean }) {
  const { tx, locale } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [focusToken, setFocusToken] = useState(0);
  const [prefillTitle, setPrefillTitle] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem("moni.qna.prefill.v1");
      if (!raw) return;
      sessionStorage.removeItem("moni.qna.prefill.v1");
      const parsed = JSON.parse(raw) as { title?: string; focus?: boolean };
      if (parsed.title?.trim()) setPrefillTitle(parsed.title.trim());
      if (parsed.focus) setFocusToken((n) => n + 1);
    } catch {
      /* ignore */
    }
  }, [active]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!supabase) {
        setReady(true);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const next = data.session ?? null;
      setSession(next);
      if (next?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name,avatar_url")
          .eq("id", next.user.id)
          .maybeSingle();
        if (cancelled) return;
        setDisplayName(
          ((profile?.display_name as string | null)?.trim() ||
            next.user.email?.split("@")[0] ||
            "") as string,
        );
        setAvatarUrl((profile?.avatar_url as string | null) ?? null);
      } else {
        setDisplayName("");
        setAvatarUrl(null);
      }
      setReady(true);
    })();

    if (!supabase) return () => {
      cancelled = true;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const formatTime = useCallback(
    (iso: string) => formatRelativeTime(iso, locale === "en" ? "en" : "ja"),
    [locale],
  );

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
        {tx("読み込み中…", "Loading…")}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
            {tx("質問・相談", "Q&A")}
          </h2>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            {tx("困りごとを聞いて、知恵を分け合う場所", "Ask and share advice")}
          </p>
        </div>
        {session ? (
          <button
            type="button"
            className="inline-flex min-h-[36px] shrink-0 touch-manipulation items-center rounded-md bg-zinc-950 px-3.5 text-[13px] font-semibold tracking-[-0.02em] text-white transition hover:bg-zinc-800"
            onClick={() => setFocusToken((n) => n + 1)}
          >
            {tx("＋ 質問", "+ Ask")}
          </button>
        ) : null}
      </div>

      {authMessage ? (
        <p className="mx-4 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">{authMessage}</p>
      ) : null}

      <QnABoard
        session={session}
        displayName={displayName}
        avatarUrl={avatarUrl}
        prefillTitle={prefillTitle}
        onPrefillConsumed={() => setPrefillTitle("")}
        focusToken={focusToken}
        onAuthMessage={setAuthMessage}
        formatTime={formatTime}
        active={active}
      />
    </div>
  );
}
