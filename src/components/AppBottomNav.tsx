"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import type { MessageKey } from "@/lib/i18n/messages";

type NavItem = {
  href: string;
  labelKey: MessageKey;
  icon: string;
  match: (pathname: string, tab: string | null) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/?tab=posts",
    labelKey: "navHome",
    icon: "⌂",
    match: (p, tab) => p === "/" && tab !== "chat",
  },
  {
    href: HOME_PROJECTS_HREF,
    labelKey: "navProjects",
    icon: "▦",
    match: (p) => p === "/projects" || /^\/projects\/[0-9a-f-]{36}/i.test(p),
  },
  {
    href: "/idea",
    labelKey: "navIdea",
    icon: "✦",
    match: (p) => p === "/idea" || p.startsWith("/idea/") || p === "/idea-interview",
  },
  {
    href: "/?tab=chat",
    labelKey: "navSearch",
    icon: "⌕",
    match: (p, tab) => (p === "/" && tab === "chat") || p === "/discover" || p.startsWith("/discover/"),
  },
  {
    href: "/profile",
    labelKey: "navProfile",
    icon: "◉",
    match: (p) => p.startsWith("/profile"),
  },
];

function AppBottomNavInner({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const { t, locale } = useI18n();

  return (
    <nav
      className={`app-bottom-nav ${className ?? ""}`.trim()}
      aria-label={locale === "ja" ? "メイン機能の切り替え" : "Main navigation"}
    >
      <div className="app-bottom-nav-inner">
        {NAV.map((item) => {
          const active = item.match(pathname, tab);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-bottom-nav-item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="app-bottom-nav-item-icon" aria-hidden>
                {item.icon}
              </span>
              <span className="max-w-[5rem] whitespace-normal break-keep text-center text-[11px] leading-tight sm:text-[12px]">
                {t(item.labelKey)}
              </span>
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
