import type { IdeaInterviewMessage, IdeaInterviewTheme, IdeaSeed } from "@/lib/idea-interview/types";
import { themeLabel } from "@/lib/idea-interview/types";

export type RuleChatResult = {
  ack: string;
  question: string;
  placeholder: string;
  readyForIdeas: boolean;
  closing: string;
  assistantMessage: string;
};

const OPENERS: Record<IdeaInterviewTheme, { question: string; placeholder: string }> = {
  school: {
    question: "学校で最近『もう少しこうだったらいいのに』と感じた場面はありますか？",
    placeholder: "例）文化祭の模擬店の行列がすごくて…みたいな話でOK",
  },
  parttime: {
    question: "バイトで『毎回これ面倒だな』と感じる作業や場面はありますか？",
    placeholder: "例）シフト交代の連絡が毎回バラバラで…みたいな話でOK",
  },
  club: {
    question: "部活で『準備や連絡が大変』だと感じた瞬間はありますか？",
    placeholder: "例）大会前の集合連絡がLINEで埋もれて…みたいな話でOK",
  },
  friends: {
    question: "友人関係で『もっとスムーズにしたい』と思った出来事はありますか？",
    placeholder: "例）割り勘の精算がいつもモヤモヤする…みたいな話でOK",
  },
  family: {
    question: "家庭や日常で『これが面倒』と感じることはありますか？",
    placeholder: "例）冷蔵庫の賞味期限チェックがつい後回し…みたいな話でOK",
  },
  other: {
    question: "最近の生活で『不便・モヤモヤ』した出来事をひとつ教えてください。",
    placeholder: "例）電車の乗り換え案内が分かりにくくて…みたいな話でOK",
  },
};

type Dig = {
  reflection: (snippet: string, raw: string) => string;
  question: (snippet: string) => string;
  placeholder: string;
};

const DIGS: Dig[] = [
  {
    reflection: (s, raw) =>
      `「${s || "そのモヤモヤ"}」は、意志の問題というより **ついそうなってしまう導線** が強いタイプに聞こえるよ 😊 ${
        raw.length > 20 ? "いま話してくれた状況だと、気づいたときにはもう行動が始まっている感じがありそう。" : "まだ輪郭は細いけど、日常のどこかで繰り返し起きていそう。"
      }\n\n**💡 ヒント**: 小さく止められるポイントが見えると、アイデアの種になりやすい。`,
    question: () => "それが起きる直前って、だいたいどんな場面・気分のことが多い？",
    placeholder: "例）授業終わりでお腹が空いて、つい寄ってしまう など",
  },
  {
    reflection: (s) =>
      `「${s || "その困りごと"}」の芯は、金額や手間そのものより **「予測できない／一瞬で決まってしまう」** ところにあることが多いよ 🙂 あとから後悔するなら、決める瞬間に一拍おける仕組みが効きやすい。\n\n**📝 次の材料**: 誰のどんな一日の流れで起きるかが見えると、もっと具体的な種になる。`,
    question: () => "あとからいちばん後悔するのは、どんな結果になったとき？",
    placeholder: "例）月末に残金が少なくて予定を諦めたとき など",
  },
  {
    reflection: (s) =>
      `ここまでの「${s || "モヤモヤ"}」を整理すると、困っている本人だけでなく、似た生活リズムの人にも起きやすそう 🙂 完璧な節約や管理より、普段の動線に乗る小さい工夫のほうが続きやすい。\n\n**🎯 理想** が分かると、アイデアの形がはっきりするよ。`,
    question: () => "もしうまく解消できたら、1週間後に何が変わってるのが理想？",
    placeholder: "例）週末に使えるお金が残って、友だちとの予定を入れられる など",
  },
  {
    reflection: (s) =>
      `「${s || "その話"}」からは、すでに何か対処（我慢・後回し・気にしないなど）をしていそうだけど、それが十分効いていない感じもする 👀\n\n**💡 いまの対処の限界** が見えると、次の一手のヒントになるよ。`,
    question: () => "いま自分なりにやっている対策ってある？ あるなら、どこで破綻しやすい？",
    placeholder: "例）家計アプリを入れたけど続かない、など",
  },
];

const CLOSINGS = [
  "ここまでの話だと、困りの核と理想の方向が見えてきたよ ✅ この材料で、小さく試せる **アイデアの種** を出してみるね 💡",
  "場面・きっかけ・理想が揃ってきたので、インタビュー内容に根ざした種の候補をまとめるよ ✨",
  "深掘りできた論点をベースに、今日から試せそうな **アイデアの種** を考えてみるね 🚀",
];

function pickSnippet(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > 28 ? `${t.slice(0, 28)}…` : t;
}

function looksConcrete(text: string): boolean {
  const t = text.trim();
  if (t.length >= 36) return true;
  return /(とき|時|毎回|LINE|連絡|会計|並|待|忘|面倒|困る|モヤ|友達|授業|部活|バイト|コンビニ|お金|使)/.test(t);
}

function hashPick(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return mod <= 0 ? 0 : h % mod;
}

export function firstAssistantForTheme(theme: IdeaInterviewTheme): {
  content: string;
  placeholder: string;
} {
  const o = OPENERS[theme];
  const label = themeLabel(theme);
  return {
    content: `${label}の話、一緒に掘ってみよう 🙂 日常のちょっとした詰まりの中に、試せる **アイデアの種** が隠れていることが多いよ 💡\n\n**👀 聞きたいこと**\n${o.question}`,
    placeholder: o.placeholder,
  };
}

export function ruleBasedChatReply(params: {
  theme: IdeaInterviewTheme;
  userTurns: number;
  latestUserMessage: string;
}): RuleChatResult {
  const { theme, userTurns, latestUserMessage } = params;
  const snippet = pickSnippet(latestUserMessage);
  const concrete = looksConcrete(latestUserMessage);

  const ready = userTurns >= 4 || (userTurns >= 3 && concrete);

  if (ready) {
    const closing = CLOSINGS[hashPick(latestUserMessage + String(userTurns), CLOSINGS.length)]!;
    const ack = `ここまで聞いてきた「${snippet || themeLabel(theme)}」まわりは、つい起きてしまう導線と、あとからの後悔がセットになっているタイプに整理できそう 🙂\n\n**💡 整理**: 誰の・どの場面の・どんな理想かが少し見えてきたので、いったん種に落としてみよう。`;
    return {
      ack,
      question: "",
      placeholder: "",
      readyForIdeas: true,
      closing,
      assistantMessage: `${ack}\n\n${closing}`,
    };
  }

  const dig = DIGS[hashPick(`${theme}:${userTurns}:${latestUserMessage.slice(0, 16)}`, DIGS.length)] ?? DIGS[0]!;
  const ack = dig.reflection(snippet, latestUserMessage);
  const question = dig.question(snippet);
  return {
    ack,
    question,
    placeholder: dig.placeholder,
    readyForIdeas: false,
    closing: "",
    assistantMessage: `${ack}\n\n**👀 次に聞きたい**\n${question}`,
  };
}

export function ruleBasedGenerateSeeds(params: {
  theme: IdeaInterviewTheme;
  messages: IdeaInterviewMessage[];
}): IdeaSeed[] {
  const label = themeLabel(params.theme);
  const userTexts = params.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
  const focus = pickSnippet(userTexts || label) || label;

  const pool: Omit<IdeaSeed, "id">[] = [
    {
      title: `${label}のつい負けを止める`,
      summary: `「${focus}」のように、決める前の一瞬で行動が始まってしまう詰まり向け。寄る前・払う前に一拍おけるリマインドやルールを、生活動線の近くに置く小さな実験。`,
    },
    {
      title: "後悔ポイント共有メモ",
      summary: "同じ場面で後悔した瞬間だけを短く残し、次に似た状況が来たときの自分用ヒントにする。完璧な家計管理ではなく、繰り返しポイントの可視化に寄せる。",
    },
    {
      title: "週末用に残す封筒ルール",
      summary: "先に『残したい用途』だけを分けておき、日常のつい使いを別枠にする。金額の大小より、用途の衝突を減らすことを目的にした案。",
    },
    {
      title: "友だち予定の先予約枠",
      summary: "付き合いとお金の板挟みが起きる人向け。先に小さな予算枠を決めてから誘いに乗る、という順番に変える実験。",
    },
  ];

  return pool.slice(0, 4).map((s, i) => ({
    id: `seed-${i + 1}`,
    title: s.title,
    summary: s.summary,
  }));
}
