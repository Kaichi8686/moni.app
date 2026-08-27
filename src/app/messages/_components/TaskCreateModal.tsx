"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { TaskCardMetadata } from "@/lib/types/messages";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  onClose: () => void;
  onSubmit: (metadata: TaskCardMetadata) => void;
};

export function TaskCreateModal({ onClose, onSubmit }: Props) {
  const { tx } = useI18n();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{tx("タスクを作成", "Create a task")}</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onSubmit({
              title: title.trim(),
              due_date: dueDate || undefined,
              status: "pending_create",
            });
          }}
        >
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tx("タスク名", "Task name")}
            required
          />
          <input
            type="date"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <button type="submit" className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white">
            {tx("チャットに送る", "Send to chat")}
          </button>
        </form>
      </div>
    </div>
  );
}
