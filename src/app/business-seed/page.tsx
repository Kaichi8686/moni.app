import { BusinessSeedApp } from "@/components/business-seed/BusinessSeedApp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "7日ビジネス種チャレンジ | moni",
  description: "7日以内にアイデアを形に。壁打ち→7日ロードマップ→今日の一歩。",
};

export default function BusinessSeedPage() {
  return <BusinessSeedApp />;
}
