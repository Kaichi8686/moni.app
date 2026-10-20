"use client";

import { Fragment, useMemo, useState } from "react";
import {
  buildSlotRosterRows,
  downloadText,
  formatShiftCsv,
  formatShiftText,
  formatSlotRosterTsv,
  rosterColumnCount,
} from "@/lib/bunkasai-shift/export";
import { useBunkasaiShiftStore } from "@/lib/bunkasai-shift/store";

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function ExportPanel() {
  const members = useBunkasaiShiftStore((s) => s.members);
  const assignments = useBunkasaiShiftStore((s) => s.assignments);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "warn">("ok");

  const text = useMemo(
    () => formatShiftText(members, assignments),
    [members, assignments],
  );
  const rosterTsv = useMemo(
    () => formatSlotRosterTsv(members, assignments),
    [members, assignments],
  );
  const rosterRows = useMemo(
    () => buildSlotRosterRows(members, assignments),
    [members, assignments],
  );
  const colCount = useMemo(
    () => rosterColumnCount(assignments),
    [assignments],
  );

  function flash(msg: string, tone: "ok" | "warn" = "ok") {
    setStatusTone(tone);
    setStatus(msg);
    window.setTimeout(() => setStatus(""), 5000);
  }

  async function copy(value: string, okMsg: string) {
    const ok = await copyText(value);
    flash(
      ok ? okMsg : "コピーに失敗しました。下の表を長押ししてコピーしてください",
      ok ? "ok" : "warn",
    );
  }

  async function shareToLine() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "文化祭シフト表",
          text,
        });
        flash("共有メニューから LINE を選んで送ってください");
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          flash("共有をキャンセルしました", "warn");
          return;
        }
      }
    }

    const ok = await copyText(text);
    flash(
      ok
        ? "表をコピーしました。LINEを開いて貼り付けてください（長押し→貼り付け）"
        : "下の表を選択してコピーし、LINEに貼り付けてください",
      ok ? "ok" : "warn",
    );
  }

  const hasAssignments = rosterRows.some((r) => r.count > 0);

  // 日程ごとにグループ化して見出し行を出す
  const dayGroups: { day: string; rows: typeof rosterRows }[] = [];
  for (const row of rosterRows) {
    const last = dayGroups[dayGroups.length - 1];
    if (!last || last.day !== row.slot.dayLabel) {
      dayGroups.push({ day: row.slot.dayLabel, rows: [row] });
    } else {
      last.rows.push(row);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-bunkasai-display)] text-2xl tracking-tight text-[var(--bs-ink)]">
          エクスポート
        </h2>
        <p className="mt-1 text-sm text-[var(--bs-muted)]">
          時間帯ごとに誰が入るかを一覧にしています。LINEは共有メニューか、コピーして貼り付けで送れます。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void shareToLine()}
          className="rounded-xl bg-[#06C755] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          LINEで送る
        </button>
        <button
          type="button"
          onClick={() => void copy(text, "時間帯ごとの表をコピーしました")}
          className="rounded-xl bg-[var(--bs-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--bs-accent-deep)]"
        >
          表をコピー
        </button>
        <button
          type="button"
          onClick={() =>
            void copy(rosterTsv, "シート用にコピーしました。スプレッドシートに貼れます")
          }
          className="rounded-xl border border-[var(--bs-line)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--bs-ink-soft)] hover:bg-[var(--bs-soft)]"
        >
          シート用にコピー
        </button>
        <button
          type="button"
          onClick={() =>
            downloadText(
              "bunkasai-shift.csv",
              formatShiftCsv(members, assignments),
              "text/csv;charset=utf-8",
            )
          }
          className="rounded-xl border border-[var(--bs-line)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--bs-ink-soft)] hover:bg-[var(--bs-soft)]"
        >
          CSVダウンロード
        </button>
      </div>

      {status ? (
        <p
          className={
            statusTone === "ok"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950"
          }
        >
          {status}
        </p>
      ) : null}

      {!hasAssignments ? (
        <p className="rounded-xl border border-[var(--bs-line)] bg-[var(--bs-soft)] px-3 py-2 text-sm text-[var(--bs-muted)]">
          まだ自動割り当て前です。「シフト表」タブで割り当てると、ここに表が出ます。
        </p>
      ) : null}

      {/* 主表: 時間帯 × 担当者 */}
      <div>
        <h3 className="mb-2 text-base font-semibold text-[var(--bs-ink)]">
          時間帯ごとの担当
        </h3>
        <div className="overflow-x-auto rounded-xl border border-[var(--bs-line)] bg-white shadow-sm">
          <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-[var(--bs-soft)]">
                <th className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-[var(--bs-line)] bg-[var(--bs-soft)] px-3 py-2.5 font-semibold text-[var(--bs-ink)]">
                  時間
                </th>
                <th className="whitespace-nowrap border-b border-[var(--bs-line)] px-2 py-2.5 text-center font-semibold text-[var(--bs-ink-soft)]">
                  人数
                </th>
                {Array.from({ length: colCount }, (_, i) => (
                  <th
                    key={i}
                    className="whitespace-nowrap border-b border-[var(--bs-line)] px-2 py-2.5 text-center font-semibold text-[var(--bs-muted)]"
                  >
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayGroups.map((group) => (
                <Fragment key={group.day}>
                  <tr className="bg-teal-50/90">
                    <td
                      colSpan={2 + colCount}
                      className="border-b border-[var(--bs-line)] px-3 py-2 text-sm font-bold tracking-wide text-teal-900"
                    >
                      {group.day}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.slot.id} className="align-middle hover:bg-slate-50/80">
                      <th className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-[var(--bs-line)] bg-white px-3 py-2.5 text-left font-semibold text-[var(--bs-ink)]">
                        {row.slot.start}
                        <span className="font-normal text-[var(--bs-muted)]">
                          –{row.slot.end}
                        </span>
                      </th>
                      <td
                        className={`border-b border-[var(--bs-line)] px-2 py-2.5 text-center font-semibold ${
                          row.short
                            ? "text-amber-700"
                            : row.over
                              ? "text-sky-700"
                              : "text-[var(--bs-ink)]"
                        }`}
                      >
                        {row.count}/{row.needed}
                      </td>
                      {Array.from({ length: colCount }, (_, i) => (
                        <td
                          key={i}
                          className="whitespace-nowrap border-b border-[var(--bs-line)] px-2 py-2.5 text-center text-[var(--bs-ink)]"
                        >
                          {row.names[i] ? (
                            <span className="inline-block rounded-md bg-teal-50 px-1.5 py-0.5 font-medium text-teal-900">
                              {row.names[i]}
                            </span>
                          ) : (
                            <span className="text-[var(--bs-muted)]">·</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--bs-muted)]">
          1列＝1人。人数が足りない時間帯は人数がオレンジになります。
        </p>
      </div>

      <details className="rounded-xl border border-[var(--bs-line)] bg-white/70 p-3">
        <summary className="cursor-pointer text-sm font-medium text-[var(--bs-ink-soft)]">
          テキスト版（LINE・コピー用）
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-[var(--bs-ink)] sm:text-sm">
          {text}
        </pre>
      </details>
    </section>
  );
}
