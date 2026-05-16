type SuggestCtx = {
  phaseTitle?: string;
  phaseGoal?: string;
  pendingTasks?: string[];
  projectName?: string;
};

const GENERIC: string[] = [
  "チームで今日のゴールを1行で決める",
  "15分だけ、次の一手を紙に書く",
  "メンバー1人に進捗を聞く",
  "今日やることを3つに絞る",
  "完了したことを1つ振り返る",
];

const BY_PHASE_KEYWORD: { match: RegExp; ideas: string[] }[] = [
  {
    match: /リサーチ|調査|ヒアリング/i,
    ideas: [
      "競合 or ユーザーに質問を3つ用意する",
      "インタビュー用のメモを1枚作る",
      "調査結果を3行でまとめる",
    ],
  },
  {
    match: /商品|仕入|EC|販売/i,
    ideas: [
      "原価を1商品だけ計算する",
      "商品写真を1枚撮る",
      "販売ページの見出しを1つ書く",
    ],
  },
  {
    match: /開発|MVP|アプリ|Figma/i,
    ideas: [
      "画面ワイヤーを1枚だけ描く",
      "バグ or 改善点を1つメモする",
      "知り合い1人に試してもらう",
    ],
  },
  {
    match: /集客|告知|SNS/i,
    ideas: [
      "投稿文の下書きを1つ書く",
      "ストーリー用の写真を1枚選ぶ",
      "告知先リストに5人追加する",
    ],
  },
];

function poolFor(ctx: SuggestCtx): string[] {
  const out: string[] = [];
  const title = ctx.phaseTitle ?? "";
  for (const row of BY_PHASE_KEYWORD) {
    if (row.match.test(title) || row.match.test(ctx.phaseGoal ?? "")) {
      out.push(...row.ideas);
    }
  }
  if (ctx.pendingTasks?.length) {
    for (const t of ctx.pendingTasks.slice(0, 3)) {
      out.push(`「${t.slice(0, 20)}」を15分だけ進める`);
    }
  }
  if (ctx.phaseGoal?.trim()) {
    out.push(`${ctx.phaseGoal.slice(0, 18)}に近づく一手`);
  }
  return [...out, ...GENERIC];
}

export function pickLocalTodaySuggestion(ctx: SuggestCtx, exclude?: string): string {
  const pool = poolFor(ctx).filter((s) => s !== exclude);
  const list = pool.length > 0 ? pool : GENERIC;
  const daySeed = new Date().getDate() + new Date().getHours();
  const idx = (daySeed + (exclude?.length ?? 0)) % list.length;
  return list[idx] ?? list[0];
}
