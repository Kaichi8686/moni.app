"use client";

/** Linear 風フェーズ概要カード（拡張用プレースホルダー） */
export function PhaseCard({ title }: { title: string }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1A1A]">{title}</div>
  );
}
