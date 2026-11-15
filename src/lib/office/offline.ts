import { clampScore, scoreTotal } from "@/lib/office/scoring";
import type { IncidentType, OfficeScores } from "@/lib/office/types";

export type OfflineIncidentCtx = {
  companyName: string;
  industryLabel: string;
  recentTitles: string[];
};

export function offlineIncident(
  ctx?: OfflineIncidentCtx,
): { title: string; description: string; type: IncidentType } {
  const name = ctx?.companyName?.trim() || "きみの会社";
  const industry = ctx?.industryLabel || "会社";
  const pool: Array<{ title: string; description: string; type: IncidentType }> = [
    {
      title: "やる気が急降下！",
      description: `${industry}『${name}』で三日坊主ばかり。新企画が進まない…どうする？`,
      type: "people",
    },
    {
      title: "突然の大人気！",
      description: `『${name}』に行列ができた。チャンスを逃さない作戦は？`,
      type: "chance",
    },
    {
      title: "ライバルが隣に",
      description: `『${name}』の向かいに同業が出店。差別化アイデアを考えて！`,
      type: "rival",
    },
    {
      title: "ピークで大混乱",
      description: `『${name}』のランチピークで手が足りない。どう切り抜ける？`,
      type: "pinch",
    },
  ];
  const recent = new Set(ctx?.recentTitles ?? []);
  const filtered = pool.filter((p) => !recent.has(p.title));
  const list = filtered.length > 0 ? filtered : pool;
  return list[Math.floor(Math.random() * list.length)]!;
}

export function offlineScores(answer: string): OfficeScores {
  const len = answer.trim().length;
  const base = Math.min(78, 38 + Math.floor(len / 8));
  const solve = clampScore(base + (answer.includes("！") ? 4 : 0));
  const fun = clampScore(base - 4 + (len % 7));
  const feasible = clampScore(base - 2);
  return {
    solve,
    fun,
    feasible,
    total: scoreTotal(solve, fun, feasible),
    comment: "いい着眼点！もう一段具体にすると伸びそう。",
  };
}
