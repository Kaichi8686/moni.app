import { IdeaHub } from "@/components/idea-hub/IdeaHub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "アイデア | moni",
  description: "月〜土、毎日ひとつのアイデアを瓶に詰める。プレゼントを開けて、今週のボックスへ。",
};

export default function IdeaPage() {
  return <IdeaHub />;
}
