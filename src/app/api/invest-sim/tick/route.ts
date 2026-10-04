import { NextResponse } from "next/server";
import { tickExperiment } from "@/lib/invest-sim/liveEngine";
import type { ExperimentSession } from "@/lib/invest-sim/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function isSession(v: unknown): v is ExperimentSession {
  if (!v || typeof v !== "object") return false;
  const s = v as ExperimentSession;
  return s.version === 2 && !!s.setup && !!s.id && Array.isArray(s.briefings);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { session?: unknown };
    if (!isSession(body.session)) {
      return NextResponse.json({ error: "実験セッションが不正です。" }, { status: 400 });
    }

    const result = await tickExperiment(body.session);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[invest-sim/tick]", e);
    return NextResponse.json(
      { error: "相場の反映に失敗しました。しばらくして再試行してください。" },
      { status: 500 },
    );
  }
}
