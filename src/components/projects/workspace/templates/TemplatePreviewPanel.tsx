"use client";

import { ChevronLeft } from "lucide-react";
import { getBuiltinTemplateMeta } from "@/lib/projects/builtinRoadmapTemplates";
import { resolveBuiltinTemplateDefinition } from "@/lib/projects/templateDefinition";
import type { TemplateListItem } from "@/lib/projects/templateTypes";

type Props = {
  item: TemplateListItem;
  onBack: () => void;
  onApply: () => void;
  canEdit: boolean;
  busy: boolean;
};

export function TemplatePreviewPanel({ item, onBack, onApply, canEdit, busy }: Props) {
  const meta = item.isBuiltin ? getBuiltinTemplateMeta(item.id) : null;
  const def = resolveBuiltinTemplateDefinition(item.id);

  const usage = item.usageGuide ?? meta?.usageGuide ?? item.description;
  const sources = item.sources ?? meta?.sources ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-3 py-2">
        <button type="button" onClick={onBack} className="rounded-md p-1 text-[#6B7280] hover:bg-[#F7F8F8]" aria-label="戻る">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#1A1A1A]">{item.name}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-md bg-[#F7F8F8] px-3 py-2.5">
          <p className="text-[11px] font-semibold text-[#6B7280]">この型で進めること</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#374151]">{usage}</p>
          {sources.length > 0 ? (
            <p className="mt-2 text-[10px] text-[#9CA3AF]">参考: {sources.join(" / ")}</p>
          ) : null}
        </div>

        {!def ? (
          <p className="text-[12px] text-[#6B7280]">内容を読み込めませんでした。</p>
        ) : (
          <ol className="space-y-3">
            {def.phases.map((phase, i) => (
              <li key={`${phase.title}-${i}`} className="rounded-md border border-[#E5E7EB] bg-white p-3">
                <p className="text-[12px] font-semibold text-[#1A1A1A]">
                  {i + 1}. {phase.title}
                  <span className="ml-2 font-normal text-[#9CA3AF]">約{phase.durationDays}日</span>
                </p>
                {phase.goal ? (
                  <p className="mt-1 text-[11px] font-medium text-[#5E6AD2]">ゴール: {phase.goal}</p>
                ) : null}
                {phase.guide ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-[#374151] whitespace-pre-wrap">{phase.guide}</p>
                ) : null}
                {phase.tasks && phase.tasks.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-[11px] text-[#6B7280]">
                    {phase.tasks.map((t) => (
                      <li key={t.title}>{t.title}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex gap-2 border-t border-[#E5E7EB] p-3">
        <button type="button" onClick={onBack} className="rounded-md border border-[#E5E7EB] px-3 py-2 text-[12px]">
          一覧へ
        </button>
        {canEdit ? (
          <button
            type="button"
            disabled={busy || !def}
            onClick={onApply}
            className="flex-1 rounded-md bg-[#5E6AD2] py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            この型を適用
          </button>
        ) : null}
      </div>
    </div>
  );
}
