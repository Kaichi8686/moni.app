import { notFound } from "next/navigation";
import { IssueWorkspaceCanvasPreviewClient } from "./IssueWorkspaceCanvasPreviewClient";

/** Local visual QA for the issue free-canvas workspace (disabled in production). */
export default function IssueWorkspaceCanvasPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <IssueWorkspaceCanvasPreviewClient />;
}
