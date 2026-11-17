/** 月ごとの季節テーマ（事件生成プロンプト用） */
export type SeasonTheme = {
  month: number;
  labelJa: string;
  promptHint: string;
};

export const OFFICE_SEASON_THEMES: SeasonTheme[] = [
  { month: 1, labelJa: "新年スタート", promptHint: "新年・目標・初売りっぽい空気" },
  { month: 2, labelJa: "バレンタイン商戦", promptHint: "贈り物・イベント・季節感" },
  { month: 3, labelJa: "卒業シーズン", promptHint: "卒業・進学・送別" },
  { month: 4, labelJa: "新生活", promptHint: "新学期・新社会人・スタート" },
  { month: 5, labelJa: "GWにぎわい", promptHint: "連休・人出・忙しい現場" },
  { month: 6, labelJa: "梅雨の工夫", promptHint: "雨・屋内・気分転換" },
  { month: 7, labelJa: "夏のピーク", promptHint: "夏・暑さ・夏休み需要" },
  { month: 8, labelJa: "夏祭りムード", promptHint: "祭り・イベント・屋台感" },
  { month: 9, labelJa: "秋の仕込み", promptHint: "新学期・秋・仕込み" },
  { month: 10, labelJa: "収穫・発表", promptHint: "発表会・収穫・成果見せ" },
  { month: 11, labelJa: "文化祭シーズン", promptHint: "文化祭・学園祭・模擬店" },
  { month: 12, labelJa: "年末商戦", promptHint: "年末・追い込み・感謝" },
];

export function seasonThemeFor(date: Date = new Date()): SeasonTheme {
  const month = date.getMonth() + 1;
  return OFFICE_SEASON_THEMES.find((t) => t.month === month) ?? OFFICE_SEASON_THEMES[0]!;
}
