"use client";

import { Suspense } from "react";
import WorkspaceGeminiHub from "@/components/projects/workspace/WorkspaceGeminiHub";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** AIコーチ画面 = Gemini（相談 / アイデア編）全画面チャット */
export default function WorkspaceCoach() {
  const { tx } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center text-sm text-[#6B7280]">
          {tx("読み込み中…", "Loading…")}
        </div>
      }
    >
      <WorkspaceGeminiHub />
    </Suspense>
  );
}
