"use client";

import { useState } from "react";
import { appendImageToBoard, IssueWorkspaceCanvas } from "@/components/projects/workspace/IssueWorkspaceCanvas";
import {
  createEmptyBoard,
  type IssueWorkspaceBoard,
} from "@/lib/workspace/issueWorkspaceBoard";

const PREVIEW_BOARD: IssueWorkspaceBoard = {
  v: 1,
  items: [
    {
      id: "preview_sheet_a",
      kind: "sheet",
      x: 80,
      y: 100,
      w: 200,
      h: 160,
      color: "yellow",
      text: "アイデアをメモ",
      z: 1,
    },
    {
      id: "preview_sheet_b",
      kind: "sheet",
      x: 360,
      y: 140,
      w: 200,
      h: 160,
      color: "sky",
      text: "次にやること",
      z: 2,
    },
    {
      id: "preview_arrow_ab",
      kind: "arrow",
      fromId: "preview_sheet_a",
      toId: "preview_sheet_b",
      color: "#52525B",
      z: 0,
    },
  ],
};

export function IssueWorkspaceCanvasPreviewClient() {
  const [board, setBoard] = useState<IssueWorkspaceBoard>(PREVIEW_BOARD);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 bg-white p-4 md:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">dev preview</p>
        <h1 className="text-2xl font-bold text-zinc-950">課題作業スペース（フリーキャンバス）</h1>
        <p className="mt-1 text-sm text-zinc-600">用紙・写真・矢印の操作確認用</p>
      </div>
      <IssueWorkspaceCanvas
        board={board}
        canEdit
        onChange={setBoard}
        onRequestPhoto={() => {
          setBoard((prev) =>
            appendImageToBoard(
              prev,
              "data:image/svg+xml," +
                encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="100%" height="100%" fill="#fed7aa"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="22" fill="#9a3412">photo</text></svg>`,
                ),
            ),
          );
        }}
      />
      <button
        type="button"
        className="self-start rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700"
        onClick={() => setBoard(createEmptyBoard())}
      >
        クリア
      </button>
    </main>
  );
}
