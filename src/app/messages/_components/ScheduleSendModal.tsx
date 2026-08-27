"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  onClose: () => void;
  onSchedule: (iso: string) => void;
};

export function ScheduleSendModal({ onClose, onSchedule }: Props) {
  const { tx } = useI18n();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{tx("予定送信", "Schedule send")}</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <input type="date" className="w-full rounded-xl border px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          <input type="time" className="w-full rounded-xl border px-3 py-2 text-sm" value={time} onChange={(e) => setTime(e.target.value)} />
          <button
            type="button"
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white"
            onClick={() => {
              if (!date) return;
              const iso = new Date(`${date}T${time}`).toISOString();
              onSchedule(iso);
            }}
          >
            {tx("予約する", "Schedule")}
          </button>
        </div>
      </div>
    </div>
  );
}
