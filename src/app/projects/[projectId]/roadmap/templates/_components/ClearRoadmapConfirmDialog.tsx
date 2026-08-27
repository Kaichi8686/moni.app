"use client";

type Props = {
  open: boolean;
  phaseCount: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ClearRoadmapConfirmDialog({ open, phaseCount, busy, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-roadmap-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="clear-roadmap-title" className="text-base font-bold text-gray-900">
          ロードマップを削除しますか？
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          フェーズ {phaseCount} 件とフェーズ内のタスクを削除します。課題タブの課題は残ります。この操作は取り消せません。
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className="min-h-[44px] flex-1 rounded-xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? "削除中…" : "削除する"}
          </button>
        </div>
      </div>
    </div>
  );
}
