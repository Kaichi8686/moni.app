"use client";

import { Suspense } from "react";
import WorkspaceRoadmapView from "@/components/projects/workspace/roadmap/WorkspaceRoadmapView";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function WorkspaceRoadmap() {
  const { tx } = useI18n();
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">{tx("読み込み中...", "Loading…")}</p>}>
      <WorkspaceRoadmapView />
    </Suspense>
  );
}
