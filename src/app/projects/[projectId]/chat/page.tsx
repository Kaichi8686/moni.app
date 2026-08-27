import type { Metadata } from "next";
import WorkspaceChat from "@/components/projects/workspace/WorkspaceChat";

export const metadata: Metadata = {
  title: "チャット | moni",
};

export default function ProjectChatPage() {
  return <WorkspaceChat />;
}
