"use client";

import { useMemo, useState } from "react";
import { downloadText, formatShiftCsv, formatShiftText } from "@/lib/bunkasai-shift/export";
import { useBunkasaiShiftStore } from "@/lib/bunkasai-shift/store";

export function ExportPanel() {
  const members = useBunkasaiShiftStore((s) => s.members);
  const assignments = useBunkasaiShiftStore((s) => s.assignments);
  const [copied, setCopied] = useState(false);

  const text = useMemo(
    () => formatShiftText(members, assignments),
    [members, assignments],
  );

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-bunkasai-display)] text-2xl tracking-tight text-[var(--bs-ink)]">
          エクスポート
        </h2>
        <p className="mt-1 text-sm text-[var(--bs-muted)]">
          LINE用テキストのコピー、またはCSVダウンロードができます。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
          className="rounded-xl bg-[var(--bs-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--bs-accent-deep)]"
        >
          {copied ? "コピーしました" : "テキストをコピー"}
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
        <a
          href={`https://line.me/R/msg/text/?${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-[#06C755] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          LINEで送る
        </a>
      </div>

      <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-[var(--bs-line)] bg-white/80 p-4 text-sm leading-relaxed text-[var(--bs-ink)] shadow-sm">
        {text}
      </pre>
    </section>
  );
}
