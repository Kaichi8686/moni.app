import { NextResponse } from "next/server";
import { runInvestAiSimulation } from "@/lib/invest-sim/aiEngine";
import type { InvestSimRequest, RiskLevel } from "@/lib/invest-sim/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function asRisk(v: unknown): RiskLevel {
  if (v === "safe" || v === "balanced" || v === "growth") return v;
  return "balanced";
}

function asYears(v: unknown): 1 | 2 | 3 {
  const n = Number(v);
  if (n === 1 || n === 2 || n === 3) return n;
  return 3;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<InvestSimRequest>;
    const initialCapital = Number(body.initialCapital);
    const goalAmount = Number(body.goalAmount);

    if (!Number.isFinite(initialCapital) || initialCapital < 10_000) {
      return NextResponse.json(
        { error: "初期資金は 10,000 円以上で指定してください。" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(goalAmount) || goalAmount < initialCapital) {
      return NextResponse.json(
        { error: "目標金額は初期資金以上で指定してください。" },
        { status: 400 },
      );
    }

    const input: InvestSimRequest = {
      initialCapital: Math.floor(initialCapital),
      goalAmount: Math.floor(goalAmount),
      risk: asRisk(body.risk),
      years: asYears(body.years),
      goalLabel: typeof body.goalLabel === "string" ? body.goalLabel.slice(0, 40) : undefined,
    };

    const result = await runInvestAiSimulation(input);
    return NextResponse.json({ result });
  } catch (e) {
    console.error("[invest-sim/run]", e);
    return NextResponse.json(
      { error: "シミュレーションに失敗しました。しばらくして再試行してください。" },
      { status: 500 },
    );
  }
}
