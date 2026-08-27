import type { Metadata } from "next";
import WorkspaceWhiteboard from "@/components/projects/workspace/WorkspaceWhiteboard";

export const metadata: Metadata = {
  title: "ホワイトボード | moni",
};

export default function WhiteboardPage() {
  return <WorkspaceWhiteboard />;
}
