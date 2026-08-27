"use client";

import { UserPlus } from "lucide-react";
import type { CollabRequestMetadata } from "@/lib/types/messages";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  metadata: CollabRequestMetadata;
  isMine: boolean;
  onRespond?: (status: "accepted" | "declined") => void;
};

export function CollabRequestCard({ metadata, isMine, onRespond }: Props) {
  const { tx } = useI18n();
  return (
    <div
      className={`min-w-[200px] max-w-[260px] overflow-hidden rounded-xl ${
        isMine ? "bg-violet-500" : "border border-zinc-200 bg-white"
      }`}
    >
      <div className={`px-3 py-2 ${isMine ? "bg-violet-400" : "bg-violet-50"}`}>
        <div className="flex items-center gap-1.5">
          <UserPlus className={`h-4 w-4 ${isMine ? "text-violet-100" : "text-violet-600"}`} />
          <span className={`text-xs font-semibold ${isMine ? "text-violet-100" : "text-violet-700"}`}>
            {tx("コラボ依頼", "Collab request")}
          </span>
        </div>
      </div>
      <div className="space-y-1.5 px-3 py-2.5">
        <p className={`text-sm font-semibold ${isMine ? "text-white" : "text-zinc-900"}`}>{metadata.title}</p>
        <div className={`space-y-0.5 text-xs ${isMine ? "text-violet-100" : "text-zinc-600"}`}>
          <p>📁 {metadata.project_name}</p>
          <p>🛠 {metadata.skill_needed}</p>
          <p>⏱ {metadata.duration}</p>
          <p>💰 {metadata.compensation}</p>
        </div>
      </div>
      {!isMine && metadata.status === "pending" && onRespond ? (
        <div className="flex border-t border-zinc-100">
          <button
            type="button"
            onClick={() => onRespond("declined")}
            className="flex-1 py-2.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
          >
            {tx("断る", "Decline")}
          </button>
          <div className="w-px bg-zinc-100" />
          <button
            type="button"
            onClick={() => onRespond("accepted")}
            className="flex-1 py-2.5 text-xs font-semibold text-violet-600 hover:bg-violet-50"
          >
            {tx("承諾する ✓", "Accept ✓")}
          </button>
        </div>
      ) : null}
      {metadata.status === "accepted" ? (
        <div className="bg-green-50 px-3 py-2 text-center text-xs font-medium text-green-700">✅ {tx("承諾済み", "Accepted")}</div>
      ) : null}
    </div>
  );
}
