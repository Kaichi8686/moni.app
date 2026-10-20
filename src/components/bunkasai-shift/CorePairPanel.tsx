"use client";

import { useMemo, useState } from "react";
import { useBunkasaiShiftStore } from "@/lib/bunkasai-shift/store";

export function CorePairPanel() {
  const members = useBunkasaiShiftStore((s) => s.members);
  const coreMemberIds = useBunkasaiShiftStore((s) => s.coreMemberIds);
  const dependencies = useBunkasaiShiftStore((s) => s.dependencies);
  const toggleCore = useBunkasaiShiftStore((s) => s.toggleCore);
  const addDependency = useBunkasaiShiftStore((s) => s.addDependency);
  const removeDependency = useBunkasaiShiftStore((s) => s.removeDependency);
  const placeError = useBunkasaiShiftStore((s) => s.placeError);
  const clearPlaceError = useBunkasaiShiftStore((s) => s.clearPlaceError);

  const [who, setWho] = useState("");
  const [required, setRequired] = useState("");

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const alreadyWho = useMemo(
    () => new Set(dependencies.map((d) => d.memberId)),
    [dependencies],
  );

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
        <h3 className="text-lg font-semibold text-[var(--bs-ink)]">同伴必須</h3>
        <p className="mt-1 text-sm text-[var(--bs-muted)]">
          「この人」を入れるコマには、<strong>「いないとダメな人」も必ず</strong>入ります。
          逆は不要です（いないとダメな人だけならOK）。
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block flex-1 text-xs font-medium text-[var(--bs-muted)]">
          この人
          <select
            className="mt-1 w-full rounded-xl border border-[var(--bs-line)] bg-white px-3 py-2 text-sm text-[var(--bs-ink)]"
            value={who}
            onChange={(e) => setWho(e.target.value)}
          >
            <option value="">選択…</option>
            {members.map((m) => (
              <option
                key={m.id}
                value={m.id}
                disabled={m.id === required || alreadyWho.has(m.id)}
              >
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-1 text-xs font-medium text-[var(--bs-muted)]">
          いないとダメな人
          <select
            className="mt-1 w-full rounded-xl border border-[var(--bs-line)] bg-white px-3 py-2 text-sm text-[var(--bs-ink)]"
            value={required}
            onChange={(e) => setRequired(e.target.value)}
          >
            <option value="">選択…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id} disabled={m.id === who}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!who || !required || who === required}
          onClick={() => {
            addDependency(who, required);
            setWho("");
            setRequired("");
          }}
          className="rounded-xl bg-[var(--bs-ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          設定する
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
        {dependencies.length === 0 ? (
          <li className="text-sm text-[var(--bs-muted)]">同伴必須はまだありません</li>
        ) : (
          dependencies.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-[var(--bs-line)]"
            >
              <span className="font-medium text-[var(--bs-ink)]">
                {byId.get(d.memberId)?.name ?? "?"}
                <span className="mx-2 font-normal text-[var(--bs-muted)]">
                  には
                </span>
                {byId.get(d.requiresId)?.name ?? "?"}
                <span className="ml-1 font-normal text-[var(--bs-muted)]">
                  がいないとダメ
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeDependency(d.id)}
                className="shrink-0 text-xs font-medium text-red-700 hover:underline"
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
