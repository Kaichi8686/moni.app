import type { LeagueAiReview } from "@/lib/idea-league/types";

/** Early-phase eFootball-style point lines (AI / ops scoring). */
export const AI_DEMOTION_LINE = 4;
export const AI_STAY_LINE = 8;
export const AI_PROMOTION_LINE = 12;
export const AI_SCORE_CAP = 18;

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic local "AI / ops" review for the bootstrap league phase.
 * Peer voting stays available later; scores here drive 勝ち点.
 */
export function reviewIdeaWithAi(input: {
  title: string;
  content: string;
  appeal?: string | null;
}): LeagueAiReview {
  const title = input.title.trim();
  const content = input.content.trim();
  const appeal = (input.appeal ?? "").trim();
  const seed = hashSeed(`${title}\n${content}\n${appeal}`);

  let score = 5;
  // Substance
  if (content.length >= 40) score += 2;
  if (content.length >= 100) score += 2;
  if (content.length >= 180) score += 1;
  // Clarity / structure cues
  if (/[。！？.!?]/.test(content)) score += 1;
  if (/(まず|次に|最後に|具体|例えば|理由|だから)/.test(content)) score += 2;
  if (title.length >= 8 && title.length <= 28) score += 1;
  if (appeal.length >= 12) score += 1;
  // Mild variance so identical short stubs don't all land on the same band
  score += seed % 4;

  score = Math.max(2, Math.min(AI_SCORE_CAP, score));

  const comment = pickComment(score, seed);
  return {
    score,
    commentJa: comment.ja,
    commentEn: comment.en,
    reviewedAt: new Date().toISOString(),
    source: "ai",
  };
}

function pickComment(score: number, seed: number): { ja: string; en: string } {
  if (score >= AI_PROMOTION_LINE) {
    const opts = [
      {
        ja: "具体性と実行しやすさが高く、昇格ラインを十分に超える内容です。この調子で深掘りを続けましょう。",
        en: "Strong specificity and actionability — clearly above the promotion line. Keep deepening this angle.",
      },
      {
        ja: "課題の切り取りが鋭く、読み手の共感を呼べるアイデアです。勝ち点も高評価です。",
        en: "Sharp framing and relatable insight. High points for this week.",
      },
    ];
    return opts[seed % opts.length]!;
  }
  if (score >= AI_STAY_LINE) {
    const opts = [
      {
        ja: "方向性は良いです。もう一段、具体的な一手や場面を足すと昇格ラインに届きます。",
        en: "Good direction. One more concrete step or scene would push you to the promotion line.",
      },
      {
        ja: "残留ラインはクリア。誰のどんな場面を救うのかを一文足すと評価が伸びます。",
        en: "Above the stay line. Add one sentence on who and which moment this helps.",
      },
    ];
    return opts[seed % opts.length]!;
  }
  if (score >= AI_DEMOTION_LINE) {
    return {
      ja: "骨子は見えますが、課題と解決のつながりが薄いです。状況→一手→効果の順で整えてみましょう。",
      en: "The skeleton is there, but problem→solution is thin. Try situation → action → effect.",
    };
  }
  return {
    ja: "もう少し具体例が必要です。日常の一瞬を切り取って書き直すと、審査が通りやすくなります。",
    en: "Needs more concrete detail. Capture one everyday moment and rewrite for a clearer review.",
  };
}

export function zoneForAiScore(score: number): "promote" | "stay" | "risk" {
  if (score >= AI_PROMOTION_LINE) return "promote";
  if (score >= AI_STAY_LINE) return "stay";
  return "risk";
}
