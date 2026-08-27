"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar } from "lucide-react";

function toDateInputValue(iso?: string): string {
  if (!iso?.trim()) return "";
  return iso.slice(0, 10);
}

type Props = {
  canEdit: boolean;
  projectStart: string;
  projectTarget: string;
  openIssueCount: number;
  onSave: (targetDateYmd: string, options?: { startDateYmd?: string }) => Promise<{ issuesUpdated: number }>;
  onNotice?: (message: string) => void;
};

export function ProjectCompletionDateCard({
  canEdit,
  projectStart,
  projectTarget,
  openIssueCount,
  onSave,
  onNotice,
}: Props) {
  const [startYmd, setStartYmd] = useState(() => toDateInputValue(projectStart));
  const [targetYmd, setTargetYmd] = useState(() => toDateInputValue(projectTarget));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setStartYmd(toDateInputValue(projectStart));
    setTargetYmd(toDateInputValue(projectTarget));
  }, [projectStart, projectTarget]);

  const targetLabel = (() => {
    if (!targetYmd) return null;
    try {
      return format(parseISO(targetYmd), "yyyy年M月d日", { locale: ja });
    } catch {
      return targetYmd;
    }
  })();

  async function handleApply() {
    if (!canEdit || !targetYmd.trim()) {
      setErr("完成したい日を選んでください。");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const { issuesUpdated } = await onSave(targetYmd, { startDateYmd: startYmd || undefined });
      onNotice?.(
        issuesUpdated > 0
          ? `完成日を保存し、課題 ${issuesUpdated} 件の期限を合わせました`
          : "完成日を保存しました",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-[#E5E7EB] bg-white px-3 py-2.5 text-[13px]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#1A1A1A]">
          <Calendar className="h-3.5 w-3.5 text-[#6B7280]" aria-hidden />
          完成目標
        </span>
        <span className="text-[#6B7280]">{targetLabel ?? "未設定"}</span>
        {openIssueCount > 0 ? (
          <span className="text-[11px] text-[#9CA3AF]">未完了 {openIssueCount}件</span>
        ) : null}
      </div>
    );
  }

  return (
    <section className="rounded-md border border-[#E5E7EB] bg-white px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1A1A1A]">
            <Calendar className="h-3.5 w-3.5 text-[#6B7280]" aria-hidden />
            完成目標
          </p>
          {targetLabel ? (
            <p className="text-[12px] text-[#6B7280]">{targetLabel}</p>
          ) : (
            <p className="text-[12px] text-[#9CA3AF]">未設定</p>
          )}
          {openIssueCount > 0 ? (
            <span className="text-[11px] text-[#9CA3AF]">· 未完了 {openIssueCount}件</span>
          ) : null}
        </div>
        <p className="text-[11px] text-[#9CA3AF]">保存すると未完了課題の期限を配分します</p>
      </div>

      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-[11px] font-medium text-[#6B7280]">
          始めた日
          <input
            type="date"
            value={startYmd}
            onChange={(e) => setStartYmd(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-2.5 py-2 text-sm text-[#1A1A1A] outline-none focus:border-[#5E6AD2] focus:bg-white focus:ring-2 focus:ring-[#5E6AD2]/20"
          />
        </label>
        <label className="block min-w-0 flex-1 text-[11px] font-medium text-[#6B7280]">
          完成したい日
          <input
            type="date"
            value={targetYmd}
            onChange={(e) => setTargetYmd(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-2.5 py-2 text-sm text-[#1A1A1A] outline-none focus:border-[#5E6AD2] focus:bg-white focus:ring-2 focus:ring-[#5E6AD2]/20"
          />
        </label>
        <button
          type="button"
          disabled={saving || !targetYmd.trim()}
          onClick={() => void handleApply()}
          className="inline-flex h-[38px] shrink-0 items-center justify-center rounded-md bg-[#5E6AD2] px-4 text-[13px] font-semibold text-white hover:bg-[#4F5BBD] disabled:opacity-50"
        >
          {saving ? "反映中…" : "期限を配分"}
        </button>
      </div>

      {err ? <p className="mt-2 text-[12px] text-red-600">{err}</p> : null}
    </section>
  );
}
