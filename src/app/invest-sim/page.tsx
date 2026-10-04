import type { Metadata } from "next";
import { InvestSimApp } from "@/components/invest-sim/InvestSimApp";

export const metadata: Metadata = {
  title: "投資AIシミュレーター",
  description:
    "金額と目標を設定するだけ。投資AIが銘柄選びから売買・レポートまで仮想運用します。実資金は不要です。",
};

export default function InvestSimPage() {
  return <InvestSimApp />;
}
