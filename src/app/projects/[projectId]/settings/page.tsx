import type { Metadata } from "next";
import WorkspaceSettingsPage from "@/components/projects/workspace/WorkspaceSettingsPage";

export const metadata: Metadata = {
  title: "プロジェクト設定 | moni",
};

export default function SettingsPage() {
  return <WorkspaceSettingsPage />;
}
