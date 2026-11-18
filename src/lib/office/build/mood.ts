export const OFFICE_MOODS = ["great", "good", "low", "crisis"] as const;
export type OfficeMood = (typeof OFFICE_MOODS)[number];

export const MOOD_LABEL_JA: Record<OfficeMood, string> = {
  great: "絶好調",
  good: "好調",
  low: "低調",
  crisis: "ピンチ",
};

export type MoodInput = {
  /** 直近の達成率（新しい順でも古い順でも可。最大3件使う） */
  recentRatios: number[];
  /** 連続クリア数（ratio≥1.0） */
  streak: number;
};

/** 営業日が3回未満のときは good 固定 */
export function calcMood(input: MoodInput): OfficeMood {
  const ratios = input.recentRatios.slice(0, 3);
  if (ratios.length < 3) return "good";

  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const m = 0.6 * Math.min(avg / 1.5, 1) + 0.4 * Math.min(Math.max(0, input.streak) / 3, 1);

  if (m >= 0.75) return "great";
  if (m >= 0.5) return "good";
  if (m >= 0.3) return "low";
  return "crisis";
}

export function moodTitle(mood: OfficeMood, streak: number): string | null {
  if (mood === "great" && streak >= 3) return `${streak}日連続 絶好調`;
  if (mood === "crisis") return "立て直しチャンス";
  return null;
}

export function parseMood(raw: unknown): OfficeMood {
  const s = String(raw ?? "");
  return (OFFICE_MOODS as readonly string[]).includes(s) ? (s as OfficeMood) : "good";
}
