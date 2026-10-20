"use client";

import { useMemo, useState } from "react";
import {
  downloadText,
  formatShiftCsv,
  formatShiftText,
  formatShiftTsv,
} from "@/lib/bunkasai-shift/export";
import { useBunkasaiShiftStore } from "@/lib/bunkasai-shift/store";

export function ExportPanel() {
  const members = useBunkasaiShiftStore((s) => s.members);
  const assignments = useBunkasaiShiftStore((s) => s.assignments);
  const [status, setStatus] = useState("");

  const text = useMemo(
    () => formatShiftText(members, assignments),
    [members, assignments],
  );
  const tsv = useMemo(
    () => formatShiftTsv(members, assignments),
    [members, assignments],
  );

  async function copy(value: string, okMsg: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(okMsg);
    } catch {
      setStatus("コピーに失敗しました。下の文面を長押ししてコピーしてください");
    }
    window.setTimeout(() => setStatus(""), 2800);
  }

  async function shareToLine() {
    // URLに長文を載せると途中切断→文字化けしやすいので、コピーして貼る方式に統一
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }

    // 短い案内だけURLに載せる（文字化けしない長さ）
    const tip = copied
      ? "文化祭シフト表をコピーしました。このチャットに貼り付けてください。"
      : "文化祭シフト表です。アプリに戻って表をコピーし、ここに貼り付けてください。";
    const url = `https://line.me/R/msg/text/?${encodeURIComponent(tip)}`;
    window.open(url, "_blank", "noopener,noreferrer");

    setStatus(
      copied
        ? "表をコピーしました。開いたLINEチャットに貼り付け（長押し→貼り付け）してください"
        : "下の表を選択してコピーし、LINEに貼り付けてください",
    );
    window.setTimeout(() => setStatus(""), 5000);
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-bunkasai-display)] text-2xl tracking-tight text-[var(--bs-ink)]">
          エクスポート
        </h2>
        <p className="mt-1 text-sm text-[var(--bs-muted)]">
          スプレッドシート風の表です。LINEは「コピーして貼り付け」方式（URL直送りだと文字化けするため）。
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
          onClick={() => void copy(text, "表形式のテキストをコピーしました")}
          className="rounded-xl bg-[var(--bs-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--bs-accent-deep)]"
        >
          表をコピー
        </button>
        <button
          type="button"
          onClick={() =>
            void copy(tsv, "シート用TSVをコピーしました。スプレッドシートに貼れます")
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
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          {status}
        </p>
      ) : null}

      <pre className="overflow-x-auto whitespace-pre rounded-2xl border border-[var(--bs-line)] bg-white/80 p-4 font-mono text-xs leading-relaxed text-[var(--bs-ink)] shadow-sm sm:text-sm">
        {text}
      </pre>
    </section>
  );
}
