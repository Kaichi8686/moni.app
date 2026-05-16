import type { Metadata } from "next";
import WorkspaceRoadmap from "@/components/projects/workspace/WorkspaceRoadmap";

export const metadata: Metadata = {
  title: "ロードマップ | moni",
};

export default function RoadmapPage() {
  return <WorkspaceRoadmap />;
}
