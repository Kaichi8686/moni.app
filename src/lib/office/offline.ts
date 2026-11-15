import { clampScore, scoreTotal } from "@/lib/office/scoring";
import type { IncidentType, OfficeScores } from "@/lib/office/types";

export function offlineIncident(): { title: string; description: string; type: IncidentType } {
  const pool = [
    {
      title: "社員のやる気が急降下！",
      description: "三日坊主ばかりで新商品が完成しない…どうする？",
      type: "people" as const,
    },
    {
      title: "文化祭の模擬店が大行列！",
      description: "売り切れ寸前。チャンスを逃さない作戦を考えて！",
      type: "chance" as const,
    },
    {
      title: "ライバル店が隣にオープン",
      description: "同じメニューで勝負してきた。差別化アイデアは？",
      type: "rival" as const,
    },
    {
      title: "バイト先のレジがフリーズ",
      description: "ランチピークなのに会計できない…どう切り抜ける？",
      type: "pinch" as const,
    },
  ];
  return pool[Math.floor(Math.random() * pool.length)]!;
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
