import type { Metadata } from "next";
import { InvestSimApp } from "@/components/invest-sim/InvestSimApp";

export const metadata: Metadata = {
  title: "投資実験シミュレーター",
  description:
    "資金と目標・期間を設定し、実際の株の動きを日々追いながらAIがゴールを目指す仮想投資実験。実資金は不要です。",
};

export default function InvestSimPage() {
  return <InvestSimApp />;
}
