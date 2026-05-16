import type { Metadata } from "next";
import WorkspaceRoadmap from "@/components/projects/workspace/WorkspaceRoadmap";

export const metadata: Metadata = {
  title: "Roadmap | moni",
};

export default function RoadmapPage() {
  return <WorkspaceRoadmap />;
}
