"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Plus, Trash2, X } from "lucide-react";
import {
  BUSINESS_TYPE_OPTIONS,
  buildDraftPhasesFromTemplate,
  chainDraftPhaseDates,
  newEmptyDraftRow,
  type PhaseDraftRow,
} from "@/lib/roadmap/phaseTemplates";
import type { RoadmapBusinessType } from "@/lib/roadmap/types";

type Props = {
  open: boolean;
  onClose: () => void;
  projectStart?: string;
  existingCount: number;
  onBulkAddPhases: (
    items: Array<{ title: string; goal?: string; startDate: string; endDate: string }>,
    businessType?: RoadmapBusinessType,
  ) => Promise<void>;
  onAddSingle: (input: { title: string; goal?: string; startDate: string; endDate: string }) => Promise<void>;
};

export function RoadmapAddPhaseModal({
  open,
  onClose,
  projectStart,
  existingCount,
  onBulkAddPhases,
  onAddSingle,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [picked, setPicked] = useState<RoadmapBusinessType | null>(null);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<PhaseDraftRow[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const start = useMemo(() => (projectStart ? new Date(projectStart) : new Date()), [projectStart]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setPicked(null);
      setDrafts([]);
      setCustomTitle("");
      setCustomGoal("");
    }
  }, [open]);

  useEffect(() => {
    if (picked && picked !== "other") {
      setDrafts(buildDraftPhasesFromTemplate(picked, start));
    }
    if (picked === "other") {
      const s = format(start, "yyyy-MM-dd");
      const e = format(addDays(start, 14), "yyyy-MM-dd");
      setCustomStart(s);
      setCustomEnd(e);
    }
  }, [picked, start]);

  if (!open) return null;

  function updateDraft(id: string, patch: Partial<PhaseDraftRow>) {
    setDrafts((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.startDate && !patch.endDate) {
          const days = Math.max(1, differenceInCalendarDays(parseISO(r.endDate), parseISO(r.startDate)) + 1);
          const end = addDays(parseISO(patch.startDate), days - 1);
          next.endDate = format(end, "yyyy-MM-dd");
          next.durationDays = days;
        }
        if (patch.endDate && patch.startDate === undefined) {
          const days = Math.max(1, differenceInCalendarDays(parseISO(patch.endDate), parseISO(next.startDate)) + 1);
          next.durationDays = days;
        }
        return next;
      }),
    );
  }

  function removeDraft(id: string) {
    setDrafts((rows) => rows.filter((r) => r.id !== id));
  }

  function pickType(id: RoadmapBusinessType) {
    setPicked(id);
    setStep(2);
  }

  async function confirmBulk() {
    if (!picked) return;
    setBusy(true);
    try {
      if (picked === "other") {
        const title = customTitle.trim() || "新しいフェーズ";
        await onAddSingle({
          title,
          goal: customGoal.trim() || undefined,
          startDate: new Date(customStart).toISOString(),
          endDate: new Date(customEnd).toISOString(),
        });
      } else {
        const enabled = drafts
          .filter((d) => d.enabled && d.title.trim())
          .map((d) => ({
            title: d.title.trim(),
            goal: d.goal.trim() || undefined,
            startDate: new Date(d.startDate).toISOString(),
            endDate: new Date(d.endDate).toISOString(),
          }));
        if (enabled.length === 0) return;
        await onBulkAddPhases(enabled, picked);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const enabledCount = drafts.filter((d) => d.enabled && d.title.trim()).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {step === 1 ? "フェーズを追加" : "テンプレートを編集"}
            </h2>
            {step === 2 && picked && picked !== "other" ? (
              <p className="text-[11px] text-gray-500">名前・ゴール・期間を自由に変えてから追加できます</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="overflow-y-auto p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {BUSINESS_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => pickType(opt.id)}
                  className="rounded-xl border border-gray-200 px-3 py-3 text-left text-sm font-medium hover:border-violet-300 hover:bg-violet-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {existingCount > 0 ? (
              <p className="mt-3 text-xs text-amber-700">既存フェーズの末尾に追加されます。</p>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {picked === "other" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">フェーズ名</label>
                    <input
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="例：プロトタイプ制作"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">ゴール（任意）</label>
                    <input
                      value={customGoal}
                      onChange={(e) => setCustomGoal(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="例：動く試作品を1つ完成させる"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">開始日</label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">終了日</label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      onClick={() => setDrafts((rows) => chainDraftPhaseDates(rows, start))}
                    >
                      開始日から連続で並べ直す
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-2.5 py-1 text-xs text-violet-700 hover:bg-violet-50"
                      onClick={() => setDrafts((rows) => [...rows, newEmptyDraftRow(start)])}
                    >
                      <Plus className="h-3 w-3" />
                      行を追加
                    </button>
                  </div>
                  <ul className="space-y-3">
                    {drafts.map((row) => (
                      <li
                        key={row.id}
                        className={`rounded-xl border p-3 ${row.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={(e) => updateDraft(row.id, { enabled: e.target.checked })}
                            className="rounded border-gray-300"
                          />
                          <span className="text-[11px] text-gray-400">
                            {format(parseISO(row.startDate), "M/d", { locale: ja })} →{" "}
                            {format(parseISO(row.endDate), "M/d", { locale: ja })}
                          </span>
                          <button
                            type="button"
                            className="ml-auto rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() => removeDraft(row.id)}
                            aria-label="削除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <input
                          value={row.title}
                          disabled={!row.enabled}
                          onChange={(e) => updateDraft(row.id, { title: e.target.value })}
                          className="mb-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-medium disabled:bg-gray-100"
                          placeholder="フェーズ名"
                        />
                        <input
                          value={row.goal}
                          disabled={!row.enabled}
                          onChange={(e) => updateDraft(row.id, { goal: e.target.value })}
                          className="mb-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm disabled:bg-gray-100"
                          placeholder="このフェーズのゴール"
                        />
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-400">開始</label>
                            <input
                              type="date"
                              disabled={!row.enabled}
                              value={row.startDate}
                              onChange={(e) => updateDraft(row.id, { startDate: e.target.value })}
                              className="w-full rounded border border-gray-200 px-2 py-1 text-xs disabled:bg-gray-100"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-400">終了</label>
                            <input
                              type="date"
                              disabled={!row.enabled}
                              value={row.endDate}
                              onChange={(e) => updateDraft(row.id, { endDate: e.target.value })}
                              className="w-full rounded border border-gray-200 px-2 py-1 text-xs disabled:bg-gray-100"
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-2 border-t bg-white p-4">
              <button
                type="button"
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm"
                onClick={() => setStep(1)}
              >
                戻る
              </button>
              <button
                type="button"
                disabled={busy || (picked === "other" ? !customTitle.trim() : enabledCount === 0)}
                className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void confirmBulk()}
              >
                {busy
                  ? "追加中..."
                  : picked === "other"
                    ? "1件追加"
                    : `${enabledCount}件を追加`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
