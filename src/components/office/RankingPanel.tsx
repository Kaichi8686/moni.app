"use client";

import { OFFICE_LEAGUE_META, parseOfficeLeagueId } from "@/lib/office/tiers";
import type { RankingRow } from "@/lib/office/types";

type Props = {
  rows: RankingRow[];
  meta: {
    seasonKey: string;
    leagueId: string;
    myRank: number | null;
    rankingEnabled: boolean;
  } | null;
  onToggle: (enabled: boolean) => void | Promise<void>;
};

export function RankingPanel({ rows, meta, onToggle }: Props) {
  const league = parseOfficeLeagueId(meta?.leagueId);
  const leagueMeta = OFFICE_LEAGUE_META[league];
  const n = rows.length;
  const promoteCut = Math.max(1, Math.ceil(n * 0.2));
  const demoteStart = Math.max(promoteCut + 1, n - Math.max(1, Math.ceil(n * 0.2)) + 1);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-zinc-500">
              {meta?.seasonKey ?? "—"} · {leagueMeta.crown} {leagueMeta.labelJa}
            </p>
            <h2 className="mt-1 text-lg font-bold text-zinc-900">今月の順位</h2>
            <p className="mt-1 text-sm text-zinc-500">
              あなたの順位:{" "}
              <span className="font-bold text-zinc-800">
                {meta?.myRank != null ? `#${meta.myRank}` : "—"}
              </span>
            </p>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-3">
          <div>
            <p className="text-sm font-bold text-zinc-900">のんびりモード</p>
            <p className="text-[12px] text-zinc-500">ONにするとランキングに載らないよ</p>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#FF9600]"
            checked={!(meta?.rankingEnabled ?? true)}
            onChange={(e) => void onToggle(!e.target.checked)}
          />
        </label>
      </div>

      {!(meta?.rankingEnabled ?? true) ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
          のんびりモード中。会社は育つけど順位表には出ないよ。
        </p>
      ) : (
        <ol className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {rows.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">まだ誰もいないよ</li>
          ) : (
            rows.map((row) => {
              const zone =
                row.rank <= promoteCut
                  ? "昇格ライン付近"
                  : row.rank >= demoteStart
                    ? "降格ライン付近"
                    : "中間";
              return (
                <li
                  key={row.userId}
                  className={`flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 ${
                    row.isMe ? "bg-amber-50/80" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-7 text-sm font-black tabular-nums text-zinc-500">
                      #{row.rank}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-zinc-900">
                        {row.companyName}
                        {row.isMe ? "（あなた）" : ""}
                      </p>
                      <p className="text-[11px] text-zinc-400">{zone}</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-zinc-800">
                    {row.revenue.toLocaleString("ja-JP")}
                  </p>
                </li>
              );
            })
          )}
        </ol>
      )}
    </section>
  );
}
