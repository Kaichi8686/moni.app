import { NextResponse } from "next/server";
import { startExperiment } from "@/lib/invest-sim/liveEngine";
import type { ExperimentDurationDays, ExperimentSetup, RiskLevel } from "@/lib/invest-sim/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function asRisk(v: unknown): RiskLevel {
  if (v === "safe" || v === "balanced" || v === "growth") return v;
  return "balanced";
}

function asDuration(v: unknown): ExperimentDurationDays {
  const n = Number(v);
  if (n === 30 || n === 90 || n === 180 || n === 365) return n;
  return 90;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ExperimentSetup>;
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

    const setup: ExperimentSetup = {
      initialCapital: Math.floor(initialCapital),
      goalAmount: Math.floor(goalAmount),
      risk: asRisk(body.risk),
      durationDays: asDuration(body.durationDays),
      goalLabel: typeof body.goalLabel === "string" ? body.goalLabel.slice(0, 40) : undefined,
    };

    const result = await startExperiment(setup);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[invest-sim/start]", e);
    return NextResponse.json(
      { error: "実験を開始できませんでした。しばらくして再試行してください。" },
      { status: 500 },
    );
  }
}
