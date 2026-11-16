import { clampScore, scoreTotal } from "@/lib/office/scoring";
import type { IncidentType, OfficeScores } from "@/lib/office/types";

export type OfflineIncidentCtx = {
  companyName: string;
  /** 会社の説明（自由記述） */
  companyAbout: string;
  recentTitles: string[];
};

export function offlineIncident(
  ctx?: OfflineIncidentCtx,
): { title: string; description: string; type: IncidentType } {
  const name = ctx?.companyName?.trim() || "きみの会社";
  const about = ctx?.companyAbout?.trim() || "小さな会社";
  const short = about.length > 28 ? `${about.slice(0, 28)}…` : about;
  const pool: Array<{ title: string; description: string; type: IncidentType }> = [
    {
      title: "やる気が急降下！",
      description: `『${name}』（${short}）で三日坊主ばかり。新企画が進まない…どうする？`,
      type: "people",
    },
    {
      title: "突然の引き合い！",
      description: `『${name}』に想定外の依頼が来た。${short}らしいチャンスの活かし方は？`,
      type: "chance",
    },
    {
      title: "ライバルが現れた",
      description: `『${name}』と同系統の相手が近くに出てきた。${short}としての差別化は？`,
      type: "rival",
    },
    {
      title: "現場が回らない",
      description: `『${name}』で忙しくて手が足りない。${short}の現場をどう切り抜ける？`,
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
