import { BASE_STUDENT_COACH_SYSTEM_PROMPT } from "@/lib/ai/studentCoachPrompt";

export type GeminiAgentMode = "roadmap" | "general" | "ideas";

export const GEMINI_AGENT_META: Record<
  GeminiAgentMode,
  { label: string; desc: string; placeholder: string }
> = {
  roadmap: {
    label: "ロードマップ",
    desc: "やることを段階に分けて計画を作る",
    placeholder: "例: 3ヶ月でMVPを出す計画を作って",
  },
  general: {
    label: "なんでも相談",
    desc: "困りごと・雑談・質問なんでもOK",
    placeholder: "例: チームで意見がまとまらない",
  },
  ideas: {
    label: "アイデア編",
    desc: "企画のアイデアをたくさん出す",
    placeholder: "例: ユーザーに刺さる機能アイデアを10個",
  },
};

const JSON_FENCE = /```(?:json)?\s*([\s\S]*?)```/i;

function findBalancedJsonObject(text: string, anchor: string): string | null {
  const idx = text.indexOf(anchor);
  if (idx < 0) return null;
  const start = text.lastIndexOf("{", idx);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function extractJsonBlock<T>(text: string): T | null {
  const match = text.match(JSON_FENCE);
  const fenced = match?.[1]?.trim();
  if (fenced) {
    try {
      return JSON.parse(fenced) as T;
    } catch {
      /* fall through */
    }
  }
  const raw = text.trim();
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      /* fall through */
    }
  }
  const embedded = findBalancedJsonObject(text, '"phases"') ?? findBalancedJsonObject(text, '"ideas"');
  if (embedded) {
    try {
      return JSON.parse(embedded) as T;
    } catch {
      return null;
    }
  }
  return null;
}

export function stripJsonBlock(text: string): string {
  return text.replace(JSON_FENCE, "").trim();
}

/** ── ロードマップ用 JSON ── */
export type RoadmapTaskJson = { task_title: string; advice?: string };
export type RoadmapPhaseJson = {
  phase_name: string;
  timeline?: string;
  why?: string;
  tasks: RoadmapTaskJson[];
};
export type RoadmapAgentPayload = { phases: RoadmapPhaseJson[] };

/** ── アイデア編 JSON ── */
export type IdeaBrainstormItem = {
  title: string;
  pitch?: string;
  first_step?: string;
};
export type IdeasAgentPayload = { ideas: IdeaBrainstormItem[] };

const SHARED = `${BASE_STUDENT_COACH_SYSTEM_PROMPT}

あなたは子どもたちのビジネス・企画に伴走するメンターです。
難しい専門用語は使わず、中学生にもわかる言葉で話してください。`;

export const ROADMAP_AGENT_SYSTEM = `${SHARED}

【あなたの役割: ロードマップ専門AI】
- ユーザーの話を聞き、やることを段階（フェーズ）に分けた計画を作る
- 毎回、まず2〜4文でやさしく要約してから JSON を出す
- 必ず応答の最後に \`\`\`json コードブロックを1つだけ付ける

JSONスキーマ:
{
  "phases": [
    {
      "phase_name": "フェーズ名",
      "timeline": "今日|今週中|来週までに|今月中",
      "why": "なぜこの段階が必要か",
      "tasks": [
        { "task_title": "動詞で終わるやること", "advice": "困ったときのヒント" }
      ]
    }
  ]
}
- phases は最大5個、各 tasks は1〜3個
- 最初のフェーズは「今日」できることから`;

export const GENERAL_AGENT_SYSTEM = `${SHARED}

【あなたの役割: なんでも相談AI（プロジェクト伴走メンター）】
雑談・不安・質問・愚痴・行き詰まりなど、なんでも受け止める。ただし相談がプロジェクトや進め方に関わるときは、一般論で終わらせず、渡された【プロジェクト情報】に即した具体案を出す。

【回答の構成（相談がプロジェクト／進め方／迷いのとき）】
次の順で書く。見出しは短くてよい（「現状」「提案」など）。JSON・表は絶対に出さない。
1. 受け止め … 相手の状況・気持ちを1〜2文で拾う
2. 現状分析 … プロジェクト名・説明・課題の進み具合など、渡された情報を踏まえて整理する（情報がない項目は無理に捏造しない）
3. 具体提案 … 状況に即した例を2〜3個。誰が・何を・いつまでに、が分かる粒度にする
4. 次アクション … 「今日」または「今週」にできる一歩を1つ、動詞で明確に書く
5. 想定障害と備え … うまくいかないときの逃げ道を1つ
6. （任意）深掘り質問 … 判断に必要な情報を聞くなら質問は最大1つ

【長さ・トーン】
- 通常はおおよそ400〜900字。短文の雑談ならコンパクトでよいが、薄い一般論で終わらない
- 高校生・大学生にもわかる言葉。上から目線にせず、一緒に考えるトーン
- 専門語は言い換える（共通ルールに従う）

【良い回答例1】
ユーザー: チームで意見がまとまらなくて進まない
アシスタント:
意見が割れて止まっているのは、やる気不足というより「決めるルール」がまだ弱いことが多いよ。
いまの課題がいくつか未完了のままなら、まず「今週やることを1つに絞る」と空気が変わりやすい。
提案:
1) 候補を3つまで紙に書き、各自が「今日やるならどれ？」を1つだけ選ぶ
2) 過半数で決める。同数ならオーナー（または当番）が仮決めして48時間試す
3) 決まらなかった案は「来週の候補リスト」に移して今日は触らない
次アクション: 今日中に15分ミーティングを入れ、「今週の1つ」を紙に書いてチャットに貼る。
うまくいかないとき: 集まらなければ、チャットで候補3つ＋投票〆切をTonightに送るだけでもOK。
1つ聞きたい: いま一番対立しているのは「何を作るか」と「いつまでにやるか」のどっち？

【良い回答例2】
ユーザー: 何から手をつければいいかわからない
アシスタント:
ゼロから全部やろうとすると止まりやすいから、「小さくて効果が見える一歩」からで大丈夫。
プロジェクト説明に「〇〇向け」とあるなら、まずその人の困りごとを1つ聞くのが最短ルートになりやすい。
提案:
1) 想定ユーザー候補を3人リストアップする（友だち・先輩・家族でも可）
2) 「いま一番面倒なのは？」を1問だけ聞く（5分）
3) 聞いた答えをチャットに1行メモする
次アクション: 今日、候補3人の名前だけ書き出す（完成させなくていい）。
うまくいかないとき: 人が思いつかなければ、自分自身に「先週いちばん面倒だったこと」を書いて仮ユーザーにする。`

export const IDEAS_AGENT_SYSTEM = `${SHARED}

【あなたの役割: アイデア編AI】
- ブレスト向けに、具体的でワクワクするアイデアをたくさん出す
- まず1〜2文で励ましや方向性を書き、そのあと JSON を出す
- 必ず応答の最後に \`\`\`json コードブロックを1つだけ付ける

JSONスキーマ:
{
  "ideas": [
    {
      "title": "アイデア名（短く）",
      "pitch": "なぜいいか（1行）",
      "first_step": "今日できる最初の一歩"
    }
  ]
}
- ideas は5〜8個
- ありきたりすぎないが、高校生でも実行できる案にする`;

export function systemPromptForMode(mode: GeminiAgentMode): string {
  if (mode === "roadmap") return ROADMAP_AGENT_SYSTEM;
  if (mode === "ideas") return IDEAS_AGENT_SYSTEM;
  return GENERAL_AGENT_SYSTEM;
}

export function normalizeRoadmapPayload(raw: unknown): RoadmapAgentPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const phasesRaw = (raw as { phases?: unknown }).phases;
  if (!Array.isArray(phasesRaw) || phasesRaw.length === 0) return null;
  const phases = phasesRaw
    .map((p): RoadmapPhaseJson | null => {
      if (!p || typeof p !== "object") return null;
      const row = p as Record<string, unknown>;
      const phase_name = String(row.phase_name ?? row.name ?? row.title ?? "").trim();
      if (!phase_name) return null;
      const tasksRaw = Array.isArray(row.tasks) ? row.tasks : [];
      const tasks = tasksRaw
        .map((t): RoadmapTaskJson | null => {
          if (!t || typeof t !== "object") return null;
          const tr = t as Record<string, unknown>;
          const task_title = String(tr.task_title ?? tr.title ?? tr.name ?? "").trim();
          if (!task_title) return null;
          const advice = tr.advice ? String(tr.advice).trim() : undefined;
          return advice ? { task_title, advice } : { task_title };
        })
        .filter((x): x is RoadmapTaskJson => x !== null);
      return {
        phase_name,
        timeline: row.timeline ? String(row.timeline).trim() : undefined,
        why: row.why ? String(row.why).trim() : undefined,
        tasks,
      };
    })
    .filter((x): x is RoadmapPhaseJson => x !== null);
  return phases.length > 0 ? { phases } : null;
}

export function parseRoadmapPayload(text: string): RoadmapAgentPayload | null {
  return normalizeRoadmapPayload(extractJsonBlock(text));
}

export function roadmapSummaryReply(payload: RoadmapAgentPayload): string {
  const taskCount = payload.phases.reduce((n, p) => n + (p.tasks?.length ?? 0), 0);
  const names = payload.phases.map((p) => p.phase_name).slice(0, 3).join(" → ");
  return `計画案を作りました（${payload.phases.length}段階・やること${taskCount}件）。\n${names}${payload.phases.length > 3 ? " …" : ""}\n\n下の「ロードマップに反映」で保存できます。`;
}

export const ROADMAP_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    phases: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          phase_name: { type: "STRING" },
          timeline: { type: "STRING" },
          why: { type: "STRING" },
          tasks: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                task_title: { type: "STRING" },
                advice: { type: "STRING" },
              },
              required: ["task_title"],
            },
          },
        },
        required: ["phase_name", "tasks"],
      },
    },
  },
  required: ["phases"],
} as const;

export const IDEAS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    ideas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          pitch: { type: "STRING" },
          first_step: { type: "STRING" },
        },
        required: ["title"],
      },
    },
  },
  required: ["ideas"],
} as const;
