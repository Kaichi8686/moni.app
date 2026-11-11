/** 毎日のお題（battle day key から決定論的に選ぶ） */
const WEEKLY_PROMPTS: { title: string; body: string }[] = [
  {
    title: "朝の「あと5分…」をなくすアイデア",
    body: "アラームを何度もスヌーズしてしまう朝。生活リズムを変える、誰でも試せるアイデアを出してください。",
  },
  {
    title: "勉強中のスマホ誘惑を断ち切る",
    body: "集中したいのに通知やSNSで手が伸びる。仕組み・デザイン・習慣のどれでもOKです。",
  },
  {
    title: "友だちとの約束がすぐ流れる問題",
    body: "「また今度」で終わってしまう予定調整を、もっと楽しく・確実にするアイデアを。",
  },
  {
    title: "学校・職場の「遠慮しすぎ」を減らす",
    body: "意見や助けを求めにくい空気をやわらげる、小さな仕組みやプロダクト案を出そう。",
  },
  {
    title: "ゴミ分別が面倒で続かない",
    body: "家庭や街の分別をもっと直感的に・ゲーム感覚で続けられるアイデアを募集。",
  },
  {
    title: "初対面の会話が続かない瞬間",
    body: "アイスブレイクを自然にする道具・アプリ・場づくりのアイデアを考えてください。",
  },
  {
    title: "迷子の「やる気」を取り戻す",
    body: "三日坊主になりがちな習慣を、続けたくなる形に変えるアイデアを。",
  },
  {
    title: "地域の「知らないお店」を見つける",
    body: "近所なのに行ったことがない店や場所との出会いを増やす仕組みを考えてみよう。",
  },
];

export const TUTORIAL_PROMPT = {
  title: "チュートリアル課題：カバンの中がカオス問題",
  body: "教科書・充電器・お菓子がごちゃ混ぜ。整理したくなる仕組みやプロダクトのアイデアを、短く自由に書いてみよう（この提出は本番の順位には入りません）。",
};

function hashWeekKey(weekKey: string): number {
  let h = 0;
  for (let i = 0; i < weekKey.length; i++) h = (h * 31 + weekKey.charCodeAt(i)) >>> 0;
  return h;
}

export function promptForWeek(weekKey: string): { title: string; body: string } {
  const i = hashWeekKey(weekKey) % WEEKLY_PROMPTS.length;
  return WEEKLY_PROMPTS[i] ?? WEEKLY_PROMPTS[0]!;
}
