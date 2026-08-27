"use client";

import type { GalleryTemplateView } from "@/lib/templates/types";

const COLOR_DOT: Record<string, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gray: "bg-gray-500",
};

type Props = {
  template: GalleryTemplateView;
  applying?: boolean;
  onClose: () => void;
  onApply: () => void;
};

export function TemplatePreviewModal({ template, applying, onClose, onApply }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="閉じる" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-4xl">{template.thumbnailEmoji}</span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{template.title}</h2>
              <p className="text-sm text-gray-500">{template.businessType || template.authorLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-violet-100 bg-violet-50 px-5 py-4">
          <p className="text-sm leading-relaxed text-gray-700">
            {template.usageGuide?.trim() || template.description}
          </p>
          {template.sources && template.sources.length > 0 ? (
            <p className="mt-2 text-xs text-gray-500">参考: {template.sources.join(" / ")}</p>
          ) : null}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {template.phases.map((phase, i) => (
            <div key={`${phase.title}-${i}`} className="flex gap-4 rounded-xl bg-gray-50 p-4">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${COLOR_DOT[phase.color] ?? "bg-violet-500"}`}
              >
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{phase.title}</p>
                  <span className="text-xs text-gray-400">約{phase.defaultDurationDays}日</span>
                </div>
                <p className="mb-2 text-xs text-gray-600">🎯 {phase.goal}</p>
                {phase.description?.trim() ? (
                  <p className="mb-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">{phase.description}</p>
                ) : null}
                {phase.milestones && phase.milestones.length > 0 ? (
                  <div className="mb-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">マイルストーン</p>
                    <ul className="space-y-1">
                      {phase.milestones.map((m) => (
                        <li key={m} className="flex items-start gap-1.5 text-xs text-gray-600">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {phase.keyQuestions && phase.keyQuestions.length > 0 ? (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">考える問い</p>
                    <ul className="space-y-1">
                      {phase.keyQuestions.map((q) => (
                        <li key={q} className="rounded-lg bg-white/80 px-2 py-1 text-xs text-gray-600">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 border-t border-gray-100 p-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={applying}
            onClick={onApply}
            className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {applying ? "適用中…" : "このテンプレートを使う"}
          </button>
        </div>
      </div>
    </div>
  );
}
