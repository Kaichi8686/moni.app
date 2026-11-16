"use client";

import { Suspense } from "react";
import WorkspaceGeminiHub from "@/components/projects/workspace/WorkspaceGeminiHub";
import { ConversationSkeleton } from "@/components/ui/Skeleton";

/** AIコーチ画面 = Gemini（相談 / アイデア編）全画面チャット */
export default function WorkspaceCoach() {
  return (
    <Suspense fallback={<ConversationSkeleton className="h-[100dvh]" />}>
      <WorkspaceGeminiHub />
    </Suspense>
  );
}
