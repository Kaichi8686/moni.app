"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { ja } from "date-fns/locale";
import { X } from "lucide-react";
import { BUSINESS_TYPE_OPTIONS, PHASE_TEMPLATES } from "@/lib/roadmap/phaseTemplates";
import type { RoadmapBusinessType } from "@/lib/roadmap/types";

type Props = {
  open: boolean;
  onClose: () => void;
  projectStart?: string;
  existingCount: number;
  onBulkAdd: (businessType: RoadmapBusinessType) => Promise<void>;
  onAddSingle: (input: { title: string; goal?: string; startDate: string; endDate: string }) => Promise<void>;
};

export function RoadmapAddPhaseModal({
  open,
  onClose,
  projectStart,
  existingCount,
  onBulkAdd,
  onAddSingle,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [picked, setPicked] = useState<RoadmapBusinessType | null>(null);
  const [busy, setBusy] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  const start = useMemo(() => (projectStart ? new Date(projectStart) : new Date()), [projectStart]);

  const preview = useMemo(() => {
    if (!picked || picked === "other") return [];
    const items = PHASE_TEMPLATES[picked];
    let cursor = new Date(start);
    return items.map((item) => {
      const s = new Date(cursor);
      const e = addDays(s, item.durationDays);
      cursor = addDays(e, 1);
      return { ...item, start: s, end: e };
    });
  }, [picked, start]);

  if (!open) return null;

  async function confirmBulk() {
    if (!picked) return;
    setBusy(true);
    try {
      if (picked === "other") {
        const title = customTitle.trim() || "新しいフェーズ";
        const end = addDays(start, 14);
        await onAddSingle({
          title,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        });
      } else {
        await onBulkAdd(picked);
      }
      onClose();
      setStep(1);
      setPicked(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold text-gray-900">{step === 1 ? "フェーズを追加" : "内容を確認"}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            {BUSINESS_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setPicked(opt.id);
                  setStep(2);
                }}
                className="rounded-xl border border-gray-200 px-3 py-3 text-left text-sm font-medium hover:border-violet-300 hover:bg-violet-50"
              >
                {opt.label}
              </button>
            ))}
            {existingCount > 0 ? (
              <p className="col-span-full text-xs text-amber-700">
                既存のフェーズがある場合、テンプレート追加は末尾に連結されます。
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {picked === "other" ? (
              <div>
                <label className="text-xs text-gray-500">フェーズ名</label>
                <input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="例：プロトタイプ制作"
                />
              </div>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {preview.map((row) => (
                  <li key={row.title} className="rounded-lg border border-gray-100 px-3 py-2">
                    <p className="font-medium text-gray-900">{row.title}</p>
                    <p className="text-xs text-gray-500">{row.goal}</p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      {format(row.start, "M/d", { locale: ja })} → {format(row.end, "M/d", { locale: ja })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm"
                onClick={() => setStep(1)}
              >
                戻る
              </button>
              <button
                type="button"
                disabled={busy}
                className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void confirmBulk()}
              >
                {busy ? "追加中..." : picked === "other" ? "1件追加" : "まとめて追加"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
