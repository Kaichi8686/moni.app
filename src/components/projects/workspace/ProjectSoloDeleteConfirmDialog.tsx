"use client";

type Props = {
  open: boolean;
  projectName: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ProjectSoloDeleteConfirmDialog({
  open,
  projectName,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="solo-delete-project-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="solo-delete-project-title" className="text-base font-semibold text-[#1A1A1A]">
          プロジェクトを削除しますか？
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
          「{projectName}」を削除します。課題・ロードマップ・メンバー情報など、このプロジェクトのデータはすべて失われ、元に戻せません。
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-md border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#374151] hover:bg-[#F7F8F8] disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className="min-h-[44px] flex-1 rounded-md bg-rose-600 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? "削除中…" : "削除する"}
          </button>
        </div>
      </div>
    </div>
  );
}
