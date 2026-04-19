import type { RoadmapDay } from "./types";

/** OpenAI 未設定時のフォールバック */
export function defaultRoadmapFromIdea(idea: string): RoadmapDay[] {
  const short = idea.slice(0, 120);
  return [
    { day: 1, title: "課題の深掘り", detail: "誰が・いつ・どこで困るかを一列に書き出す。", task: `「${short.slice(0, 40)}…」について、課題を友だち1人に話してメモする` },
    { day: 2, title: "ターゲット明確化", detail: "最初のお客様を1人に絞る。", task: "ターゲットを1文で書き、根拠を1つ添える" },
    { day: 3, title: "仮説作成", detail: "うまくいく理由を「もし〜なら〜」で書く。", task: "検証したい仮説を1つだけ書く" },
    { day: 4, title: "検証", detail: "アンケート or 聞き取りで最小検証。", task: "3人に同じ質問をして結果をメモ" },
    { day: 5, title: "改善", detail: "フィードバックから次の一手。", task: "改善案を1つ決め、明日試す行動を書く" },
    { day: 6, title: "簡易アウトプット", detail: "スライド3枚 or ポスター1枚。", task: "1枚だけ作って誰かに見せる" },
    { day: 7, title: "まとめ・振り返り", detail: "学びと次の目標。", task: "200字で振り返りを書く" },
  ];
}
