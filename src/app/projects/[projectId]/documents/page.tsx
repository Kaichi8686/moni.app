import type { Metadata } from "next";
import WorkspaceDocuments from "@/components/projects/workspace/WorkspaceDocuments";

export const metadata: Metadata = {
  title: "ドキュメント | moni",
};

export default function DocumentsPage() {
  return <WorkspaceDocuments />;
}
