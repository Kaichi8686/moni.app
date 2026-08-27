"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  PROJECT_NAV_COACH,
  PROJECT_NAV_GROUPS,
  PROJECT_NAV_TOP,
  isNavGroupActive,
  isProjectNavActive,
  navGroupLabel,
  navGroupStorageKey,
  navItemLabel,
  type ProjectNavGroup,
  type ProjectNavItem,
} from "@/lib/projects/workspaceNav";

const COLLAPSE_KEY = "moni-project-workspace-nav-collapsed";

function NavLink({
  item,
  projectId,
  pathname,
  collapsed,
}: {
  item: ProjectNavItem;
  projectId: string;
  pathname: string | null;
  collapsed: boolean;
}) {
  const { locale } = useI18n();
  const href = item.href(projectId);
  const active = isProjectNavActive(pathname, href, item.id);
  const Icon = item.icon;
  const label = navItemLabel(item, locale);
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`project-sidebar-item ${active ? "is-active" : ""} ${collapsed ? "justify-center px-0" : "pl-8"}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

function NavGroupSection({
  group,
  projectId,
  pathname,
  collapsed,
  open,
  onToggle,
}: {
  group: ProjectNavGroup;
  projectId: string;
  pathname: string | null;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { locale } = useI18n();
  const groupActive = isNavGroupActive(pathname, projectId, group);

  if (collapsed) {
    return (
      <li className="project-sidebar-group-collapsed">
        {group.items.map((item) => (
          <NavLink key={item.id} item={item} projectId={projectId} pathname={pathname} collapsed />
        ))}
      </li>
    );
  }

  return (
    <li className="project-sidebar-group">
      <button
        type="button"
        onClick={onToggle}
        className={`project-sidebar-group-btn ${groupActive ? "has-active" : ""}`}
        aria-expanded={open}
      >
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden />
        <span className="truncate">{navGroupLabel(group, locale)}</span>
      </button>
      {open ? (
        <ul className="mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <li key={item.id}>
              <NavLink item={item} projectId={projectId} pathname={pathname} collapsed={false} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ProjectWorkspaceNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const { locale, tx } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const group of PROJECT_NAV_GROUPS) {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(navGroupStorageKey(group.id)) : null;
      const active = isNavGroupActive(pathname, projectId, group);
      initial[group.id] = stored === "0" ? false : stored === "1" ? true : active || group.id === "plan";
    }
    setOpenGroups(initial);
  }, [pathname, projectId]);

  const toggleGroup = useCallback((groupId: string) => {
    setOpenGroups((prev) => {
      const next = !prev[groupId];
      try {
        window.localStorage.setItem(navGroupStorageKey(groupId), next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return { ...prev, [groupId]: next };
    });
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const topHref = PROJECT_NAV_TOP.href(projectId);
  const topActive = isProjectNavActive(pathname, topHref, PROJECT_NAV_TOP.id);
  const TopIcon = PROJECT_NAV_TOP.icon;
  const coachHref = PROJECT_NAV_COACH.href(projectId);
  const coachActive = isProjectNavActive(pathname, coachHref, PROJECT_NAV_COACH.id);
  const CoachIcon = PROJECT_NAV_COACH.icon;

  const groupDividers = useMemo(
    () =>
      collapsed
        ? PROJECT_NAV_GROUPS.map((g, i) => (
            <NavGroupSection
              key={g.id}
              group={g}
              projectId={projectId}
              pathname={pathname}
              collapsed
              open={false}
              onToggle={() => {}}
            />
          ))
        : null,
    [collapsed, pathname, projectId],
  );

  return (
    <>
      <aside
        className={`project-sidebar hidden shrink-0 border-r border-[#E5E7EB] bg-[#FAFAFA] transition-[width] duration-200 ease-out md:block ${
          collapsed ? "w-[3.25rem]" : "w-[13.5rem]"
        }`}
        aria-label={tx("プロジェクトメニュー", "Project menu")}
      >
        <nav className="flex h-full flex-col px-2 py-3">
          <ul className="flex flex-1 flex-col gap-0.5">
            <li>
              <Link
                href={HOME_PROJECTS_HREF}
                title={collapsed ? tx("プロジェクト一覧", "All projects") : undefined}
                className={`project-sidebar-item text-[#5E6AD2] hover:bg-violet-50 ${collapsed ? "justify-center px-0" : ""}`}
              >
                <ArrowLeft className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                {!collapsed ? <span className="truncate font-semibold">{locale === "en" ? "All projects" : "プロジェクト一覧"}</span> : null}
              </Link>
            </li>
            <li className="project-sidebar-divider" aria-hidden />
            <li>
              <Link
                href={topHref}
                title={collapsed ? navItemLabel(PROJECT_NAV_TOP, locale) : undefined}
                className={`project-sidebar-item ${topActive ? "is-active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
                aria-current={topActive ? "page" : undefined}
              >
                <TopIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                {!collapsed ? <span className="truncate">{navItemLabel(PROJECT_NAV_TOP, locale)}</span> : null}
              </Link>
            </li>
            <li>
              <Link
                href={coachHref}
                title={collapsed ? navItemLabel(PROJECT_NAV_COACH, locale) : undefined}
                className={`project-sidebar-item ${coachActive ? "is-active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
                aria-current={coachActive ? "page" : undefined}
              >
                <CoachIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                {!collapsed ? <span className="truncate">{navItemLabel(PROJECT_NAV_COACH, locale)}</span> : null}
              </Link>
            </li>

            {collapsed ? (
              groupDividers
            ) : (
              <>
                <li className="project-sidebar-divider" aria-hidden />
                {PROJECT_NAV_GROUPS.map((group) => (
                  <NavGroupSection
                    key={group.id}
                    group={group}
                    projectId={projectId}
                    pathname={pathname}
                    collapsed={false}
                    open={openGroups[group.id] ?? true}
                    onToggle={() => toggleGroup(group.id)}
                  />
                ))}
              </>
            )}
          </ul>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`project-sidebar-toggle ${collapsed ? "justify-center" : ""}`}
            aria-label={collapsed ? tx("サイドバーを広げる", "Expand sidebar") : tx("サイドバーを狭める", "Collapse sidebar")}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed ? <span className="text-[12px]">{tx("狭める", "Collapse")}</span> : null}
          </button>
        </nav>
      </aside>
    </>
  );
}
