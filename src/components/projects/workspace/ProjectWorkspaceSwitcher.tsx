"use client";

import { Check, ChevronDown, LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import { enterProjectListMode, openProjectCluster } from "@/lib/navigation/projectCluster";
import { PROJECT_ICON_BG, projectHashIndex } from "@/lib/projects/projectCardVisual";
import { loadMemberProjects, type MemberProjectLite } from "@/lib/projects/loadMemberProjects";
import { rememberLastProject } from "@/lib/workspace/lastProject";
import { supabase } from "@/lib/supabase";

type Props = {
  projectId: string;
  projectName: string;
  thumbnailUrl?: string | null;
  icon?: string | null;
};

function ProjectAvatar({
  name,
  thumbnailUrl,
  icon,
  projectId,
  size = 32,
}: {
  name: string;
  thumbnailUrl?: string | null;
  icon?: string | null;
  projectId: string;
  size?: number;
}) {
  const bg = PROJECT_ICON_BG[projectHashIndex(projectId, PROJECT_ICON_BG.length)];
  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote project thumbs; matches workspace img usage
      <img
        src={thumbnailUrl}
        alt=""
        className="shrink-0 rounded-full object-cover bg-zinc-100"
        style={{ width: size, height: size }}
      />
    );
  }
  if (icon?.trim()) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full text-[15px] ${bg}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {icon}
      </span>
    );
  }
  const initial = (name.trim().charAt(0) || "P").toUpperCase();
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ${bg}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function currentSegment(pathname: string | null, projectId: string): string {
  if (!pathname) return "overview";
  const prefix = `/projects/${projectId}/`;
  if (!pathname.startsWith(prefix)) return "overview";
  const rest = pathname.slice(prefix.length).split("/")[0] || "overview";
  return rest || "overview";
}

export function ProjectWorkspaceSwitcher({ projectId, projectName, thumbnailUrl, icon }: Props) {
  const { tx, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<MemberProjectLite[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) {
        setRows([]);
        return;
      }
      const list = await loadMemberProjects(uid);
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function switchTo(row: MemberProjectLite) {
    rememberLastProject(row.id, row.name);
    openProjectCluster();
    setOpen(false);
    if (row.id === projectId) return;
    const segment = currentSegment(pathname, projectId);
    router.push(`/projects/${row.id}/${segment}`);
  }

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-full">
      <button
        type="button"
        className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full py-0.5 pr-1.5 text-left transition hover:bg-zinc-100 active:bg-zinc-200/80"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <ProjectAvatar
          projectId={projectId}
          name={projectName}
          thumbnailUrl={thumbnailUrl}
          icon={icon}
          size={32}
        />
        <span className="min-w-0 truncate text-[15px] font-bold tracking-tight text-zinc-950 sm:text-[16px]">
          {projectName || tx("プロジェクト", "Project")}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label={locale === "ja" ? "プロジェクトを切り替え" : "Switch project"}
          className="absolute left-0 top-[calc(100%+6px)] z-[130] w-[min(18.5rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-xl"
        >
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            {tx("プロジェクト", "Projects")}
          </p>
          <div className="max-h-[min(50vh,20rem)] overflow-y-auto">
            {loading && rows.length === 0 ? (
              <p className="px-3 py-3 text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
            ) : null}
            {!loading && rows.length === 0 ? (
              <p className="px-3 py-3 text-sm text-zinc-500">
                {tx("参加中のプロジェクトはまだありません", "No projects yet")}
              </p>
            ) : null}
            {rows.map((row) => {
              const active = row.id === projectId;
              return (
                <button
                  key={row.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition ${
                    active ? "bg-zinc-100" : "hover:bg-zinc-50"
                  }`}
                  onClick={() => switchTo(row)}
                >
                  <ProjectAvatar
                    projectId={row.id}
                    name={row.name}
                    thumbnailUrl={row.thumbnail_url}
                    icon={row.icon}
                    size={30}
                  />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-zinc-900">
                    {row.name}
                  </span>
                  {active ? <Check className="h-4 w-4 shrink-0 text-zinc-800" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-1 border-t border-zinc-100 pt-1">
            <Link
              href={`${HOME_PROJECTS_HREF}?list=1`}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
              onClick={() => {
                enterProjectListMode();
                setOpen(false);
              }}
            >
              <LayoutGrid className="h-4 w-4 text-zinc-500" aria-hidden />
              {tx("一覧に戻る", "Back to list")}
            </Link>
            <Link
              href={`${HOME_PROJECTS_HREF}?list=1&create=1`}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
              onClick={() => {
                enterProjectListMode();
                setOpen(false);
              }}
            >
              <Plus className="h-4 w-4 text-zinc-500" aria-hidden />
              {tx("新しいプロジェクト", "New project")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
