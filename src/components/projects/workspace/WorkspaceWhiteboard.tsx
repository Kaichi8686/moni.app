"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { ProjectWhiteboard } from "@/components/projects/whiteboard/ProjectWhiteboard";
import { DocumentsHomeList } from "@/components/projects/workspace/DocumentsHomeList";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import {
  createProjectBoard,
  deleteProjectBoard,
  listProjectBoards,
  renameProjectBoard,
  type BoardSummary,
} from "@/lib/projects/whiteboard/boardApi";

function BoardIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <rect x="3" y="4" width="18" height="16" rx="2" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.4" />
      <path d="M7 15c1.2-2.2 2.2-3.2 3.4-3.2 1.4 0 1.6 2 3 2 1.1 0 2-1.2 3.2-3.2" fill="none" stroke="#7C3AED" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function nextBoardTitle(titles: string[]): string {
  const base = "無題のボード";
  const used = new Set(titles);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export default function WorkspaceWhiteboard() {
  const { projectId, loading, project, uid, canEdit, registerBackHandler } = useProjectWorkspace();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const userInitial = useMemo(() => {
    if (!uid) return "?";
    const name = project?.members?.find((member) => member.id === uid)?.name;
    return (name?.trim().charAt(0) || "?").toUpperCase();
  }, [project?.members, uid]);

  const openBoard = boards.find((board) => board.id === openId) ?? null;

  const loadBoards = useCallback(async () => {
    if (!projectId) return;
    setBoardsLoading(true);
    setError("");
    try {
      const rows = await listProjectBoards(projectId);
      setBoards(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ボードの読み込みに失敗しました");
    } finally {
      setBoardsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (loading || !projectId) return;
    void loadBoards();
  }, [loading, projectId, loadBoards]);

  const backToList = useCallback(() => {
    setOpenId(null);
    setSelectedId(null);
    void loadBoards();
    if (typeof window !== "undefined" && window.history.state?.moniBoard === "editor") {
      window.history.back();
    }
  }, [loadBoards]);

  useEffect(() => {
    const onPopState = () => setOpenId(null);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    registerBackHandler(() => {
      if (openId) {
        backToList();
        return true;
      }
      return false;
    });
    return () => registerBackHandler(null);
  }, [openId, registerBackHandler, backToList]);

  function openExisting(id: string) {
    const row = boards.find((board) => board.id === id);
    if (!row) return;
    setOpenId(id);
    setTitle(row.title);
    if (typeof window !== "undefined") {
      window.history.pushState({ moniBoard: "editor" }, "", window.location.href);
    }
  }

  async function createBoard() {
    setError("");
    if (!uid) {
      setError("ボードを作成するにはログインが必要です。");
      return;
    }
    if (!canEdit) {
      setError("ボードを作成する権限がありません。");
      return;
    }
    setCreating(true);
    try {
      const row = await createProjectBoard(projectId, uid, nextBoardTitle(boards.map((board) => board.title)));
      setBoards((prev) => [row, ...prev]);
      setOpenId(row.id);
      setTitle(row.title);
      if (typeof window !== "undefined") {
        window.history.pushState({ moniBoard: "editor" }, "", window.location.href);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ボードの作成に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  async function removeBoard(id: string) {
    setError("");
    try {
      await deleteProjectBoard(id);
      setBoards((prev) => prev.filter((board) => board.id !== id));
      setSelectedId(null);
      if (openId === id) setOpenId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  async function saveTitle() {
    if (!openId || !canEdit) return;
    const next = title.trim() || "無題のボード";
    if (openBoard && next === openBoard.title) return;
    try {
      await renameProjectBoard(openId, next);
      setTitle(next);
      setBoards((prev) => prev.map((board) => (board.id === openId ? { ...board, title: next } : board)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "名前の保存に失敗しました");
    }
  }

  if (loading || !project) return null;

  if (openId) {
    return (
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-medium text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <ChevronLeft className="h-5 w-5" />
            一覧
          </button>
          <input
            value={title}
            disabled={!canEdit}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(event) => {
              if (event.key === "Enter") (event.target as HTMLInputElement).blur();
            }}
            className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-lg font-medium text-[#202124] outline-none hover:bg-[#f8f9fa] focus:bg-[#f8f9fa]"
            aria-label="ボードの名前"
          />
        </div>
        {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
        <ProjectWhiteboard projectId={projectId} boardId={openId} uid={uid} canEdit={canEdit} />
      </div>
    );
  }

  return (
    <div>
      {error ? <p className="mb-2 text-[13px] text-red-600">{error}</p> : null}
      {boardsLoading ? (
        <p className="text-sm text-[#6B7280]">読み込み中…</p>
      ) : (
        <DocumentsHomeList
          documents={boards}
          canEdit={canEdit}
          docCreating={creating}
          userInitial={userInitial}
          selectedDocId={selectedId}
          onSelectDoc={setSelectedId}
          onOpen={openExisting}
          onCreate={() => void createBoard()}
          onDelete={(id) => void removeBoard(id)}
          heading="ホワイトボード"
          searchPlaceholder="ボードを検索"
          emptyLabel="ボードがありません"
          untitledLabel="無題のボード"
          noun="ボード"
          fabLabel="新しいボード"
          icon={BoardIcon}
          variant="library"
        />
      )}
    </div>
  );
}
