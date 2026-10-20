"use client";

import { useMemo, useState } from "react";
import {
  SLOTS,
  buildMatrixRows,
  downloadText,
  formatShiftCsv,
  formatShiftText,
  formatShiftTsv,
  formatSlotRosterTsv,
  slotShortLabel,
} from "@/lib/bunkasai-shift/export";
import { useBunkasaiShiftStore } from "@/lib/bunkasai-shift/store";

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // 非HTTPSや権限なしでも textarea 経由でコピーを試す
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
  const tsv = useMemo(
    () => formatShiftTsv(members, assignments),
    [members, assignments],
  );
  const rosterTsv = useMemo(
    () => formatSlotRosterTsv(members, assignments),
    [members, assignments],
  );
  const matrixRows = useMemo(
    () => buildMatrixRows(members, assignments),
    [members, assignments],
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

  /**
   * LINEエラーの主因は line.me/R/msg/text/? に長文を載せる方式。
   * → Web Share（端末の「LINEで送信」）→ 失敗時はコピーのみ。URLスキームは使わない。
   */
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
        // Web Share 非対応・失敗 → コピーへ
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

  const hasAssignments = matrixRows.some((r) => r.total > 0);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-bunkasai-display)] text-2xl tracking-tight text-[var(--bs-ink)]">
          エクスポート
        </h2>
        <p className="mt-1 text-sm text-[var(--bs-muted)]">
          スプレッドシート風の表です。LINEは端末の共有メニューか、コピーして貼り付けで送れます。
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
          onClick={() => void copy(text, "表をコピーしました。LINEやメモに貼れます")}
          className="rounded-xl bg-[var(--bs-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--bs-accent-deep)]"
        >
          表をコピー
        </button>
        <button
          type="button"
          onClick={() =>
            void copy(tsv, "シート用表をコピーしました。スプレッドシートに貼ってください")
          }
          className="rounded-xl border border-[var(--bs-line)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--bs-ink-soft)] hover:bg-[var(--bs-soft)]"
        >
          シート用にコピー
        </button>
        <button
          type="button"
          onClick={() =>
            void copy(
              rosterTsv,
              "時間帯ごとの名簿をコピーしました。スプレッドシートに貼れます",
            )
          }
          className="rounded-xl border border-[var(--bs-line)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--bs-ink-soft)] hover:bg-[var(--bs-soft)]"
        >
          時間帯名簿をコピー
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

      {/* スプレッドシート風マトリクス */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--bs-ink)]">
          メンバー × 時間帯
        </h3>
        <div className="overflow-x-auto rounded-xl border border-[var(--bs-line)] bg-white shadow-sm">
          <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-[var(--bs-soft)]">
                <th className="sticky left-0 z-10 border-b border-r border-[var(--bs-line)] bg-[var(--bs-soft)] px-3 py-2 font-semibold text-[var(--bs-ink)]">
                  名前
                </th>
                {SLOTS.map((slot) => (
                  <th
                    key={slot.id}
                    className="whitespace-nowrap border-b border-[var(--bs-line)] px-2 py-2 text-center font-semibold text-[var(--bs-ink-soft)]"
                  >
                    <div>{slot.dayLabel.replace("日目", "日")}</div>
                    <div className="font-normal text-[var(--bs-muted)]">
                      {slot.start}
                    </div>
                  </th>
                ))}
                <th className="border-b border-l border-[var(--bs-line)] px-3 py-2 text-center font-semibold text-[var(--bs-ink)]">
                  合計
                </th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row, i) => (
                <tr
                  key={row.id}
                  className={i % 2 === 0 ? "bg-white" : "bg-slate-50/80"}
                >
                  <th className="sticky left-0 z-10 whitespace-nowrap border-r border-[var(--bs-line)] bg-inherit px-3 py-1.5 text-left font-medium text-[var(--bs-ink)]">
                    {row.name}
                  </th>
                  {row.marks.map((on, idx) => (
                    <td
                      key={SLOTS[idx].id}
                      className={`border-b border-[var(--bs-line)] px-2 py-1.5 text-center ${
                        on
                          ? "bg-teal-50 font-bold text-teal-800"
                          : "text-[var(--bs-muted)]"
                      }`}
                    >
                      {on ? "○" : ""}
                    </td>
                  ))}
                  <td className="border-b border-l border-[var(--bs-line)] px-3 py-1.5 text-center font-semibold text-[var(--bs-ink)]">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 時間帯ごとの名簿表 */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--bs-ink)]">
          時間帯ごとの名簿
        </h3>
        <div className="overflow-x-auto rounded-xl border border-[var(--bs-line)] bg-white shadow-sm">
          <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-[var(--bs-soft)]">
                <th className="border-b border-[var(--bs-line)] px-3 py-2 font-semibold">
                  日程
                </th>
                <th className="border-b border-[var(--bs-line)] px-3 py-2 font-semibold">
                  時間
                </th>
                <th className="border-b border-[var(--bs-line)] px-3 py-2 text-center font-semibold">
                  人数
                </th>
                <th className="border-b border-[var(--bs-line)] px-3 py-2 font-semibold">
                  メンバー
                </th>
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot, i) => {
                const ids = assignments[slot.id];
                const names = ids
                  .map((id) => members.find((m) => m.id === id)?.name ?? "?")
                  .join("、");
                const short = ids.length < slot.needed;
                return (
                  <tr
                    key={slot.id}
                    className={i % 2 === 0 ? "bg-white" : "bg-slate-50/80"}
                  >
                    <td className="whitespace-nowrap border-b border-[var(--bs-line)] px-3 py-2 text-[var(--bs-ink-soft)]">
                      {slot.dayLabel}
                    </td>
                    <td className="whitespace-nowrap border-b border-[var(--bs-line)] px-3 py-2 font-medium text-[var(--bs-ink)]">
                      {slot.start}-{slot.end}
                    </td>
                    <td
                      className={`border-b border-[var(--bs-line)] px-3 py-2 text-center font-semibold ${
                        short ? "text-amber-700" : "text-[var(--bs-ink)]"
                      }`}
                    >
                      {ids.length}/{slot.needed}
                    </td>
                    <td className="border-b border-[var(--bs-line)] px-3 py-2 text-[var(--bs-ink)]">
                      {names || (
                        <span className="text-[var(--bs-muted)]">（未割当）</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <details className="rounded-xl border border-[var(--bs-line)] bg-white/70 p-3">
        <summary className="cursor-pointer text-sm font-medium text-[var(--bs-ink-soft)]">
          テキスト版（コピー用・{slotShortLabel(SLOTS[0])} …）
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-[var(--bs-ink)] sm:text-sm">
          {text}
        </pre>
      </details>
    </section>
  );
}
