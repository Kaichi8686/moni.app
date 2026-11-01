import { NextResponse } from "next/server";
import { geminiChat } from "@/lib/ai/geminiMessages";
import { clampNumber } from "@/lib/invest-sim/math";
import { normalizeInvestSimResult, parseJsonLoose } from "@/lib/invest-sim/parseResult";
import {
  INVEST_SIM_RESPONSE_SCHEMA,
  INVEST_SIM_SYSTEM,
  buildInvestSimUserPayload,
} from "@/lib/invest-sim/prompts";
import { ruleBasedInvestSim } from "@/lib/invest-sim/ruleEngine";
import type { InvestSimApiResponse, InvestSimInput, InvestSimMethodId } from "@/lib/invest-sim/types";
import { INVEST_SIM_METHOD_OPTIONS } from "@/lib/invest-sim/types";

export const runtime = "nodejs";

const METHOD_IDS = new Set(INVEST_SIM_METHOD_OPTIONS.map((o) => o.id));

function parseBody(raw: unknown): InvestSimInput | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const budgetYen = clampNumber(Number(b.budgetYen), 0, 1_000_000_000);
  const years = clampNumber(Math.round(Number(b.years)), 1, 50);
  const monthlyYen = clampNumber(Number(b.monthlyYen ?? 0), 0, 10_000_000);
  const customLimits = typeof b.customLimits === "string" ? b.customLimits.trim().slice(0, 500) : "";
  const methodsRaw = Array.isArray(b.methods) ? b.methods : [];
  const methods = methodsRaw
    .map((m) => String(m))
    .filter((m): m is InvestSimMethodId => METHOD_IDS.has(m as InvestSimMethodId))
    .slice(0, 8);

  if (budgetYen <= 0 && monthlyYen <= 0) return null;

  return { budgetYen, years, monthlyYen, methods, customLimits };
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "リクエストの形式が正しくありません。" } satisfies InvestSimApiResponse,
      { status: 400 },
    );
  }

  const input = parseBody(json);
  if (!input) {
    return NextResponse.json(
      {
        ok: false,
        error: "予算または毎月の積立を入力してください（年数は1〜50）。",
      } satisfies InvestSimApiResponse,
      { status: 400 },
    );
  }

  const fallback = ruleBasedInvestSim(input);

  const gemini = await geminiChat({
    system: INVEST_SIM_SYSTEM,
    messages: [{ role: "user", content: buildInvestSimUserPayload(input) }],
    temperature: 0.45,
    responseSchema: INVEST_SIM_RESPONSE_SCHEMA,
  });

  if (!gemini.ok) {
    return NextResponse.json({
      ok: true,
      mode: "demo",
      result: fallback,
    } satisfies InvestSimApiResponse);
  }

  const normalized = normalizeInvestSimResult(parseJsonLoose(gemini.text), input);
  if (!normalized) {
    return NextResponse.json({
      ok: true,
      mode: "demo",
      result: fallback,
    } satisfies InvestSimApiResponse);
  }

  return NextResponse.json({
    ok: true,
    mode: "gemini",
    result: normalized,
  } satisfies InvestSimApiResponse);
}
