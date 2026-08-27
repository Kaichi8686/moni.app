import type { LucideIcon } from "lucide-react";
import {
  CircleDot,
  FileText,
  GanttChartSquare,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  PenSquare,
  Radio,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

export type ProjectNavItem = {
  id: string;
  label: string;
  labelEn: string;
  href: (projectId: string) => string;
  icon: LucideIcon;
  /** スマホ下部タブに常時表示するか */
  mobilePrimary?: boolean;
};

export type ProjectNavGroup = {
  id: string;
  label: string;
  labelEn: string;
  items: ProjectNavItem[];
};

/** 常に上に表示 */
export const PROJECT_NAV_TOP: ProjectNavItem = {
  id: "overview",
  label: "概要",
  labelEn: "Overview",
  href: (id) => `/projects/${id}/overview`,
  icon: LayoutDashboard,
  mobilePrimary: true,
};

const NAV_ROADMAP: ProjectNavItem = {
  id: "roadmap",
  label: "ロードマップ",
  labelEn: "Roadmap",
  href: (id) => `/projects/${id}/roadmap`,
  icon: GanttChartSquare,
  mobilePrimary: true,
};

const NAV_ISSUES: ProjectNavItem = {
  id: "issues",
  label: "課題",
  labelEn: "Issues",
  href: (id) => `/projects/${id}/issues`,
  icon: CircleDot,
  mobilePrimary: true,
};

/** 概要の直下。スマホでもすぐ開けるように独立フォルダには置かない */
export const PROJECT_NAV_COACH: ProjectNavItem = {
  id: "coach",
  label: "相談AI",
  labelEn: "Ask AI",
  href: (id) => `/projects/${id}/coach`,
  icon: Sparkles,
  mobilePrimary: true,
};

const NAV_BUSINESS_IDEA: ProjectNavItem = {
  id: "business-idea",
  label: "ビジネスアイデア",
  labelEn: "Business idea",
  href: (id) => `/projects/${id}/business-idea`,
  icon: Search,
};

const NAV_IDEAS: ProjectNavItem = {
  id: "ideas",
  label: "投票",
  labelEn: "Vote",
  href: (id) => `/projects/${id}/ideas`,
  icon: Lightbulb,
  mobilePrimary: true,
};

const NAV_WHITEBOARD: ProjectNavItem = {
  id: "whiteboard",
  label: "ホワイトボード",
  labelEn: "Whiteboard",
  href: (id) => `/projects/${id}/whiteboard`,
  icon: PenSquare,
};

const NAV_DOCUMENTS: ProjectNavItem = {
  id: "documents",
  label: "ドキュメント",
  labelEn: "Docs",
  href: (id) => `/projects/${id}/documents`,
  icon: FileText,
};

const NAV_CHAT: ProjectNavItem = {
  id: "chat",
  label: "チャット",
  labelEn: "Chat",
  href: (id) => `/projects/${id}/chat`,
  icon: MessageSquare,
};

const NAV_ACTIVITY: ProjectNavItem = {
  id: "activity",
  label: "活動",
  labelEn: "Activity",
  href: (id) => `/projects/${id}/activity`,
  icon: Radio,
};

/** フォルダ分けされたサイドバー構成 */
export const PROJECT_NAV_GROUPS: ProjectNavGroup[] = [
  {
    id: "plan",
    label: "計画",
    labelEn: "Plan",
    items: [NAV_ROADMAP, NAV_ISSUES],
  },
  {
    id: "create",
    label: "ひらめき",
    labelEn: "Create",
    items: [NAV_BUSINESS_IDEA, NAV_IDEAS, NAV_WHITEBOARD],
  },
  {
    id: "docs",
    label: "資料",
    labelEn: "Files",
    items: [NAV_DOCUMENTS],
  },
  {
    id: "team",
    label: "チーム",
    labelEn: "Team",
    items: [NAV_CHAT],
  },
];

/** ヘッダー三メニュー用（サイドバーからは外す） */
export const PROJECT_HEADER_MENU_EXTRA: ProjectNavItem[] = [
  {
    id: "members",
    label: "メンバー",
    labelEn: "Members",
    href: (id) => `/projects/${id}/members`,
    icon: Users,
  },
  NAV_ACTIVITY,
];

/** フラット一覧（互換用） */
export const PROJECT_NAV_ITEMS: ProjectNavItem[] = [
  PROJECT_NAV_TOP,
  PROJECT_NAV_COACH,
  ...PROJECT_NAV_GROUPS.flatMap((g) => g.items),
];

export const MOBILE_PRIMARY_NAV = PROJECT_NAV_ITEMS.filter((item) => item.mobilePrimary);

export function isProjectNavActive(pathname: string | null, href: string, id: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (id === "roadmap" && pathname.startsWith(href)) return true;
  return pathname.startsWith(href + "/");
}

export function isNavGroupActive(pathname: string | null, projectId: string, group: ProjectNavGroup): boolean {
  return group.items.some((item) => isProjectNavActive(pathname, item.href(projectId), item.id));
}

export function isMobileMenuNavActive(pathname: string | null, projectId: string): boolean {
  return PROJECT_NAV_ITEMS.some(
    (item) => !item.mobilePrimary && isProjectNavActive(pathname, item.href(projectId), item.id),
  );
}

export function navGroupStorageKey(groupId: string) {
  return `moni-nav-group-open:${groupId}`;
}

export function navItemLabel(item: Pick<ProjectNavItem, "label" | "labelEn">, locale: "ja" | "en"): string {
  return locale === "en" ? item.labelEn : item.label;
}

export function navGroupLabel(group: Pick<ProjectNavGroup, "label" | "labelEn">, locale: "ja" | "en"): string {
  return locale === "en" ? group.labelEn : group.label;
}
