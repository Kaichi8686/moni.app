import { clampScore, scoreTotal } from "@/lib/office/scoring";
import type { IncidentType, OfficeScores } from "@/lib/office/types";

export type OfflineIncidentCtx = {
  companyName: string;
  /** 会社の説明（自由記述） */
  companyAbout: string;
  recentTitles: string[];
};

/** 旧オフライン案で説明を途中切断して混ぜた文（サー…らしい など） */
export function isMangledOfflineDescription(description: string): boolean {
  const d = String(description ?? "");
  return /…(らしい|としての|の現場)/.test(d) || /（[^）]{0,40}…[^）]{0,20}）/.test(d);
}

export function offlineIncident(
  ctx?: OfflineIncidentCtx,
): { title: string; description: string; type: IncidentType } {
  const name = ctx?.companyName?.trim() || "きみの会社";
  // 説明文は文中に埋め込まない（途中切断で文字が崩れるのを防ぐ）
  const pool: Array<{ title: string; description: string; type: IncidentType }> = [
    {
      title: "やる気が急降下！",
      description: `『${name}』で三日坊主ばかり。いまの事業に合う立て直し方は？`,
      type: "people",
    },
    {
      title: "突然の引き合い！",
      description: `『${name}』に想定外の依頼が来た。強みを活かすチャンスのつかみ方は？`,
      type: "chance",
    },
    {
      title: "ライバルが現れた",
      description: `『${name}』と同系統の相手が出てきた。どう差別化する？`,
      type: "rival",
    },
    {
      title: "現場が回らない",
      description: `『${name}』で忙しくて手が足りない。いまのやり方でどう切り抜ける？`,
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
