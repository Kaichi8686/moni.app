/** Shared tokens for the voting UI (Duo-like rounded surfaces). */
export const voteCard = "rounded-2xl border border-zinc-300 bg-white";
export const voteBtn =
  "inline-flex h-8 items-center justify-center gap-1 rounded-xl px-2.5 text-[12px] font-medium tracking-tight transition";
export const voteBtnPrimary = `${voteBtn} bg-zinc-900 text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35`;
export const voteBtnGhost = `${voteBtn} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`;
export const voteInput =
  "w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-900";
export const voteChip =
  "inline-flex h-6 items-center gap-1 rounded-xl border border-zinc-300 bg-white px-1.5 text-[11px] font-medium text-zinc-600";
export const voteChipActive =
  "inline-flex h-6 items-center gap-1 rounded-xl border border-zinc-900 bg-zinc-900 px-1.5 text-[11px] font-medium text-white";

/**
 * Apple 風 CTA（作成 / 投票するで共通サイズ）。
 * 下帯シャドウなし・カプセル・押下は opacity のみ。
 */
export const voteAppleBtn =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-[#FF9600] px-4 text-[17px] font-semibold tracking-tight text-white transition-opacity active:opacity-70 disabled:cursor-not-allowed disabled:opacity-45";

/** メッセージ上の投票カード内用（やや小さめ・作成/投票で幅を揃える） */
export const voteAppleBtnCompact =
  "mt-1 inline-flex h-10 w-full min-w-0 shrink-0 self-stretch items-center justify-center rounded-full bg-[#FF9600] px-3 text-[13px] font-semibold tracking-tight text-white transition-opacity active:opacity-70 disabled:opacity-45";
