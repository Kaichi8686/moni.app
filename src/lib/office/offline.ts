import { clampScore, scoreTotal, storyToneFromTotal } from "@/lib/office/scoring";
import type {
  IncidentStrategy,
  IncidentTargetInternal,
  IncidentType,
  OfficeScores,
  StrategyKind,
} from "@/lib/office/types";

export type OfflineIncidentCtx = {
  companyName: string;
  companyAbout: string;
  recentTitles: string[];
  industryLabel?: string;
};

export type OfflineIncidentResult = {
  title: string;
  description: string;
  type: IncidentType;
  strategies: IncidentStrategy[];
  targets: IncidentTargetInternal[];
};

/** 旧オフライン案で説明を途中切断して混ぜた文（サー…らしい など） */
export function isMangledOfflineDescription(description: string): boolean {
  const d = String(description ?? "");
  return /…(らしい|としての|の現場)/.test(d) || /（[^）]{0,40}…[^）]{0,20}）/.test(d);
}

export function offlineStrategies(): IncidentStrategy[] {
  return [
    {
      id: "s1",
      kind: "safe",
      title: "小さく試す",
      summary: "リスクを抑えて効果を確かめてから広げる",
    },
    {
      id: "s2",
      kind: "standard",
      title: "巻き込み作戦",
      summary: "仲間や利用者と一緒に進め、バランスよく伸ばす",
    },
    {
      id: "s3",
      kind: "bold",
      title: "一発勝負",
      summary: "話題になる一手を打つ。外すと痛い",
    },
  ];
}

export function offlineTargets(companyAbout: string): IncidentTargetInternal[] {
  const about = companyAbout.trim() || "利用者";
  const slice = about.length > 10 ? `${about.slice(0, 10)}…` : about;
  return [
    { id: "t1", label: "熱心なファン", fit: "good" },
    { id: "t2", label: "初めての人", fit: "good" },
    { id: "t3", label: slice.slice(0, 12) || "関係者", fit: "ok" },
    { id: "t4", label: "無関心の人", fit: "mismatch" },
  ];
}

export function offlineIncident(ctx?: OfflineIncidentCtx): OfflineIncidentResult {
  const name = ctx?.companyName?.trim() || "きみの会社";
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
  const picked = list[Math.floor(Math.random() * list.length)]!;
  return {
    ...picked,
    strategies: offlineStrategies(),
    targets: offlineTargets(ctx?.companyAbout ?? ""),
  };
}

export function offlineScores(
  answer: string,
  opts?: { strategyKind?: StrategyKind; strategyTitle?: string },
): OfficeScores {
  const len = answer.trim().length;
  const base = Math.min(78, 38 + Math.floor(len / 8));
  const solve = clampScore(base + (answer.includes("！") ? 4 : 0));
  const fun = clampScore(base - 4 + (len % 7));
  const feasible = clampScore(base - 2);
  const fit = clampScore(base - (opts?.strategyKind === "custom" ? 0 : 2));
  const total = scoreTotal(solve, fun, feasible, fit);
  const tone = storyToneFromTotal(total);
  const kind = opts?.strategyKind ?? "standard";
  const plan = opts?.strategyTitle ?? "作戦";
  const story =
    tone === "great"
      ? `きみの案どおりに動いたら反応が熱かった。「${plan}」がハマり、新人のアヤが「これ、伸びる！」と叫んだ。ターゲットも前のめりで、次が楽しみな空気になった。`
      : tone === "bitter"
        ? `やってみたけど手応えは薄め。ベテランのケンが「方向は悪くない、角度を変えよう」と笑った。ほろ苦いけど、次の一手の材料は残った。`
        : `案を形にしたら、そこそこ良い反応が返ってきた。経理のミキが「数字も悪くないよ」とうなずいた。作戦「${plan}」は堅実に効いた感じ。`;

  return {
    solve,
    fun,
    feasible,
    fit,
    total,
    comment: "いい着眼点！もう一段具体にすると伸びそう。",
    story: story.slice(0, 180),
    storyTone: tone,
    nextHint: "次はターゲットの反応を一文で想像して書いてみよう",
  };
}
