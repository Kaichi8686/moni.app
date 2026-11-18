"use client";

import { MOOD_LABEL_JA, type OfficeMood } from "@/lib/office/build/mood";

type Row = {
  place: number;
  name: string;
  revenue: number;
  mood: OfficeMood;
};

type Props = {
  mode: "daily" | "season";
  rows: Row[];
  onMode: (m: "daily" | "season") => void;
  onClose: () => void;
};

const MOOD_DOT: Record<OfficeMood, string> = {
  great: "#ffd27a",
  good: "#5eead4",
  low: "#8a93a8",
  crisis: "#ff6b6b",
};

export function RankingScreen({ mode, rows, onMode, onClose }: Props) {
  return (
    <div className="space-y-3">
      <button type="button" className="text-sm font-bold text-[var(--ob-muted)]" onClick={onClose}>
        ← 戻る
      </button>
      <div className="flex gap-2">
        <button
          type="button"
          className={mode === "daily" ? "ob-btn flex-1" : "ob-btn-ghost flex-1"}
          onClick={() => onMode("daily")}
        >
          今日
        </button>
        <button
          type="button"
          className={mode === "season" ? "ob-btn flex-1" : "ob-btn-ghost flex-1"}
          onClick={() => onMode("season")}
        >
          月間
        </button>
      </div>
      <div className="ob-panel p-4">
        <p className="ob-title text-sm text-[var(--ob-gold)]">
          {mode === "daily" ? "デイリー順位" : "月間リーグ"}
        </p>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ob-muted)]">まだ記録がないよ</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((r) => (
              <li key={r.place + r.name} className="flex items-center gap-2 text-sm">
                <span className="ob-num w-6 font-bold text-[var(--ob-muted)]">{r.place}</span>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: MOOD_DOT[r.mood] }}
                  title={MOOD_LABEL_JA[r.mood]}
                />
                <span className="min-w-0 flex-1 truncate font-bold">{r.name}</span>
                <span className="ob-num text-[var(--ob-gold)]">
                  {r.revenue.toLocaleString("ja-JP")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
