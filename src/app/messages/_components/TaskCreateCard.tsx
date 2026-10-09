"use client";

import { CheckCircle } from "lucide-react";
import type { TaskCardMetadata } from "@/lib/types/messages";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  metadata: TaskCardMetadata;
  isMine: boolean;
};

export function TaskCreateCard({ metadata, isMine }: Props) {
  const { tx } = useI18n();
  return (
    <div
      className={`min-w-[180px] rounded-xl border px-3 py-2.5 ${
        isMine ? "border-[var(--brand,#ff5c35)] bg-[var(--brand,#ff5c35)]/90" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <CheckCircle className={`h-4 w-4 ${isMine ? "text-[var(--brand-soft,#fff4f0)]" : "text-emerald-600"}`} />
        <span className={`text-xs font-semibold ${isMine ? "text-[var(--brand-soft,#fff4f0)]" : "text-emerald-700"}`}>{tx("タスク", "Task")}</span>
      </div>
      <p className={`text-sm font-medium ${isMine ? "text-white" : "text-zinc-900"}`}>{metadata.title}</p>
      {metadata.due_date ? (
        <p className={`mt-1 text-xs ${isMine ? "text-[var(--brand-soft,#fff4f0)]" : "text-zinc-500"}`}>
          {tx("期限", "Due")}: {metadata.due_date}
        </p>
      ) : null}
      <p className={`mt-1 text-[10px] ${isMine ? "text-[var(--brand-muted,#ffd9cc)]" : "text-zinc-400"}`}>
        {metadata.status === "created" ? tx("作成済み", "Created") : tx("作成待ち", "Pending")}
      </p>
    </div>
  );
}
