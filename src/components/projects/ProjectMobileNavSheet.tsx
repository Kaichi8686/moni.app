"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, LayoutGrid, X } from "lucide-react";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  PROJECT_NAV_COACH,
  PROJECT_NAV_GROUPS,
  PROJECT_NAV_TOP,
  isProjectNavActive,
  navGroupLabel,
  navItemLabel,
} from "@/lib/projects/workspaceNav";

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
};

export function ProjectMobileNavSheet({ projectId, open, onClose }: Props) {
  const pathname = usePathname();
  const { locale, tx } = useI18n();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const topHref = PROJECT_NAV_TOP.href(projectId);
  const topActive = isProjectNavActive(pathname, topHref, PROJECT_NAV_TOP.id);
  const TopIcon = PROJECT_NAV_TOP.icon;
  const coachHref = PROJECT_NAV_COACH.href(projectId);
  const coachActive = isProjectNavActive(pathname, coachHref, PROJECT_NAV_COACH.id);
  const CoachIcon = PROJECT_NAV_COACH.icon;

  return (
    <div className="project-mobile-sheet-root md:hidden" role="presentation">
      <button
        type="button"
        className="project-mobile-sheet-backdrop"
        aria-label={tx("メニューを閉じる", "Close menu")}
        onClick={onClose}
      />
      <div className="project-mobile-sheet-panel" role="dialog" aria-modal="true" aria-label={tx("プロジェクトメニュー", "Project menu")}>
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-[#5E6AD2]" aria-hidden />
            <p className="text-[16px] font-semibold text-[#1A1A1A]">{tx("プロジェクトメニュー", "Project menu")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280]"
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="max-h-[min(70dvh,560px)] overflow-y-auto overscroll-contain px-3 py-3">
          <ul className="grid gap-1">
            <li>
              <Link
                href={HOME_PROJECTS_HREF}
                onClick={onClose}
                className="project-mobile-sheet-item border border-violet-200 bg-violet-50/80"
              >
                <span className="project-mobile-sheet-icon bg-violet-100 text-violet-700">
                  <ArrowLeft className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{tx("プロジェクト一覧", "All projects")}</span>
                </span>
              </Link>
            </li>
            <li>
              <Link
                href={topHref}
                onClick={onClose}
                className={`project-mobile-sheet-item ${topActive ? "is-active" : ""}`}
                aria-current={topActive ? "page" : undefined}
              >
                <span className="project-mobile-sheet-icon">
                  <TopIcon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{navItemLabel(PROJECT_NAV_TOP, locale)}</span>
                </span>
              </Link>
            </li>
            <li>
              <Link
                href={coachHref}
                onClick={onClose}
                className={`project-mobile-sheet-item ${coachActive ? "is-active" : "border border-violet-200 bg-violet-50/80"}`}
                aria-current={coachActive ? "page" : undefined}
              >
                <span className="project-mobile-sheet-icon bg-violet-100 text-violet-700">
                  <CoachIcon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{navItemLabel(PROJECT_NAV_COACH, locale)}</span>
                  <span className="mt-0.5 block text-[12px] font-normal text-[#6B7280]">
                    {tx("困ったときにすぐ相談", "Ask anytime you get stuck")}
                  </span>
                </span>
              </Link>
            </li>
          </ul>

          {PROJECT_NAV_GROUPS.map((group) => (
            <section key={group.id} className="mt-4">
              <p className="mb-1.5 px-2 text-[12px] font-bold tracking-wide text-[#9CA3AF]">{navGroupLabel(group, locale)}</p>
              <ul className="grid gap-1">
                {group.items.map((item) => {
                  const href = item.href(projectId);
                  const active = isProjectNavActive(pathname, href, item.id);
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <Link
                        href={href}
                        onClick={onClose}
                        className={`project-mobile-sheet-item ${active ? "is-active" : ""}`}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="project-mobile-sheet-icon">
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold">{navItemLabel(item, locale)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </div>
  );
}
