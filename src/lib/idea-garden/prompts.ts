import { gardenBusinessDateKey, gardenNow } from "@/lib/idea-garden/calendar";

export type DailyPrompt = {
  id: string;
  ja: string;
  en: string;
};

/** 身の回りからアイデアを出す日替わり質問 */
const PROMPTS: DailyPrompt[] = [
  {
    id: "commute",
    ja: "通学・通勤中に、何か不便に感じたことはありますか？",
    en: "Did you feel any inconvenience while commuting today?",
  },
  {
    id: "friends",
    ja: "友達や家族とのやりとりで「もっとこうだったら」と思ったことは？",
    en: "What made you wish something were better with friends or family?",
  },
  {
    id: "school",
    ja: "学校や仕事で「これ面倒だな」と感じたことはありますか？",
    en: "What felt unnecessarily hard at school or work?",
  },
  {
    id: "money",
    ja: "お金や買い物で困った・モヤっとした場面はありましたか？",
    en: "Any friction around money or shopping lately?",
  },
  {
    id: "time",
    ja: "時間が足りない・待ち時間が長いと感じた瞬間はありますか？",
    en: "When did you feel short on time or stuck waiting?",
  },
  {
    id: "health",
    ja: "体調・睡眠・食事まわりで改善したいことはありますか？",
    en: "Anything around health, sleep, or meals you’d improve?",
  },
  {
    id: "fun",
    ja: "遊びや趣味で「こんなサービスあったら」と思ったことは？",
    en: "What service would make hobbies or fun better?",
  },
  {
    id: "info",
    ja: "調べものや連絡でストレスを感じたことはありますか？",
    en: "Any stress while searching for info or messaging people?",
  },
  {
    id: "space",
    ja: "部屋・ロッカー・カバンなど「場所」で困ったことは？",
    en: "Any space problems — room, locker, bag, storage?",
  },
  {
    id: "new",
    ja: "最近はじめて気づいた「もっと良くできること」は何ですか？",
    en: "What’s something new you noticed that could be better?",
  },
  {
    id: "waste",
    ja: "無駄だと感じたもの（時間・紙・お金）はありましたか？",
    en: "What felt wasteful — time, paper, money, energy?",
  },
  {
    id: "help",
    ja: "誰かを助けたい・助けてほしかった場面はありましたか？",
    en: "When did you want to help someone — or be helped?",
  },
];

function dayOfYearTokyo(date: Date = gardenNow()): number {
  const key = gardenBusinessDateKey(date);
  const [y, m, d] = key.split("-").map(Number);
  const start = Date.UTC(y, 0, 0);
  const now = Date.UTC(y, m - 1, d);
  return Math.floor((now - start) / 86_400_000);
}

export function dailyPromptFor(date: Date = gardenNow()): DailyPrompt {
  const idx = dayOfYearTokyo(date) % PROMPTS.length;
  return PROMPTS[idx]!;
}
