"use client";

import { DuoButton } from "@/components/idea-garden/DuoButton";
import { OFFICE_LEAGUE_META } from "@/lib/office/tiers";
import type { OfficeSeasonScore } from "@/lib/office/types";

type Props = {
  result: OfficeSeasonScore;
  onClose: () => void | Promise<void>;
};

export function SeasonResultModal({ result, onClose }: Props) {
  const meta = OFFICE_LEAGUE_META[result.leagueId];
  const headline =
    result.result === "promoted"
      ? "昇格おめでとう！"
      : result.result === "demoted"
        ? "残念、降格…"
        : "残留！よく頑張った";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="office-season-result-title"
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF9600]">
          {result.seasonKey} シーズン結果
        </p>
        <h2 id="office-season-result-title" className="mt-2 text-2xl font-black text-zinc-900">
          {headline}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          {meta.crown} {meta.labelJa} · 順位{" "}
          <span className="font-bold text-zinc-900">
            {result.rank != null ? `#${result.rank}` : "—"}
          </span>
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          今月の売上{" "}
          <span className="font-bold tabular-nums text-zinc-900">
            {result.revenue.toLocaleString("ja-JP")}
          </span>{" "}
          コイン
        </p>
        {result.result === "promoted" ? (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            称号更新！次のリーグでまた遊ぼう
          </p>
        ) : null}
        <div className="mt-5">
          <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={() => void onClose()}>
            とじる
          </DuoButton>
        </div>
      </div>
    </div>
  );
}
