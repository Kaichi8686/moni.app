import { IdeaHub } from "@/components/idea-hub/IdeaHub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "アイデア | moni",
  description: "マイアイデアを書いて残し、必要ならAIの発掘・相談で種を見つける場所。",
};

export default function IdeaPage() {
  return <IdeaHub />;
}
