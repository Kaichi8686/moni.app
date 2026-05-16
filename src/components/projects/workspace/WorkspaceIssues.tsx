"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { IssueList } from "@/components/issues/IssueList";
import { KanbanBoard } from "@/components/issues/KanbanBoard";
import { IssueModal } from "@/components/issues/IssueModal";
import { useWorkspaceUiStore } from "@/lib/workspace/store";
import type { Issue } from "@/lib/workspace/types";

export default function WorkspaceIssues() {
  const { issues, project, updateIssueStatus, createIssue, canEdit } = useProjectWorkspace();
  const createOpen = useWorkspaceUiStore((s) => s.createIssueOpen);
  const setCreateOpen = useWorkspaceUiStore((s) => s.setCreateIssueOpen);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selected, setSelected] = useState<Issue | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const names = useMemo(() => {
    const m: Record<string, string> = {};
    for (const mem of project?.members ?? []) m[mem.id] = mem.name;
    return m;
  }, [project?.members]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && canEdit) {
        e.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, setCreateOpen]);

  async function onCreateIssue(e: FormEvent) {
    e.preventDefault();
    if (!draftTitle.trim()) return;
    try {
      await createIssue({ title: draftTitle, status: "backlog", priority: "medium" });
      setDraftTitle("");
      setCreateOpen(false);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select value={view} onChange={(e) => setView(e.target.value as "list" | "kanban")} className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px]">
            <option value="list">リスト</option>
            <option value="kanban">カンバン</option>
          </select>
          <span className="text-[11px] text-[#6B7280]">ショートカット: C で作成</span>
        </div>
      </div>
      {view === "list" ? (
        <IssueList issues={issues} nameByUserId={names} onRowClick={(i) => setSelected(i)} />
      ) : (
        <KanbanBoard issues={issues} nameByUserId={names} onStatusChange={(id, s) => void updateIssueStatus(id, s)} />
      )}
      <IssueModal issue={selected} open={Boolean(selected)} onClose={() => setSelected(null)} assigneeName={selected?.assigneeId ? names[selected.assigneeId] : undefined} />

      {createOpen && canEdit ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" onClick={() => setCreateOpen(false)}>
          <form className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void onCreateIssue(e)}>
            <h3 className="text-base font-semibold">課題を作成</h3>
            <input
              className="mt-3 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
              placeholder="タイトル"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm" onClick={() => setCreateOpen(false)}>
                キャンセル
              </button>
              <button type="submit" className="rounded-md bg-[#5E6AD2] px-3 py-1.5 text-sm font-semibold text-white">
                作成
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
