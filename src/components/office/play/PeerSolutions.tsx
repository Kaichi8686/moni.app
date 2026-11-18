"use client";

import { useEffect, useState } from "react";
import type { PeerSolution } from "@/lib/office/peers";
import type { OfficeSceneId } from "@/lib/office/scenes";
import type { IncidentType } from "@/lib/office/types";

type Props = {
  scene: OfficeSceneId;
  type: IncidentType;
  fetchPeers: (scene: OfficeSceneId, type: IncidentType) => Promise<PeerSolution[]>;
  onVote: (id: string) => Promise<PeerSolution[]>;
  onReport: (id: string) => Promise<PeerSolution[]>;
};

export function PeerSolutions({ scene, type, fetchPeers, onVote, onReport }: Props) {
  const [peers, setPeers] = useState<PeerSolution[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPeers(scene, type);
        if (!cancelled) {
          setPeers(list);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "取得失敗");
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scene, type, fetchPeers]);

  if (!loaded) {
    return (
      <p className="text-center text-xs font-medium text-zinc-400">みんなの解決策を探してる…</p>
    );
  }

  if (!peers.length) {
    return (
      <p className="text-center text-xs font-medium text-zinc-400">
        まだシェアされた解決策はないよ
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-zinc-400">みんなの解決策</p>
      {err ? <p className="text-xs font-semibold text-rose-600">{err}</p> : null}
      <ul className="space-y-2">
        {peers.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl border border-zinc-100 bg-white/90 px-3 py-2.5 shadow-sm"
          >
            {p.strategyTitle ? (
              <p className="text-[10px] font-bold text-amber-700">{p.strategyTitle}</p>
            ) : null}
            <p className="mt-0.5 text-sm leading-snug text-zinc-700">{p.answer}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] font-bold tabular-nums text-zinc-500">
                {p.scoreTotal}点 · ♡ {p.voteCount}
              </span>
              <button
                type="button"
                disabled={p.votedByMe || busyId === p.id}
                onClick={() => {
                  setBusyId(p.id);
                  setErr("");
                  void onVote(p.id)
                    .then(setPeers)
                    .catch((e) => setErr(e instanceof Error ? e.message : "投票失敗"))
                    .finally(() => setBusyId(null));
                }}
                className="ml-auto rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900 ring-1 ring-amber-100 disabled:opacity-40"
              >
                {p.votedByMe ? "投票済" : "いいね"}
              </button>
              <button
                type="button"
                disabled={p.reportedByMe || busyId === p.id}
                onClick={() => {
                  setBusyId(p.id);
                  setErr("");
                  void onReport(p.id)
                    .then(setPeers)
                    .catch((e) => setErr(e instanceof Error ? e.message : "通報失敗"))
                    .finally(() => setBusyId(null));
                }}
                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:text-rose-600 disabled:opacity-40"
              >
                {p.reportedByMe ? "通報済" : "通報"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
