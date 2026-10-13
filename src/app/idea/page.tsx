import { IdeaHub } from "@/components/idea-hub/IdeaHub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "アイデア | moni",
  description: "マイアイデアを書き残し、AIで相談・発掘。ビジネスの種を見つけ、残す場所。",
};

export default function IdeaPage() {
  return <IdeaHub />;
}
