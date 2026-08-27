"use client";

import type { GalleryTemplateView } from "@/lib/templates/types";

type Props = {
  template: GalleryTemplateView;
  onClick: () => void;
};

function badgeLabel(template: GalleryTemplateView): string | null {
  if (template.source === "system") return "ビジネス";
  if (template.source === "community") return "コミュニティ";
  if (template.isOfficial) return "フレームワーク";
  return "保存した型";
}

function badgeClass(template: GalleryTemplateView): string {
  if (template.source === "system") return "bg-violet-100 text-violet-700";
  if (template.source === "community") return "bg-sky-100 text-sky-700";
  if (template.isOfficial) return "bg-indigo-100 text-indigo-700";
  return "bg-gray-100 text-gray-600";
}

export function TemplateCard({ template, onClick }: Props) {
  const phaseCount = template.phaseCount ?? template.phases.length;
  const badge = badgeLabel(template);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-violet-300 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-3xl leading-none">{template.thumbnailEmoji}</span>
        {badge ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass(template)}`}>
            {badge}
          </span>
        ) : null}
      </div>
      <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-gray-900">{template.title}</h3>
      <p className="mb-3 line-clamp-2 text-xs text-gray-500">{template.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400">{phaseCount}フェーズ</span>
        {template.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {tag}
          </span>
        ))}
      </div>
      {template.source === "community" && (template.useCount ?? 0) > 0 ? (
        <p className="mt-2 text-xs text-gray-400">{template.useCount}件が使用</p>
      ) : null}
      <p className="mt-3 text-xs font-medium text-violet-600 opacity-0 transition group-hover:opacity-100">
        プレビューを見る →
      </p>
    </button>
  );
}
