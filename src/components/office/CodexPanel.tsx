"use client";

import { OFFICE_SCENES } from "@/lib/office/scenes";
import {
  CODEX_TYPE_LABEL_JA,
  CODEX_TYPES,
  codexProgress,
  findCodexCell,
  sceneLabel,
  type CodexCell,
} from "@/lib/office/codex";

type Props = {
  cells: CodexCell[];
  onClose: () => void;
};

export function CodexPanel({ cells, onClose }: Props) {
  const progress = codexProgress(cells);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-bold text-zinc-600 hover:text-zinc-900"
        >
          ← オフィスに戻る
        </button>
        <p className="text-xs font-bold tabular-nums text-amber-800">
          図鑑 {progress.label}
        </p>
      </div>

      <section className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm">
        <div className="border-b border-amber-50 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
          <h2 className="text-lg font-black text-zinc-900">事件図鑑</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            場面×タイプを初クリアすると解放。全部埋めるとコンプリートボーナス。
          </p>
        </div>

        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-[20rem] border-separate border-spacing-1 text-center">
            <thead>
              <tr>
                <th className="w-16 p-1 text-[10px] font-bold text-zinc-400">場面</th>
                {CODEX_TYPES.map((t) => (
                  <th key={t} className="p-1 text-[10px] font-bold text-zinc-500">
                    {CODEX_TYPE_LABEL_JA[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OFFICE_SCENES.map((scene) => (
                <tr key={scene}>
                  <th className="truncate p-1 text-left text-[10px] font-bold text-zinc-600">
                    {sceneLabel(scene)}
                  </th>
                  {CODEX_TYPES.map((type) => {
                    const cell = findCodexCell(cells, scene, type);
                    return (
                      <td key={`${scene}-${type}`} className="p-1">
                        <div
                          className={`flex h-9 items-center justify-center rounded-lg text-[11px] font-bold ${
                            cell
                              ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                              : "bg-zinc-50 text-zinc-300 ring-1 ring-zinc-100"
                          }`}
                          title={
                            cell
                              ? `ベスト ${cell.bestScore}`
                              : "未クリア"
                          }
                        >
                          {cell ? cell.bestScore : "？"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
