import { IdeaHub } from "@/components/idea-hub/IdeaHub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "アイデア | moni",
  description: "発掘・マイアイデア・インタビュー。ビジネスの種を見つけ、残し、学ぶ場所。",
};

export default function IdeaPage() {
  return <IdeaHub />;
}
