import type { Metadata } from "next";
import WorkspaceBusinessIdea from "@/components/projects/workspace/WorkspaceBusinessIdea";

export const metadata: Metadata = {
  title: "ビジネスアイデア | moni",
};

export default function BusinessIdeaPage() {
  return <WorkspaceBusinessIdea />;
}
