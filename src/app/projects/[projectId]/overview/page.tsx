import type { Metadata } from "next";
import { Suspense } from "react";
import WorkspaceOverview from "@/components/projects/workspace/WorkspaceOverview";

export const metadata: Metadata = {
  title: "概要 | moni",
};

export default function OverviewPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">読み込み中...</p>}>
      <WorkspaceOverview />
    </Suspense>
  );
}
