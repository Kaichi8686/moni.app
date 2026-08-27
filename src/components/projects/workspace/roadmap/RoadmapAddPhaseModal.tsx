"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { ARCHETYPE_LABELS, BUILTIN_ROADMAP_TEMPLATES } from "@/lib/projects/builtinRoadmapTemplates";
import type { TemplateArchetype } from "@/lib/projects/templateTypes";
import {
  buildDraftPhasesFromBuiltinId,
  chainDraftPhaseDates,
  newEmptyDraftRow,
  type PhaseDraftRow,
} from "@/lib/roadmap/phaseTemplates";

const ASSIST_ARCHETYPES: TemplateArchetype[] = ["application", "service", "hardware"];

type Props = {
  open: boolean;
  onClose: () => void;
  projectStart?: string;
  onBulkAddPhases: (
    items: Array<{ title: string; goal?: string; startDate: string; endDate: string }>,
  ) => Promise<void>;
};

function draftsHaveContent(rows: PhaseDraftRow[]): boolean {
  return rows.some((d) => d.title.trim() || d.goal.trim());
}

export function RoadmapAddPhaseModal({ open, onClose, projectStart, onBulkAddPhases }: Props) {
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<PhaseDraftRow[]>([]);
  const [assistOpen, setAssistOpen] = useState(false);
  const [loadedAssistId, setLoadedAssistId] = useState<string | null>(null);

  const start = useMemo(() => (projectStart ? new Date(projectStart) : new Date()), [projectStart]);

  useEffect(() => {
    if (!open) {
      setDrafts([]);
      setAssistOpen(false);
      setLoadedAssistId(null);
      return;
    }
    setDrafts([newEmptyDraftRow(start)]);
    setAssistOpen(false);
    setLoadedAssistId(null);
  }, [open, start]);

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
    setLoadedAssistId(null);
  }

  function removeDraft(id: string) {
    setDrafts((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)));
    setLoadedAssistId(null);
  }

  function applyAssist(templateId: string) {
    if (draftsHaveContent(drafts)) {
      const ok = window.confirm("今の入力を例で置き換えますか？");
      if (!ok) return;
    }
    setDrafts(buildDraftPhasesFromBuiltinId(templateId, start));
    setLoadedAssistId(templateId);
    setAssistOpen(false);
  }

  async function confirmAdd() {
    const enabled = drafts
      .filter((d) => d.enabled && d.title.trim())
      .map((d) => ({
        title: d.title.trim(),
        goal: d.goal.trim() || undefined,
        startDate: new Date(d.startDate).toISOString(),
        endDate: new Date(d.endDate).toISOString(),
      }));
    if (enabled.length === 0) return;
    setBusy(true);
    try {
      await onBulkAddPhases(enabled);
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
          <h2 className="text-sm font-bold text-gray-900">フェーズを追加</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-gray-100" aria-label="閉じる">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100"
              onClick={() => setDrafts((rows) => [...rows, newEmptyDraftRow(start)])}
            >
              <Plus className="h-3.5 w-3.5" />
              フェーズを1つ追加
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              onClick={() => setDrafts((rows) => chainDraftPhaseDates(rows, start))}
            >
              開始日から連続で並べ直す
            </button>
          </div>

          <ul className="space-y-3">
            {drafts.map((row, index) => (
              <li
                key={row.id}
                className={`rounded-xl border p-3 ${row.enabled ? "border-gray-200 bg-white shadow-sm" : "border-gray-100 bg-gray-50 opacity-60"}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] font-medium text-gray-400">フェーズ {index + 1}</span>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateDraft(row.id, { enabled: e.target.checked })}
                    className="rounded border-gray-300"
                    title="追加する"
                  />
                  <span className="text-[11px] text-gray-400">
                    {format(parseISO(row.startDate), "M/d", { locale: ja })} →{" "}
                    {format(parseISO(row.endDate), "M/d", { locale: ja })}
                  </span>
                  <button
                    type="button"
                    className="ml-auto rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    onClick={() => removeDraft(row.id)}
                    disabled={drafts.length <= 1}
                    aria-label="削除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  value={row.title}
                  disabled={!row.enabled}
                  onChange={(e) => updateDraft(row.id, { title: e.target.value })}
                  className="mb-2 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm font-medium outline-none ring-violet-500 focus:ring-2 disabled:bg-gray-100"
                  placeholder="フェーズ名（例：ヒアリング）"
                />
                <input
                  value={row.goal}
                  disabled={!row.enabled}
                  onChange={(e) => updateDraft(row.id, { goal: e.target.value })}
                  className="mb-2 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm outline-none ring-violet-500 focus:ring-2 disabled:bg-gray-100"
                  placeholder="このフェーズのゴール（例：10人に話を聞く）"
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400">開始</label>
                    <input
                      type="date"
                      disabled={!row.enabled}
                      value={row.startDate}
                      onChange={(e) => updateDraft(row.id, { startDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm disabled:bg-gray-100"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400">終了</label>
                    <input
                      type="date"
                      disabled={!row.enabled}
                      value={row.endDate}
                      onChange={(e) => updateDraft(row.id, { endDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-xl border border-dashed border-violet-200 bg-violet-50/40">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              onClick={() => setAssistOpen((v) => !v)}
            >
              <span className="text-xs font-semibold text-violet-800">アシスト</span>
              {assistOpen ? <ChevronUp className="h-4 w-4 text-violet-600" /> : <ChevronDown className="h-4 w-4 text-violet-600" />}
            </button>
            {assistOpen ? (
              <div className="max-h-[280px] overflow-y-auto border-t border-violet-100 px-3 pb-3 pt-2">
                {ASSIST_ARCHETYPES.map((arch) => {
                  const meta = ARCHETYPE_LABELS[arch];
                  const items = BUILTIN_ROADMAP_TEMPLATES.filter((t) => t.archetype === arch);
                  return (
                    <div key={arch} className="mb-3 last:mb-0">
                      <p className="text-[10px] font-semibold text-violet-900">
                        {meta.emoji} {meta.label}
                      </p>
                      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                        {items.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => applyAssist(t.id)}
                            className={`rounded-lg border px-2.5 py-2 text-left text-[11px] leading-snug transition-colors ${
                              loadedAssistId === t.id
                                ? "border-violet-400 bg-violet-100 font-medium text-violet-900"
                                : "border-violet-200 bg-white text-gray-800 hover:border-violet-300 hover:bg-violet-50"
                            }`}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

        </div>

        <div className="flex shrink-0 gap-2 border-t bg-white p-4">
          <button type="button" className="rounded-lg border border-gray-200 px-4 py-2 text-sm" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            disabled={busy || enabledCount === 0}
            className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void confirmAdd()}
          >
            {busy ? "追加中..." : enabledCount === 0 ? "フェーズ名を入力してください" : `${enabledCount}件を追加`}
          </button>
        </div>
      </div>
    </div>
  );
}
