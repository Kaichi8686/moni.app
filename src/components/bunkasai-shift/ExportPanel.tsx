"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import {
  buildSlotRosterRows,
  downloadText,
  formatShiftCsv,
  formatShiftText,
  formatSlotRosterTsv,
} from "@/lib/bunkasai-shift/export";
import { buildShiftBackup, parseShiftImport } from "@/lib/bunkasai-shift/import";
import {
  scheduleServerSave,
  useBunkasaiShiftStore,
} from "@/lib/bunkasai-shift/store";

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
  const warnings = useBunkasaiShiftStore((s) => s.warnings);
  const lastAssignedAt = useBunkasaiShiftStore((s) => s.lastAssignedAt);
  const coreMemberIds = useBunkasaiShiftStore((s) => s.coreMemberIds);
  const dependencies = useBunkasaiShiftStore((s) => s.dependencies);
  const replaceSnapshot = useBunkasaiShiftStore((s) => s.replaceSnapshot);
  const setTab = useBunkasaiShiftStore((s) => s.setTab);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "warn">("ok");
  const importRef = useRef<HTMLInputElement>(null);

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

  function flash(msg: string, tone: "ok" | "warn" = "ok") {
    setStatusTone(tone);
    setStatus(msg);
    window.setTimeout(() => setStatus(""), 6000);
  }

  function downloadEditable() {
    const backup = buildShiftBackup({
      members,
      assignments,
      warnings,
      lastAssignedAt,
      coreMemberIds,
      dependencies,
    });
    downloadText(
      "bunkasai-shift-edit.json",
      JSON.stringify(backup, null, 2),
      "application/json;charset=utf-8",
    );
    flash("再編集用ファイルをダウンロードしました。あとから「表をインポート」で戻せます");
  }

  async function onImportFile(file: File) {
    try {
      const raw = await file.text();
      const result = parseShiftImport(raw, members);
      const assigned = Object.values(result.assignments).reduce((n, ids) => n + ids.length, 0);
      if (
        assigned > 0 &&
        Object.values(assignments).some((ids) => ids.length > 0) &&
        !confirm("今のシフト表を、インポートした内容で置き換えますか？")
      ) {
        return;
      }
      replaceSnapshot({
        members: result.members,
        assignments: result.assignments,
        warnings: result.warnings,
        lastAssignedAt: result.lastAssignedAt,
        coreMemberIds: result.coreMemberIds,
        dependencies: result.dependencies,
      });
      scheduleServerSave(0);
      setTab("assign");
      const extra =
        result.createdNames.length > 0
          ? `（新規 ${result.createdNames.length}人を名簿に追加）`
          : "";
      flash(`シフト表をインポートしました${extra}。シフト表タブで編集できます`);
    } catch (e) {
      flash(
        e instanceof Error ? e.message : "インポートに失敗しました",
        "warn",
      );
    }
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
          時間帯ごとの担当一覧です。保存した表は「表をインポート」で戻して編集できます。
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
        <button
          type="button"
          onClick={downloadEditable}
          className="rounded-xl border border-[var(--bs-line)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--bs-ink-soft)] hover:bg-[var(--bs-soft)]"
        >
          編集用に保存
        </button>
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="rounded-xl bg-[var(--bs-ink)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          表をインポート
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json,.csv,.tsv,.txt,application/json,text/csv,text/tab-separated-values,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onImportFile(file);
          }}
        />
      </div>
      <p className="text-xs text-[var(--bs-muted)]">
        「編集用に保存」の JSON が確実です。以前ダウンロードした CSV / シート用TSV もインポートできます。
      </p>

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

      {/* 時間 | メンバー名（折り返しで一枚に収める） */}
      <div>
        <h3 className="mb-2 text-base font-semibold text-[var(--bs-ink)]">
          時間帯ごとの担当
        </h3>
        <div className="rounded-xl border border-[var(--bs-line)] bg-white shadow-sm">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className="w-[7.5rem] sm:w-36" />
              <col />
            </colgroup>
            <thead>
              <tr className="bg-[var(--bs-soft)]">
                <th className="border-b border-r border-[var(--bs-line)] px-3 py-2.5 font-semibold text-[var(--bs-ink)]">
                  時間
                </th>
                <th className="border-b border-[var(--bs-line)] px-3 py-2.5 font-semibold text-[var(--bs-ink)]">
                  メンバー
                </th>
              </tr>
            </thead>
            <tbody>
              {dayGroups.map((group) => (
                <Fragment key={group.day}>
                  <tr className="bg-teal-50/90">
                    <td
                      colSpan={2}
                      className="border-b border-[var(--bs-line)] px-3 py-2 text-sm font-bold tracking-wide text-teal-900"
                    >
                      {group.day}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.slot.id} className="align-top">
                      <th className="border-b border-r border-[var(--bs-line)] px-3 py-3 text-left font-semibold text-[var(--bs-ink)]">
                        <div>{row.slot.start}</div>
                        <div className="font-normal text-[var(--bs-muted)]">
                          –{row.slot.end}
                        </div>
                      </th>
                      <td className="border-b border-[var(--bs-line)] px-3 py-3">
                        {row.names.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {row.names.map((name) => (
                              <span
                                key={`${row.slot.id}-${name}`}
                                className="rounded-md bg-teal-50 px-2 py-0.5 text-[13px] font-medium leading-snug text-teal-950"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[var(--bs-muted)]">（未割当）</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="rounded-xl border border-[var(--bs-line)] bg-white/70 p-3">
        <summary className="cursor-pointer text-sm font-medium text-[var(--bs-ink-soft)]">
          テキスト版（LINE・コピー用）
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--bs-ink)] sm:text-sm">
          {text}
        </pre>
      </details>
    </section>
  );
}
