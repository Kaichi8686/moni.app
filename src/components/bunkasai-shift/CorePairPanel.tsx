"use client";

import { useMemo, useState } from "react";
import { useBunkasaiShiftStore } from "@/lib/bunkasai-shift/store";

export function CorePairPanel() {
  const members = useBunkasaiShiftStore((s) => s.members);
  const coreMemberIds = useBunkasaiShiftStore((s) => s.coreMemberIds);
  const pairs = useBunkasaiShiftStore((s) => s.pairs);
  const toggleCore = useBunkasaiShiftStore((s) => s.toggleCore);
  const addPair = useBunkasaiShiftStore((s) => s.addPair);
  const removePair = useBunkasaiShiftStore((s) => s.removePair);
  const placeError = useBunkasaiShiftStore((s) => s.placeError);
  const clearPlaceError = useBunkasaiShiftStore((s) => s.clearPlaceError);

  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const pairedIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of pairs) {
      set.add(p.memberIds[0]);
      set.add(p.memberIds[1]);
    }
    return set;
  }, [pairs]);

  const unpaired = members.filter((m) => !pairedIds.has(m.id));

  return (
    <section className="space-y-5 rounded-2xl border border-[var(--bs-line)] bg-[var(--bs-soft)]/60 p-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--bs-ink)]">コアメンバー</h3>
        <p className="mt-1 text-sm text-[var(--bs-muted)]">
          選んだ人のうち、<strong>各時間帯にだれか1人以上</strong>必ず入ります。名簿は変わりません。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const on = coreMemberIds.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleCore(m.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                on
                  ? "bg-[var(--bs-accent)] text-white"
                  : "bg-white text-[var(--bs-ink-soft)] ring-1 ring-[var(--bs-line)]"
              }`}
            >
              {on ? "★ " : ""}
              {m.name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[var(--bs-muted)]">コア {coreMemberIds.length} 人</p>

      <div className="border-t border-[var(--bs-line)] pt-4">
        <h3 className="text-lg font-semibold text-[var(--bs-ink)]">ペアメンバー</h3>
        <p className="mt-1 text-sm text-[var(--bs-muted)]">
          選んだ2人は<strong>同じコマに同時</strong>に入ります（片方だけにはなりません）。
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block flex-1 text-xs font-medium text-[var(--bs-muted)]">
          メンバーA
          <select
            className="mt-1 w-full rounded-xl border border-[var(--bs-line)] bg-white px-3 py-2 text-sm text-[var(--bs-ink)]"
            value={pairA}
            onChange={(e) => setPairA(e.target.value)}
          >
            <option value="">選択…</option>
            {unpaired.map((m) => (
              <option key={m.id} value={m.id} disabled={m.id === pairB}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-1 text-xs font-medium text-[var(--bs-muted)]">
          メンバーB
          <select
            className="mt-1 w-full rounded-xl border border-[var(--bs-line)] bg-white px-3 py-2 text-sm text-[var(--bs-ink)]"
            value={pairB}
            onChange={(e) => setPairB(e.target.value)}
          >
            <option value="">選択…</option>
            {unpaired.map((m) => (
              <option key={m.id} value={m.id} disabled={m.id === pairA}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!pairA || !pairB || pairA === pairB}
          onClick={() => {
            addPair(pairA, pairB);
            setPairA("");
            setPairB("");
          }}
          className="rounded-xl bg-[var(--bs-ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          ペアにする
        </button>
      </div>

      {placeError ? (
        <div className="flex items-center justify-between gap-2 text-sm text-red-700">
          <span>{placeError}</span>
          <button type="button" className="text-xs underline" onClick={() => clearPlaceError()}>
            閉じる
          </button>
        </div>
      ) : null}

      <ul className="space-y-2">
        {pairs.length === 0 ? (
          <li className="text-sm text-[var(--bs-muted)]">ペアはまだありません</li>
        ) : (
          pairs.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-[var(--bs-line)]"
            >
              <span className="font-medium text-[var(--bs-ink)]">
                {byId.get(p.memberIds[0])?.name ?? "?"}
                <span className="mx-2 text-[var(--bs-muted)]">×</span>
                {byId.get(p.memberIds[1])?.name ?? "?"}
              </span>
              <button
                type="button"
                onClick={() => removePair(p.id)}
                className="text-xs font-medium text-red-700 hover:underline"
              >
                解除
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
