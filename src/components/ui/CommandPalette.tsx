"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Command } from "cmdk";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import { useWorkspaceUiStore } from "@/lib/workspace/store";

export function CommandPalette({ projectId }: { projectId?: string }) {
  const open = useWorkspaceUiStore((s) => s.commandOpen);
  const setOpen = useWorkspaceUiStore((s) => s.setCommandOpen);
  const setCreateIssue = useWorkspaceUiStore((s) => s.setCreateIssueOpen);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const base = projectId ? `/projects/${projectId}` : "";

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <Command
        className="w-full max-w-lg overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        label="コマンドメニュー"
      >
        <Command.Input
          placeholder="コマンドを検索…"
          className="w-full border-b border-[#E5E7EB] px-3 py-3 text-[14px] outline-none"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-2 py-3 text-sm text-[#6B7280]">該当なし</Command.Empty>
          <Command.Group heading="移動">
            <Command.Item
              className="cursor-pointer rounded-md px-2 py-2 text-[13px] text-[#1A1A1A] aria-selected:bg-[#F7F8F8]"
              onSelect={() => {
                router.push(HOME_PROJECTS_HREF);
                setOpen(false);
              }}
            >
              プロジェクト一覧
            </Command.Item>
            {projectId ? (
              <>
                <Command.Item
                  className="cursor-pointer rounded-md px-2 py-2 text-[13px] aria-selected:bg-[#F7F8F8]"
                  onSelect={() => {
                    router.push(`${base}/roadmap`);
                    setOpen(false);
                  }}
                >
                  ロードマップを開く
                </Command.Item>
                <Command.Item
                  className="cursor-pointer rounded-md px-2 py-2 text-[13px] aria-selected:bg-[#F7F8F8]"
                  onSelect={() => {
                    router.push(`${base}/issues`);
                    setOpen(false);
                  }}
                >
                  課題一覧を開く
                </Command.Item>
                <Command.Item
                  className="cursor-pointer rounded-md px-2 py-2 text-[13px] aria-selected:bg-[#F7F8F8]"
                  onSelect={() => {
                    router.push(`${base}/overview`);
                    setOpen(false);
                  }}
                >
                  概要を開く
                </Command.Item>
              </>
            ) : null}
          </Command.Group>
          <Command.Group heading="作成">
            <Command.Item
              className="cursor-pointer rounded-md px-2 py-2 text-[13px] aria-selected:bg-[#F7F8F8]"
              onSelect={() => {
                if (pathname?.includes("/issues")) setCreateIssue(true);
                setOpen(false);
              }}
            >
              課題を作成（課題タブで有効）
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
