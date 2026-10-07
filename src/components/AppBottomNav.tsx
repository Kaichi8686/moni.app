"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { FolderKanban, Lightbulb, Mail, Search, UserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import { fetchInboxUnreadCount } from "@/lib/messages/unreadCount";
import { supabase } from "@/lib/supabase";
import type { MessageKey } from "@/lib/i18n/messages";

type NavItem = {
  href: string;
  labelKey: MessageKey;
  icon: ReactNode;
  match: (pathname: string, tab: string | null) => boolean;
  badgeKey?: "mail";
};

const iconProps = { className: "app-bottom-nav-svg", strokeWidth: 1.85, "aria-hidden": true as const };

const NAV: NavItem[] = [
  {
    href: HOME_PROJECTS_HREF,
    labelKey: "navProjects",
    icon: <FolderKanban {...iconProps} />,
    match: (p) => p === "/projects" || /^\/projects\/[0-9a-f-]{36}/i.test(p),
  },
  {
    href: "/messages",
    labelKey: "navMail",
    icon: <Mail {...iconProps} />,
    match: (p) => p === "/messages" || p.startsWith("/messages/"),
    badgeKey: "mail",
  },
  {
    href: "/idea",
    labelKey: "navIdea",
    icon: <Lightbulb {...iconProps} />,
    match: (p) => p === "/idea" || p.startsWith("/idea/") || p === "/idea-interview",
  },
  {
    href: "/?tab=chat",
    labelKey: "navSearch",
    icon: <Search {...iconProps} />,
    match: (p, tab) => (p === "/" && tab === "chat") || p === "/discover" || p.startsWith("/discover/"),
  },
  {
    href: "/profile",
    labelKey: "navProfile",
    icon: <UserRound {...iconProps} />,
    match: (p) => p.startsWith("/profile"),
  },
];

function AppBottomNavInner({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const { t, locale } = useI18n();
  const [mailUnread, setMailUnread] = useState(0);

  const refreshMailUnread = useCallback(async () => {
    if (!supabase) {
      setMailUnread(0);
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) {
        setMailUnread(0);
        return;
      }
      const count = await fetchInboxUnreadCount(supabase, uid);
      setMailUnread(count);
    } catch {
      setMailUnread(0);
    }
  }, []);

  useEffect(() => {
    void refreshMailUnread();
  }, [refreshMailUnread, pathname]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const { data: sub } = client.auth.onAuthStateChange(() => {
      void refreshMailUnread();
    });

    const channel = client
      .channel("nav-mail-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void refreshMailUnread();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, () => {
        void refreshMailUnread();
      })
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshMailUnread();
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshMailUnread();
    }, 15000);

    return () => {
      sub.subscription.unsubscribe();
      void client.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(poll);
    };
  }, [refreshMailUnread]);

  return (
    <nav
      className={`app-bottom-nav ${className ?? ""}`.trim()}
      aria-label={locale === "ja" ? "メイン機能の切り替え" : "Main navigation"}
    >
      <div className="app-bottom-nav-inner">
        {NAV.map((item) => {
          const active = item.match(pathname, tab);
          const badgeCount = item.badgeKey === "mail" ? mailUnread : 0;
          const label = t(item.labelKey);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-bottom-nav-item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label={
                badgeCount > 0
                  ? locale === "ja"
                    ? `${label}、未読${badgeCount}件`
                    : `${label}, ${badgeCount} unread`
                  : label
              }
            >
              <span className="app-bottom-nav-item-icon" aria-hidden>
                {item.icon}
                {badgeCount > 0 ? (
                  <span className="app-bottom-nav-badge">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                ) : null}
              </span>
              <span className="app-bottom-nav-label">{label}</span>
              {active ? <span className="app-bottom-nav-indicator" aria-hidden /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppBottomNav({ className }: { className?: string }) {
  return (
    <Suspense fallback={<nav className={`app-bottom-nav ${className ?? ""}`.trim()} aria-hidden />}>
      <AppBottomNavInner className={className} />
    </Suspense>
  );
}
