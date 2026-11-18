import type { IncidentType } from "@/lib/office/types";

const SPEECH: Record<IncidentType, string[]> = {
  pinch: ["社長、大変です！", "現場が回ってません…", "これはピンチです！"],
  chance: ["社長、チャンスです！", "いい話が来ました！", "今が勝負どきです！"],
  people: ["社長、相談があります", "みんな元気がないみたいで…", "空気が重いです…"],
  rival: ["ライバルが来ました！", "向こうが動いてます", "負けたくないです！"],
};

/** タイプ別の社員セリフ（AI生成しない） */
export function pickIncidentSpeech(type: IncidentType, seed?: string): string {
  const list = SPEECH[type] ?? SPEECH.pinch;
  if (!list.length) return "社長！";
  if (!seed) return list[Math.floor(Math.random() * list.length)]!;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length]!;
}
