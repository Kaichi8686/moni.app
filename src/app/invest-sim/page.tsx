import { InvestSimApp } from "@/components/invest-sim/InvestSimApp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "投資シミュレーター",
  description: "予算・かける年・方法の限定を入力すると、投資AIが学習用シミュレーションを返します。",
};

export default function InvestSimPage() {
  return <InvestSimApp />;
}
