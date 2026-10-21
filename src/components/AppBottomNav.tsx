"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight, Home, ListTodo, Mail, Megaphone, Search, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { HOME_PROJECTS_HREF, resolveHomeProjectsHref } from "@/lib/navigation/homeProjects";
import {
  closeProjectCluster,
  enterProjectListMode,
  isInsideProjectWorkspace,
  markProjectClusterUnlocked,
  openProjectCluster,
  readProjectClusterUnlocked,
  readProjectListMode,
  readStoredProjectClusterOpen,
  subscribeProjectCluster,
  writeStoredProjectClusterOpen,
} from "@/lib/navigation/projectCluster";
import { fetchInboxUnreadCount } from "@/lib/messages/unreadCount";
import { supabase } from "@/lib/supabase";
import { LAST_PROJECT_CHANGE_EVENT, readLastProject } from "@/lib/workspace/lastProject";
import type { MessageKey } from "@/lib/i18n/messages";

function getClusterUnlockedSnapshot(): boolean {
  return readProjectClusterUnlocked();
}

function getListModeSnapshot(): boolean {
  return readProjectListMode();
}

function getServerFalseSnapshot(): boolean {
  return false;
}

type NavMatch = (pathname: string, tab: string | null, segment: string | null) => boolean;

type NavItem = {
  id: string;
  href: string;
  labelKey: MessageKey;
  icon: ReactNode;
  match: NavMatch;
  badgeKey?: "mail";
};

type ThumbState = { x: number; y: number; w: number; h: number; visible: boolean };

function isProjectIssuesPath(pathname: string): boolean {
  return /^\/projects\/[0-9a-f-]{36}\/issues(?:\/|$)/i.test(pathname);
}

function isProjectRecruitPath(pathname: string): boolean {
  return /^\/projects\/[0-9a-f-]{36}\/recruit(?:\/|$)/i.test(pathname);
}

function resolveProjectScopedHref(
  pathname: string,
  suffix: "issues" | "recruit",
  lastProjectId?: string | null,
): string {
  const fromPath = pathname.match(/^\/projects\/([0-9a-f-]{36})(?:\/|$)/i);
  if (fromPath?.[1]) return `/projects/${fromPath[1]}/${suffix}`;
  const lastId = lastProjectId ?? readLastProject()?.id ?? null;
  if (lastId) return `/projects/${lastId}/${suffix}`;
  return HOME_PROJECTS_HREF;
}

function resolveProjectIssuesHref(pathname: string, lastProjectId?: string | null): string {
  return resolveProjectScopedHref(pathname, "issues", lastProjectId);
}

function resolveProjectRecruitHref(pathname: string, lastProjectId?: string | null): string {
  return resolveProjectScopedHref(pathname, "recruit", lastProjectId);
}

function subscribeLastProject(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === "moni:lastProjectId" || e.key === "moni:lastProjectName") {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LAST_PROJECT_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LAST_PROJECT_CHANGE_EVENT, onStoreChange);
  };
}

function getLastProjectIdSnapshot(): string | null {
  return readLastProject()?.id ?? null;
}

function getLastProjectIdServerSnapshot(): string | null {
  return null;
}

const PROJECT_ITEM: NavItem = {
  id: "projects",
  href: HOME_PROJECTS_HREF,
  labelKey: "navProjects",
  icon: <Home className="app-bottom-nav-svg" strokeWidth={1.75} aria-hidden />,
  match: (p) => {
    if (p === "/projects") return true;
    const m = p.match(/^\/projects\/([0-9a-f-]{36})(?:\/(.*))?$/i);
    if (!m) return false;
    const rest = m[2] ?? "";
    // 課題・募集は開いたクラスタ側の専用タブ
    if (rest === "issues" || rest.startsWith("issues/")) return false;
    if (rest === "recruit" || rest.startsWith("recruit/")) return false;
    return true;
  },
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
    match: (p, tab) =>
      (p === "/" && tab === "chat") ||
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
    // href is resolved at render time via last/current project
    href: HOME_PROJECTS_HREF,
    labelKey: "navIdea",
    icon: <ListTodo className="app-bottom-nav-svg" strokeWidth={1.75} aria-hidden />,
    match: (p) => isProjectIssuesPath(p),
  },
  {
    id: "recruit",
    // href is resolved at render time via last/current project
    href: HOME_PROJECTS_HREF,
    labelKey: "navRecruit",
    icon: <Megaphone className="app-bottom-nav-svg" strokeWidth={1.75} aria-hidden />,
    match: (p) => isProjectRecruitPath(p),
  },
];

const PROFILE_ITEM: NavItem = {
  id: "profile",
  href: "/profile",
  labelKey: "navProfile",
  icon: "◉",
  match: (p) => p.startsWith("/profile"),
};

function measureThumb(container: HTMLElement | null): ThumbState {
  if (!container) return { x: 0, y: 0, w: 0, h: 0, visible: false };
  const active = container.querySelector<HTMLElement>(".app-bottom-nav-item.is-active");
  if (!active) return { x: 0, y: 0, w: 0, h: 0, visible: false };
  const rootRect = container.getBoundingClientRect();
  const itemRect = active.getBoundingClientRect();
  return {
    x: itemRect.left - rootRect.left + container.scrollLeft,
    y: itemRect.top - rootRect.top + container.scrollTop,
    w: itemRect.width,
    h: itemRect.height,
    visible: itemRect.width > 0 && itemRect.height > 0,
  };
}

function useSlidingThumb(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  activeKey: string | null,
  layoutKey: string | boolean,
) {
  const [thumb, setThumb] = useState<ThumbState>({ x: 0, y: 0, w: 0, h: 0, visible: false });
  const [ready, setReady] = useState(false);

  const update = useCallback(() => {
    if (!enabled) {
      setThumb((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    const next = measureThumb(containerRef.current);
    setThumb(next);
    if (next.visible) setReady(true);
  }, [containerRef, enabled]);

  useLayoutEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) update();
    };
    const raf = window.requestAnimationFrame(run);
    const timers = [60, 180, 320].map((ms) => window.setTimeout(run, ms));
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      for (const t of timers) window.clearTimeout(t);
    };
  }, [update, enabled, activeKey, layoutKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef, enabled, update]);

  return { thumb, ready };
}

function SlidingThumb({ thumb, ready }: { thumb: ThumbState; ready: boolean }) {
  return (
    <span
      className={`app-bottom-nav-thumb ${thumb.visible ? "is-visible" : ""} ${ready ? "is-ready" : ""}`}
      aria-hidden
      style={{
        width: thumb.w,
        height: thumb.h,
        transform: `translate(${thumb.x}px, ${thumb.y}px)`,
      }}
    />
  );
}

function NavLink({
  item,
  active,
  badgeCount,
  label,
  locale,
  className,
  href,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badgeCount: number;
  label: string;
  locale: string;
  className?: string;
  href?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href ?? item.href}
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
      data-nav-id={item.id}
      onClick={() => onNavigate?.()}
    >
      <span className="app-bottom-nav-item-icon" aria-hidden>
        {item.icon}
        {badgeCount > 0 ? (
          <span className="app-bottom-nav-badge">{badgeCount > 99 ? "99+" : badgeCount}</span>
        ) : null}
      </span>
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
  const [openPref, setOpenPref] = useState(() => readStoredProjectClusterOpen() ?? false);
  const [seenRouteKey, setSeenRouteKey] = useState("");
  const projectPillRef = useRef<HTMLDivElement>(null);
  const profilePillRef = useRef<HTMLDivElement>(null);
  const lastProjectId = useSyncExternalStore(
    subscribeLastProject,
    getLastProjectIdSnapshot,
    getLastProjectIdServerSnapshot,
  );
  const clusterUnlockedStored = useSyncExternalStore(
    subscribeProjectCluster,
    getClusterUnlockedSnapshot,
    getServerFalseSnapshot,
  );
  const listMode = useSyncExternalStore(
    subscribeProjectCluster,
    getListModeSnapshot,
    getServerFalseSnapshot,
  );

  const projectActive = PROJECT_ITEM.match(pathname, tab, segment);
  const insideProject = isInsideProjectWorkspace(pathname);
  const onProjectsList = pathname === "/projects" || pathname === "/projects/";
  const profileActive = PROFILE_ITEM.match(pathname, tab, segment);
  // 課題・募集は開いたクラスタ専用（閉じた側の AI / 探すとは別）
  const openOnlyActive = OPEN_TABS.some(
    (item) =>
      (item.id === "recruit" || item.id === "issues") && item.match(pathname, tab, segment),
  );
  /** 一覧モード中／未オープン時はクラスタ開けない＝矢印なし */
  const projectClusterUnlocked =
    !listMode && (clusterUnlockedStored || insideProject || openOnlyActive);

  const issuesHref = resolveProjectIssuesHref(pathname, lastProjectId);
  const recruitHref = resolveProjectRecruitHref(pathname, lastProjectId);
  /** プロジェクトブロックのメールは、そのプロジェクトのメンバー／グループに絞る */
  const projectMailHref = lastProjectId ? `/messages?project=${lastProjectId}` : "/messages";
  /** 一覧モード中はキューブへ。そうでなければ最後のプロジェクトへ */
  const projectsHomeHref = resolveHomeProjectsHref(lastProjectId, listMode);
  const messagesProjectParam = searchParams.get("project");
  const onMessagesPath = pathname === "/messages" || pathname.startsWith("/messages/");
  const routeKey = `${pathname}|${tab ?? ""}|${segment ?? ""}|${openOnlyActive ? "1" : "0"}|${listMode ? "L" : "P"}|${messagesProjectParam ?? ""}`;

  if (routeKey !== seenRouteKey) {
    setSeenRouteKey(routeKey);
    if (openOnlyActive || insideProject) {
      // 具体的なプロジェクト内にいるときだけホームブロックを伸ばす
      openProjectCluster();
      setOpenPref(true);
    } else if (onProjectsList || listMode) {
      // キューブ一覧：ブロック閉じ＋矢印なしを維持
      enterProjectListMode();
      setOpenPref(false);
    } else if (onMessagesPath && messagesProjectParam) {
      // プロジェクトブロックのメール
      openProjectCluster();
      setOpenPref(true);
    } else if (onMessagesPath || profileActive) {
      // プロフィール側メッセージ／プロフィール: プロフィールブロックを伸ばす
      closeProjectCluster();
      setOpenPref(false);
    } else {
      const stored = readStoredProjectClusterOpen();
      if (stored !== null) setOpenPref(stored);
    }
  }

  const clusterOpen = openPref && projectClusterUnlocked;
  const openSetActiveId =
    OPEN_TABS.find((item) => item.match(pathname, tab, segment))?.id ??
    (projectActive ? "projects" : null);
  const closedSetActiveId =
    CLOSED_TABS.find((item) => item.match(pathname, tab, segment))?.id ??
    (profileActive ? "profile" : null);

  const { thumb: projectThumb, ready: projectThumbReady } = useSlidingThumb(
    projectPillRef,
    clusterOpen || projectActive,
    openSetActiveId,
    clusterOpen,
  );
  const { thumb: profileThumb, ready: profileThumbReady } = useSlidingThumb(
    profilePillRef,
    !clusterOpen,
    closedSetActiveId,
    clusterOpen,
  );

  const setClusterOpen = useCallback((open: boolean) => {
    if (open) markProjectClusterUnlocked();
    setOpenPref(open);
    writeStoredProjectClusterOpen(open);
  }, []);

  const expandHomeBlock = useCallback(() => {
    // 一覧モード／未選択時はホーム＝キューブのみ（クラスタは開けない）
    if (readProjectListMode()) return;
    if (!readProjectClusterUnlocked() && !isInsideProjectWorkspace(pathname)) return;
    setClusterOpen(true);
  }, [pathname, setClusterOpen]);

  const expandProfileBlock = useCallback(() => {
    setClusterOpen(false);
  }, [setClusterOpen]);

  const toggleCluster = useCallback(() => {
    if (readProjectListMode()) return;
    if (!readProjectClusterUnlocked() && !isInsideProjectWorkspace(pathname)) return;
    setOpenPref((prev) => {
      const next = !prev;
      if (next) markProjectClusterUnlocked();
      writeStoredProjectClusterOpen(next);
      return next;
    });
  }, [pathname]);

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
    // Defer badge work so route first paint / WebGL isn't competing with unread counts.
    const run = () => {
      void refreshMailUnread();
    };
    const ric = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (ric.requestIdleCallback) {
      const idleId = ric.requestIdleCallback(run, { timeout: 2000 });
      return () => ric.cancelIdleCallback?.(idleId);
    }
    const timer = window.setTimeout(run, 200);
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
    }, 60000);

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
        href={
          item.id === "issues"
            ? issuesHref
            : item.id === "recruit"
              ? recruitHref
              : item.id === "mail" && clusterOpen
                ? projectMailHref
                : undefined
        }
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
          ref={projectPillRef}
          className={`app-bottom-nav-project-pill ${clusterOpen ? "is-expanded" : "is-collapsed"}`}
        >
          <SlidingThumb thumb={projectThumb} ready={projectThumbReady} />
          <div className={`app-bottom-nav-project-anchor ${projectActive ? "is-active" : ""}`}>
            <NavLink
              item={PROJECT_ITEM}
              active={projectActive}
              badgeCount={0}
              label={projectLabel}
              locale={locale}
              className="app-bottom-nav-item--project"
              href={projectsHomeHref}
              onNavigate={expandHomeBlock}
            />
            {!clusterOpen && projectClusterUnlocked ? (
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

          <div
            id="app-bottom-nav-open-tabs"
            className="app-bottom-nav-open-tabs"
            {...(!clusterOpen ? { inert: true } : {})}
          >
            {OPEN_TABS.map((item) => renderTab(item, "app-bottom-nav-item--extra"))}
          </div>

          <button
            type="button"
            className="app-bottom-nav-cluster-toggle is-collapse"
            aria-expanded={clusterOpen}
            aria-controls="app-bottom-nav-open-tabs"
            aria-label={collapseLabel}
            title={collapseLabel}
            onClick={toggleCluster}
            tabIndex={clusterOpen ? 0 : -1}
            {...(!clusterOpen ? { inert: true } : {})}
          >
            <ChevronLeft className="app-bottom-nav-cluster-chevron" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div
          ref={profilePillRef}
          className={`app-bottom-nav-profile-pill ${profileActive ? "has-profile-active" : ""}`}
        >
          <SlidingThumb thumb={profileThumb} ready={profileThumbReady} />
          <div className="app-bottom-nav-default-tabs" {...(clusterOpen ? { inert: true } : {})}>
            {CLOSED_TABS.map((item) => renderTab(item, "app-bottom-nav-item--default"))}
          </div>
          <div className={`app-bottom-nav-profile-slot ${profileActive ? "is-active" : ""}`}>
            <NavLink
              item={PROFILE_ITEM}
              active={profileActive}
              badgeCount={0}
              label={profileLabel}
              locale={locale}
              className="app-bottom-nav-item--profile"
              onNavigate={expandProfileBlock}
            />
          </div>
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
