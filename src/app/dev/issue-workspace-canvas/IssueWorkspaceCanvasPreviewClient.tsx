"use client";

import { useEffect, useState } from "react";
import { appendImageToBoard, IssueWorkspaceCanvas } from "@/components/projects/workspace/IssueWorkspaceCanvas";
import {
  defaultSheetTextStyle,
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
      w: 220,
      h: 150,
      color: "yellow",
      text: "",
      z: 1,
      ...defaultSheetTextStyle(),
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
      ...defaultSheetTextStyle(),
    },
    {
      id: "preview_arrow_ab",
      kind: "arrow",
      fromId: "preview_sheet_a",
      toId: "preview_sheet_b",
      color: "#52525B",
      z: 0,
    },
    {
      id: "preview_photo",
      kind: "image",
      x: 120,
      y: 320,
      w: 240,
      h: 180,
      url:
        "data:image/svg+xml," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="50%" stop-color="#a78bfa"/>
                <stop offset="100%" stop-color="#fb7185"/>
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#g)"/>
            <rect x="40" y="40" width="200" height="140" fill="#fef08a" stroke="#854d0e" stroke-width="6"/>
            <circle cx="480" cy="160" r="70" fill="#86efac" stroke="#166534" stroke-width="6"/>
            <text x="50%" y="78%" text-anchor="middle" font-size="42" font-family="sans-serif" fill="#0f172a">CROP ME</text>
            <text x="50%" y="90%" text-anchor="middle" font-size="24" font-family="sans-serif" fill="#1e293b">corners · edges · move</text>
          </svg>`,
        ),
      z: 3,
    },
    {
      id: "preview_text",
      kind: "text",
      x: 400,
      y: 340,
      w: 180,
      h: 80,
      text: "テキスト",
      fontSize: 18,
      textColor: "#1A1A1A",
      align: "left",
      z: 4,
    },
  ],
};

declare global {
  interface Window {
    __moniSetKbDemo?: (inset: number | null) => void;
  }
}

export function IssueWorkspaceCanvasPreviewClient() {
  const [board, setBoard] = useState<IssueWorkspaceBoard>(PREVIEW_BOARD);
  const [kbOn, setKbOn] = useState(false);

  useEffect(() => {
    // カード編集をすぐ開けるよう、黄カードを開いた状態で開始
    try {
      window.sessionStorage.setItem("moni:ws-open-sheet:dev-preview", "preview_sheet_a");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleKeyboardDemo() {
    const next = !kbOn;
    setKbOn(next);
    window.__moniSetKbDemo?.(next ? 320 : null);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-zinc-950">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-white">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">dev preview</p>
          <p className="text-sm font-semibold">カード中央 / キーボード持ち上げ</p>
        </div>
        <button
          type="button"
          data-kb-demo-toggle
          onClick={toggleKeyboardDemo}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            kbOn ? "bg-sky-400 text-zinc-950" : "bg-zinc-700 text-white"
          }`}
        >
          {kbOn ? "KB ON" : "KB 模す"}
        </button>
      </div>
      <div className="relative h-[min(844px,calc(100dvh-48px))] overflow-hidden bg-zinc-100">
        <IssueWorkspaceCanvas
          board={board}
          canEdit
          fullscreen
          storageKey="dev-preview"
          onChange={setBoard}
          onRequestPhoto={() => {
            void appendImageToBoard(
              board,
              "data:image/svg+xml," +
                encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="#fed7aa"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="22" fill="#9a3412">photo</text></svg>`,
                ),
            ).then(setBoard);
          }}
        />
      </div>
    </main>
  );
}
