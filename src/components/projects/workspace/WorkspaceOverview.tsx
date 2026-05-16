"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { estimateCompletionDate, issueDoneRatio } from "@/lib/workspace/mapRows";

export default function WorkspaceOverview() {
  const { project, issues, phases, loading } = useProjectWorkspace();
  if (loading) return <p className="text-sm text-[#6B7280]">読み込み中…</p>;
  if (!project) return <p className="text-sm text-[#6B7280]">プロジェクトがありません。</p>;

  const pct = issueDoneRatio(issues);
  const est = estimateCompletionDate(issues);
  const target = project.targetDate ? new Date(project.targetDate) : null;
  const late = est && target && new Date(est) > target;

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[#E5E7EB] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1A1A1A]">進捗サマリー</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">Issue 完了率</p>
            <ProgressBar value={pct} className="mt-2 max-w-xs" />
            <p className="mt-1 text-[12px] text-[#6B7280]">
              {issues.filter((i) => i.status === "done").length} / {issues.length} 件
            </p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">完了予測（簡易）</p>
            <p className="mt-2 text-lg font-semibold text-[#1A1A1A]">
              {est ? format(new Date(est), "M月d日", { locale: ja }) : "—"}
            </p>
            {late ? (
              <p className="mt-1 text-[12px] font-medium text-red-600">遅延リスク: 目標日より遅い予測</p>
            ) : (
              <p className="mt-1 text-[12px] text-[#6B7280]">直近2週間の完了ペースから推定</p>
            )}
          </div>
        </div>
      </section>
      <section className="rounded-md border border-[#E5E7EB] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1A1A1A]">フェーズ</h2>
        <ul className="mt-2 space-y-2 text-[13px] text-[#6B7280]">
          {phases.length === 0 ? <li>フェーズがまだありません。Roadmap から追加してください。</li> : null}
          {phases.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 border-b border-[#F7F8F8] py-1">
              <span className="font-medium text-[#1A1A1A]">{p.title}</span>
              <span className="shrink-0 text-[11px]">
                {p.issues.filter((i) => i.status === "done").length}/{p.issues.length} issues
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
