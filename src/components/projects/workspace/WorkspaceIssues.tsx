"use client";

import { FormEvent, useMemo, useState } from "react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { IssueList } from "@/components/issues/IssueList";
import { KanbanBoard } from "@/components/issues/KanbanBoard";
import { IssueModal } from "@/components/issues/IssueModal";
import { useWorkspaceUiStore } from "@/lib/workspace/store";
import type { Issue } from "@/lib/workspace/types";

export default function WorkspaceIssues() {
  const { issues, project, updateIssueStatus, createIssue, updateIssue, canEdit } = useProjectWorkspace();
  const createOpen = useWorkspaceUiStore((s) => s.createIssueOpen);
  const setCreateOpen = useWorkspaceUiStore((s) => s.setCreateIssueOpen);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selected, setSelected] = useState<Issue | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [createErr, setCreateErr] = useState("");

  const names = useMemo(() => {
    const m: Record<string, string> = {};
    for (const mem of project?.members ?? []) m[mem.id] = mem.name;
    return m;
  }, [project?.members]);

  function openCreate() {
    setCreateErr("");
    setDraftTitle("");
    setDraftDescription("");
    setCreateOpen(true);
  }

  async function onCreateIssue(e: FormEvent) {
    e.preventDefault();
    if (!draftTitle.trim()) return;
    setCreateErr("");
    try {
      await createIssue({
        title: draftTitle,
        description: draftDescription,
        status: "backlog",
        priority: "medium",
      });
      setDraftTitle("");
      setDraftDescription("");
      setCreateOpen(false);
    } catch (er) {
      setCreateErr(er instanceof Error ? er.message : "作成に失敗しました");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={view}
            onChange={(e) => setView(e.target.value as "list" | "kanban")}
            className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px]"
          >
            <option value="list">リスト</option>
            <option value="kanban">カンバン</option>
          </select>
          {canEdit ? (
            <button
              type="button"
              className="rounded-md bg-[#5E6AD2] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4F5BBD]"
              onClick={openCreate}
            >
              ＋ 課題を追加
            </button>
          ) : null}
          <span className="text-[11px] text-[#6B7280]">カンバンは左の「⠿」を掴んで列を移動</span>
        </div>
      </div>
      {view === "list" ? (
        <IssueList issues={issues} nameByUserId={names} onRowClick={(i) => setSelected(i)} />
      ) : (
        <KanbanBoard issues={issues} nameByUserId={names} onStatusChange={(id, s) => void updateIssueStatus(id, s)} onIssueOpen={(i) => setSelected(i)} />
      )}
      <IssueModal
        issue={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        assigneeName={selected?.assigneeId ? names[selected.assigneeId] : undefined}
        canEdit={canEdit}
        onSave={async (id, patch) => {
          await updateIssue(id, patch);
        }}
      />

      {createOpen && canEdit ? (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <form
            className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => void onCreateIssue(e)}
          >
            <h3 className="text-base font-semibold">課題を作成</h3>
            <label className="mt-3 block text-[12px] font-medium text-[#6B7280]" htmlFor="new-issue-title">
              タイトル
            </label>
            <input
              id="new-issue-title"
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-[15px] text-[#1A1A1A] outline-none ring-[#5E6AD2] focus:ring-2"
              placeholder="例: ユーザーインタビュー案を固める"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <label className="mt-3 block text-[12px] font-medium text-[#6B7280]" htmlFor="new-issue-desc">
              説明（任意）
            </label>
            <textarea
              id="new-issue-desc"
              className="mt-1 min-h-[6rem] w-full resize-y rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-[#5E6AD2] focus:ring-2"
              placeholder="内容やメモを書けます"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              rows={4}
            />
            {createErr ? <p className="mt-2 text-[13px] text-red-600">{createErr}</p> : null}
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
