"use client";

import { useMemo, useState } from "react";
import { canPlaceInSlot, loadStats } from "@/lib/bunkasai-shift/assign";
import { SLOTS, formatSlotTitle, slotsForDay } from "@/lib/bunkasai-shift/schedule";
import { useBunkasaiShiftStore } from "@/lib/bunkasai-shift/store";
import type { DayId, SlotId } from "@/lib/bunkasai-shift/types";

export function ShiftTimetable() {
  const members = useBunkasaiShiftStore((s) => s.members);
  const assignments = useBunkasaiShiftStore((s) => s.assignments);
  const warnings = useBunkasaiShiftStore((s) => s.warnings);
  const runAutoAssign = useBunkasaiShiftStore((s) => s.runAutoAssign);
  const clearAssignments = useBunkasaiShiftStore((s) => s.clearAssignments);
  const addToSlot = useBunkasaiShiftStore((s) => s.addToSlot);
  const removeFromSlot = useBunkasaiShiftStore((s) => s.removeFromSlot);
  const moveMember = useBunkasaiShiftStore((s) => s.moveMember);
  const lastAssignedAt = useBunkasaiShiftStore((s) => s.lastAssignedAt);
  const placeError = useBunkasaiShiftStore((s) => s.placeError);
  const clearPlaceError = useBunkasaiShiftStore((s) => s.clearPlaceError);
  const coreMemberIds = useBunkasaiShiftStore((s) => s.coreMemberIds);
  const dependencies = useBunkasaiShiftStore((s) => s.dependencies);
  const coreSet = useMemo(() => new Set(coreMemberIds), [coreMemberIds]);
  const needsSomeone = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of dependencies) map.set(d.memberId, d.requiresId);
    return map;
  }, [dependencies]);
  const [day, setDay] = useState<DayId>("d1");
  const [drag, setDrag] = useState<{ memberId: string; fromSlot: SlotId } | null>(null);

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const stats = useMemo(() => loadStats(members, assignments), [members, assignments]);
  const daySlots = slotsForDay(day);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-bunkasai-display)] text-2xl tracking-tight text-[var(--bs-ink)]">
            シフト表
          </h2>
          <p className="mt-1 text-sm text-[var(--bs-muted)]">
            連続コマ禁止・日ごとの均等を優先。ドラッグまたはプルダウンで手直しできます（名簿は変わりません）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runAutoAssign()}
            className="rounded-xl bg-[var(--bs-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--bs-accent-deep)]"
          >
            自動割り当て実行
          </button>
          <button
            type="button"
            onClick={() => clearAssignments()}
            className="rounded-xl border border-[var(--bs-line)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--bs-ink-soft)] hover:bg-[var(--bs-soft)]"
          >
            クリア
          </button>
        </div>
      </div>

      {lastAssignedAt ? (
        <p className="text-xs text-[var(--bs-muted)]">
          最終自動割り当て: {new Date(lastAssignedAt).toLocaleString("ja-JP")}
        </p>
      ) : null}

      {placeError ? (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p>{placeError}</p>
          <button type="button" className="shrink-0 text-xs underline" onClick={() => clearPlaceError()}>
            閉じる
          </button>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">人数不足の警告</p>
          <ul className="list-disc space-y-1 pl-5">
            {warnings.map((w) => (
              <li key={w.slotId}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex gap-2">
        {(
          [
            ["d1", "1日目（4コマ）"],
            ["d2", "2日目（3コマ）"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDay(id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              day === id
                ? "bg-[var(--bs-ink)] text-white"
                : "bg-white text-[var(--bs-ink-soft)] ring-1 ring-[var(--bs-line)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {daySlots.map((slot) => {
          const ids = assignments[slot.id];
          const short = slot.needed - ids.length;
          const hasCore =
            coreSet.size === 0 || ids.some((id) => coreSet.has(id));
          const available = members.filter(
            (m) =>
              canPlaceInSlot(members, assignments, slot.id, m.id, {
                coreMemberIds,
                dependencies,
              }).ok,
          );
          return (
            <article
              key={slot.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!drag) return;
                moveMember(drag.fromSlot, slot.id, drag.memberId);
                setDrag(null);
              }}
              className={`rounded-2xl border bg-white/85 p-4 shadow-sm backdrop-blur ${
                !hasCore
                  ? "border-red-300"
                  : short > 0
                    ? "border-amber-300"
                    : short < 0
                      ? "border-sky-300"
                      : "border-[var(--bs-line)]"
              }`}
            >
              <header className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-[var(--bs-ink)]">
                    {formatSlotTitle(slot)}
                  </h3>
                  <p className="text-xs text-[var(--bs-muted)]">
                    {slot.label}
                    {!hasCore ? " ／ コア不在" : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    !hasCore
                      ? "bg-red-100 text-red-900"
                      : short > 0
                        ? "bg-amber-100 text-amber-900"
                        : short < 0
                          ? "bg-sky-100 text-sky-900"
                          : "bg-emerald-100 text-emerald-900"
                  }`}
                >
                  {ids.length}/{slot.needed}
                  {short > 0 ? ` ・不足${short}` : short < 0 ? ` ・超過${-short}` : ""}
                </span>
              </header>

              <ul className="mb-3 flex min-h-[3rem] flex-wrap gap-2">
                {ids.length === 0 ? (
                  <li className="text-sm text-[var(--bs-muted)]">未割当（ここにドロップ）</li>
                ) : (
                  ids.map((id) => {
                    const m = byId.get(id);
                    if (!m) return null;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          draggable
                          onDragStart={() => setDrag({ memberId: id, fromSlot: slot.id })}
                          onDragEnd={() => setDrag(null)}
                          onClick={() => removeFromSlot(slot.id, id)}
                          title="ドラッグで移動 / クリックで外す（同伴必須あり）"
                          className={`cursor-grab rounded-full px-3 py-1.5 text-sm font-medium ring-1 active:cursor-grabbing ${
                            coreSet.has(id)
                              ? "bg-[var(--bs-accent)] text-white ring-[var(--bs-accent-deep)]"
                              : needsSomeone.has(id)
                                ? "bg-amber-50 text-amber-950 ring-amber-200"
                                : "bg-[var(--bs-soft)] text-[var(--bs-ink)] ring-[var(--bs-line)]"
                          }`}
                        >
                          {coreSet.has(id) ? "★" : ""}
                          {m.name}
                          {needsSomeone.has(id) ? " +" : ""}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>

              <label className="block text-xs font-medium text-[var(--bs-muted)]">
                メンバーを追加
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--bs-line)] bg-white px-3 py-2 text-sm text-[var(--bs-ink)]"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addToSlot(slot.id, e.target.value);
                  }}
                >
                  <option value="">選択…</option>
                  {available.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--bs-line)] bg-white/70 p-4">
        <h3 className="mb-2 text-sm font-semibold text-[var(--bs-ink)]">
          負担の目安（合計 / 1日目・2日目）
        </h3>
        <div className="flex flex-wrap gap-2">
          {stats.map(({ member, count, d1, d2 }) => (
            <span
              key={member.id}
              className="rounded-lg bg-[var(--bs-soft)] px-2.5 py-1 text-xs text-[var(--bs-ink-soft)]"
            >
              {member.name}{" "}
              <strong className="text-[var(--bs-ink)]">{count}</strong>
              <span className="text-[var(--bs-muted)]">
                {" "}
                （{d1}・{d2}）
              </span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--bs-muted)]">
          全 {SLOTS.length} コマ × 9人 = 63 枠 / メンバー {members.length} 人 ／ 連続コマは入れません
        </p>
      </div>
    </section>
  );
}
