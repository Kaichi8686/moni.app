import { IdeaHub } from "@/components/idea-hub/IdeaHub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "アイデア | moni",
  description: "アイデアを見つける・相談する・メモする。種を見つけ、残し、仲間と進める場所。",
};

export default function IdeaPage() {
  return <IdeaHub />;
}
