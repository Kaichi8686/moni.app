"use client";

type Props = {
  ownerName: string;
  sfxMuted: boolean;
  onOwnerName: (v: string) => void;
  onToggleSfx: () => void;
  onClose: () => void;
};

export function SettingsScreen({
  ownerName,
  sfxMuted,
  onOwnerName,
  onToggleSfx,
  onClose,
}: Props) {
  return (
    <div className="space-y-3">
      <button type="button" className="text-sm font-bold text-[var(--ob-muted)]" onClick={onClose}>
        ← 戻る
      </button>
      <div className="ob-panel space-y-3 p-4">
        <p className="ob-title text-sm text-[var(--ob-gold)]">設定</p>
        <label className="block">
          <span className="text-xs font-bold text-[var(--ob-muted)]">社長の名前</span>
          <p className="mt-0.5 text-[11px] text-[var(--ob-accent)]">本名は使わないでね</p>
          <input
            value={ownerName}
            onChange={(e) => onOwnerName(e.target.value.slice(0, 12))}
            maxLength={12}
            className="mt-1 w-full rounded-xl border border-[var(--ob-border)] bg-transparent px-3 py-2 text-sm outline-none"
            style={{ color: "var(--ob-text)" }}
          />
        </label>
        <button type="button" className="ob-btn-ghost w-full text-left" onClick={onToggleSfx}>
          効果音: {sfxMuted ? "オフ" : "オン"}（タップで切替）
        </button>
      </div>
    </div>
  );
}
