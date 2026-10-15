"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ListTodo, Mail, Megaphone, Search, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import { fetchInboxUnreadCount } from "@/lib/messages/unreadCount";
import { supabase } from "@/lib/supabase";
import type { MessageKey } from "@/lib/i18n/messages";

const CLUSTER_STORAGE_KEY = "moni.nav.projectClusterOpen";

type NavMatch = (pathname: string, tab: string | null, segment: string | null) => boolean;

type NavItem = {
  id: string;
  href: string;
  labelKey: MessageKey;
  icon: ReactNode;
  match: NavMatch;
  badgeKey?: "mail";
};

const PROJECT_ITEM: NavItem = {
  id: "projects",
  href: HOME_PROJECTS_HREF,
  labelKey: "navProjects",
  icon: "▦",
  match: (p) => p === "/projects" || /^\/projects\/[0-9a-f-]{36}/i.test(p),
};

/** Closed (default): same as before — Messages / AI / Find */
const CLOSED_TABS: NavItem[] = [
  {
    id: "mail",
    href: "/messages",
    labelKey: "navMail",
    icon: <Mail className="app-bottom-nav-svg" strokeWidth={1.75} aria-hidden />,
    match: (p) => p === "/messages" || p.startsWith("/messages/"),
    badgeKey: "mail",
  },
  {
    id: "ai",
    href: "/idea",
    labelKey: "navAi",
    icon: <Sparkles className="app-bottom-nav-svg" strokeWidth={1.75} aria-hidden />,
    match: (p) => p === "/idea" || p.startsWith("/idea/") || p === "/idea-interview",
  },
  {
    id: "search",
    href: "/?tab=chat",
    labelKey: "navSearch",
    icon: <Search className="app-bottom-nav-svg" strokeWidth={1.75} aria-hidden />,
    match: (p, tab, segment) =>
      (p === "/" && tab === "chat" && segment !== "recruit") ||
      p === "/discover" ||
      p.startsWith("/discover/"),
  },
];

/** Open (project cluster): Messages / Issues / Recruit — with proper marks */
const OPEN_TABS: NavItem[] = [
  {
    id: "mail",
    href: "/messages",
    labelKey: "navMail",
    icon: <Mail className="app-bottom-nav-svg" strokeWidth={1.75} aria-hidden />,
    match: (p) => p === "/messages" || p.startsWith("/messages/"),
    badgeKey: "mail",
  },
  {
    id: "issues",
    href: "/idea",
    labelKey: "navIdea",
    icon: <ListTodo className="app-bottom-nav-svg" strokeWidth={1.75} aria-hidden />,
    match: (p) => p === "/idea" || p.startsWith("/idea/") || p === "/idea-interview",
  },
  {
    id: "recruit",
    href: "/?tab=chat&segment=recruit",
    labelKey: "navRecruit",
    icon: <Megaphone className="app-bottom-nav-svg" strokeWidth={1.75} aria-hidden />,
    match: (p, tab, segment) => p === "/" && tab === "chat" && segment === "recruit",
  },
];

const PROFILE_ITEM: NavItem = {
  id: "profile",
  href: "/profile",
  labelKey: "navProfile",
  icon: "◉",
  match: (p) => p.startsWith("/profile"),
};

function readStoredClusterOpen(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CLUSTER_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredClusterOpen(open: boolean) {
  try {
    window.sessionStorage.setItem(CLUSTER_STORAGE_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function NavLink({
  item,
  active,
  badgeCount,
  label,
  locale,
  className,
}: {
  item: NavItem;
  active: boolean;
  badgeCount: number;
  label: string;
  locale: string;
  className?: string;
}) {
  return (
    <Link
      href={item.href}
      className={`app-bottom-nav-item ${active ? "is-active" : ""} ${className ?? ""}`.trim()}
      aria-current={active ? "page" : undefined}
      aria-label={
        badgeCount > 0
          ? locale === "ja"
            ? `${label}、未読${badgeCount}件`
            : `${label}, ${badgeCount} unread`
          : label
      }
      title={label}
    >
      <span className="app-bottom-nav-item-icon" aria-hidden>
        {item.icon}
        {badgeCount > 0 ? (
          <span className="app-bottom-nav-badge">{badgeCount > 99 ? "99+" : badgeCount}</span>
        ) : null}
      </span>
      {active ? <span className="app-bottom-nav-indicator" aria-hidden /> : null}
    </Link>
  );
}

function AppBottomNavInner({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const segment = searchParams.get("segment");
  const { t, locale } = useI18n();
  const [mailUnread, setMailUnread] = useState(0);
  const [openPref, setOpenPref] = useState(() => readStoredClusterOpen() ?? false);

  const projectActive = PROJECT_ITEM.match(pathname, tab, segment);
  const profileActive = PROFILE_ITEM.match(pathname, tab, segment);
  // Only 募集 is exclusive to the open set (課題 shares /idea with closed AI).
  const openOnlyActive = OPEN_TABS.some(
    (item) => item.id === "recruit" && item.match(pathname, tab, segment),
  );
  const routeKey = `${pathname}|${tab ?? ""}|${segment ?? ""}|${openOnlyActive ? "1" : "0"}`;
  const [seenRouteKey, setSeenRouteKey] = useState("");

  if (routeKey !== seenRouteKey) {
    setSeenRouteKey(routeKey);
    if (openOnlyActive) {
      setOpenPref(true);
    } else {
      const stored = readStoredClusterOpen();
      if (stored !== null) setOpenPref(stored);
    }
  }

  const clusterOpen = openPref;

  const toggleCluster = useCallback(() => {
    setOpenPref((prev) => {
      const next = !prev;
      writeStoredClusterOpen(next);
      return next;
    });
  }, []);

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
    const timer = window.setTimeout(() => {
      void refreshMailUnread();
    }, 0);
    return () => window.clearTimeout(timer);
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

  const projectLabel = t(PROJECT_ITEM.labelKey);
  const profileLabel = t(PROFILE_ITEM.labelKey);
  const expandLabel =
    locale === "ja" ? "メッセージ・課題・募集を表示" : "Show messages, issues, and recruiting";
  const collapseLabel =
    locale === "ja" ? "メッセージ・課題・募集を隠す" : "Hide messages, issues, and recruiting";

  const renderTab = (item: NavItem, className: string) => {
    const active = item.match(pathname, tab, segment);
    const badgeCount = item.badgeKey === "mail" ? mailUnread : 0;
    return (
      <NavLink
        key={item.id}
        item={item}
        active={active}
        badgeCount={badgeCount}
        label={t(item.labelKey)}
        locale={locale}
        className={className}
      />
    );
  };

  return (
    <nav
      className={`app-bottom-nav ${className ?? ""}`.trim()}
      aria-label={locale === "ja" ? "メイン機能の切り替え" : "Main navigation"}
    >
      <div className={`app-bottom-nav-inner ${clusterOpen ? "is-cluster-open" : "is-cluster-closed"}`}>
        <div
          className={`app-bottom-nav-pill ${clusterOpen ? "is-expanded" : "is-collapsed"}`}
        >
          <div className={`app-bottom-nav-project-anchor ${projectActive ? "is-active" : ""}`}>
            <NavLink
              item={PROJECT_ITEM}
              active={projectActive}
              badgeCount={0}
              label={projectLabel}
              locale={locale}
              className="app-bottom-nav-item--project"
            />
            {!clusterOpen ? (
              <button
                type="button"
                className={`app-bottom-nav-cluster-toggle is-expand ${
                  openOnlyActive ? "has-hidden-active" : ""
                }`}
                aria-expanded={false}
                aria-controls="app-bottom-nav-open-tabs"
                aria-label={expandLabel}
                title={expandLabel}
                onClick={toggleCluster}
              >
                <ChevronRight className="app-bottom-nav-cluster-chevron" strokeWidth={2.25} aria-hidden />
                {openOnlyActive ? <span className="app-bottom-nav-cluster-dot" aria-hidden /> : null}
              </button>
            ) : null}
          </div>

          {clusterOpen ? (
            <>
              <div id="app-bottom-nav-open-tabs" className="app-bottom-nav-open-tabs">
                {OPEN_TABS.map((item) => renderTab(item, "app-bottom-nav-item--extra"))}
              </div>
              <button
                type="button"
                className="app-bottom-nav-cluster-toggle is-collapse"
                aria-expanded={true}
                aria-controls="app-bottom-nav-open-tabs"
                aria-label={collapseLabel}
                title={collapseLabel}
                onClick={toggleCluster}
              >
                <ChevronLeft className="app-bottom-nav-cluster-chevron" strokeWidth={2.25} aria-hidden />
              </button>
            </>
          ) : (
            <div className="app-bottom-nav-default-tabs" role="presentation">
              {CLOSED_TABS.map((item) => renderTab(item, "app-bottom-nav-item--default"))}
            </div>
          )}
        </div>

        <div className={`app-bottom-nav-profile-orb ${profileActive ? "is-active" : ""}`}>
          <NavLink
            item={PROFILE_ITEM}
            active={profileActive}
            badgeCount={0}
            label={profileLabel}
            locale={locale}
            className="app-bottom-nav-item--profile"
          />
        </div>
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
