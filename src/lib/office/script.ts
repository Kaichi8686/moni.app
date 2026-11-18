import type { CastMember } from "@/lib/office/cast";
import {
  parseCastEmotion,
  parseCastRole,
  parseOfficeScene,
  type CastEmotion,
  type CastRole,
  type OfficeSceneId,
} from "@/lib/office/scenes";

export const SCRIPT_ACTIONS = ["enter", "shake", "jump", "point", "none"] as const;
export type ScriptAction = (typeof SCRIPT_ACTIONS)[number];

export const QUESTION_KINDS = ["situation", "cause", "limit"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export type ScriptBeat = {
  actor: CastRole;
  emotion: CastEmotion;
  line: string;
  action: ScriptAction;
  scene?: OfficeSceneId | null;
};

export type IncidentMission = {
  goal: string;
  constraint: string;
};

export type IncidentQuestion = {
  id: string;
  kind: QuestionKind;
  ask: string;
  answer: string;
  clue: string;
  actor: CastRole;
};

export type IncidentDialogue = {
  script: ScriptBeat[];
  mission: IncidentMission;
  questions: IncidentQuestion[];
};

function parseAction(raw: unknown): ScriptAction | null {
  const s = String(raw ?? "").trim();
  return (SCRIPT_ACTIONS as readonly string[]).includes(s) ? (s as ScriptAction) : null;
}

function parseKind(raw: unknown): QuestionKind | null {
  const s = String(raw ?? "").trim();
  return (QUESTION_KINDS as readonly string[]).includes(s) ? (s as QuestionKind) : null;
}

export function parseScriptBeat(raw: unknown): ScriptBeat | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const actor = parseCastRole(row.actor ?? row.cast_role ?? row.castRole);
  const emotion = parseCastEmotion(row.emotion);
  const action = parseAction(row.action) ?? "none";
  const line = String(row.line ?? "").trim();
  if (!actor || !emotion || !line || line.length > 40) return null;
  const sceneRaw = row.scene;
  const scene =
    sceneRaw == null || sceneRaw === ""
      ? null
      : parseOfficeScene(sceneRaw);
  if (sceneRaw != null && sceneRaw !== "" && !scene) return null;
  return { actor, emotion, line, action, scene };
}

export function parseMission(raw: unknown): IncidentMission | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const goal = String(row.goal ?? "").trim();
  const constraint = String(row.constraint ?? "").trim();
  if (!goal || goal.length > 30) return null;
  if (!constraint || constraint.length > 30) return null;
  return { goal, constraint };
}

export function parseQuestion(raw: unknown, index: number): IncidentQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const kind = parseKind(row.kind);
  const actor = parseCastRole(row.actor ?? row.cast_role ?? row.castRole);
  const ask = String(row.ask ?? "").trim();
  const answer = String(row.answer ?? "").trim();
  let clue = String(row.clue ?? "").trim();
  if (!kind || !actor || !ask || !answer) return null;
  if (ask.length > 16 || answer.length > 50) return null;
  if (!clue) clue = answer.slice(0, 20);
  if (clue.length > 20) clue = clue.slice(0, 20);
  const id = String(row.id ?? `q${index + 1}`).trim().slice(0, 12) || `q${index + 1}`;
  return { id, kind, ask, answer, clue, actor };
}

/** 台本・ミッション・質問の検証。違反は null */
export function parseIncidentDialogue(raw: {
  script?: unknown;
  mission?: unknown;
  questions?: unknown;
  line?: unknown;
  speaker?: unknown;
}): IncidentDialogue | null {
  if (!Array.isArray(raw.script) || raw.script.length < 3 || raw.script.length > 5) {
    return null;
  }
  const script: ScriptBeat[] = [];
  for (const item of raw.script) {
    const beat = parseScriptBeat(item);
    if (!beat) return null;
    script.push(beat);
  }
  const mission = parseMission(raw.mission);
  if (!mission) return null;
  if (!Array.isArray(raw.questions) || raw.questions.length !== 3) return null;
  const questions: IncidentQuestion[] = [];
  const kinds = new Set<QuestionKind>();
  for (let i = 0; i < raw.questions.length; i++) {
    const q = parseQuestion(raw.questions[i], i);
    if (!q) return null;
    kinds.add(q.kind);
    questions.push(q);
  }
  if (kinds.size < 2) return null;
  return { script, mission, questions };
}

/** セリフの {name:role} を cast 名に置換 */
export function applyNamePlaceholders(text: string, cast: CastMember[]): string {
  return text.replace(/\{name:([a-z_]+)\}/g, (_m, role: string) => {
    const member = cast.find((c) => c.role === role);
    return member?.name ?? "同僚";
  });
}

export function defaultDialogueForType(
  type: "pinch" | "chance" | "people" | "rival",
): IncidentDialogue {
  const table: Record<typeof type, IncidentDialogue> = {
    pinch: {
      script: [
        {
          actor: "newbie",
          emotion: "panic",
          line: "社長、現場が止まってます！",
          action: "enter",
        },
        {
          actor: "veteran",
          emotion: "worried",
          line: "{name:newbie}の言うとおり、手が足りない",
          action: "shake",
        },
        {
          actor: "secretary",
          emotion: "worried",
          line: "早めに打ち手を決めましょう",
          action: "point",
        },
      ],
      mission: {
        goal: "現場を今日中に回す",
        constraint: "追加コストは最小に",
      },
      questions: [
        {
          id: "q1",
          kind: "situation",
          ask: "いま何が止まってる？",
          answer: "受付と梱包が詰まって、順番待ちが増えてるよ",
          clue: "受付と梱包が詰まってる",
          actor: "newbie",
        },
        {
          id: "q2",
          kind: "cause",
          ask: "原因は何だと思う？",
          answer: "急な注文増に、役割分担が追いついてない",
          clue: "役割分担が追いつかない",
          actor: "veteran",
        },
        {
          id: "q3",
          kind: "limit",
          ask: "やってはいけないことは？",
          answer: "品質を落として数を稼ぐのはNGだよ",
          clue: "品質を落とすのはNG",
          actor: "secretary",
        },
      ],
    },
    chance: {
      script: [
        {
          actor: "veteran",
          emotion: "happy",
          line: "社長、いい話が来ました！",
          action: "enter",
        },
        {
          actor: "regular",
          emotion: "smug",
          line: "今動いたら話題になれそう",
          action: "jump",
        },
        {
          actor: "accountant",
          emotion: "worried",
          line: "でも予算は限られてるよ",
          action: "point",
        },
      ],
      mission: {
        goal: "話題を売上につなげる",
        constraint: "予算は抑える",
      },
      questions: [
        {
          id: "q1",
          kind: "situation",
          ask: "どんなチャンス？",
          answer: "地元メディアが特集を探してるらしい",
          clue: "地元メディアが特集探し",
          actor: "veteran",
        },
        {
          id: "q2",
          kind: "cause",
          ask: "なぜ今なの？",
          answer: "季節のイベントが近く、取材枠が空いてる",
          clue: "季節イベントで取材枠あり",
          actor: "regular",
        },
        {
          id: "q3",
          kind: "limit",
          ask: "避けたい失敗は？",
          answer: "盛りすぎて当日に崩壊するのは避けたい",
          clue: "盛りすぎて崩壊はNG",
          actor: "accountant",
        },
      ],
    },
    people: {
      script: [
        {
          actor: "secretary",
          emotion: "worried",
          line: "みんな、元気がないみたいです",
          action: "enter",
        },
        {
          actor: "newbie",
          emotion: "worried",
          line: "朝からあまり話が弾まなくて…",
          action: "shake",
        },
        {
          actor: "veteran",
          emotion: "angry",
          line: "放っておくとミスが増えるぞ",
          action: "point",
        },
      ],
      mission: {
        goal: "チームの空気を立て直す",
        constraint: "誰かを責めない",
      },
      questions: [
        {
          id: "q1",
          kind: "situation",
          ask: "誰がつらそう？",
          answer: "{name:newbie}まわりが特に黙りがち",
          clue: "新人まわりが黙りがち",
          actor: "secretary",
        },
        {
          id: "q2",
          kind: "cause",
          ask: "きっかけは？",
          answer: "昨日のミス共有がきつく聞こえたらしい",
          clue: "ミス共有がきつく聞こえた",
          actor: "newbie",
        },
        {
          id: "q3",
          kind: "limit",
          ask: "やってはいけないことは？",
          answer: "公開の場で個人を名指ししないで",
          clue: "公開で名指しはNG",
          actor: "veteran",
        },
      ],
    },
    rival: {
      script: [
        {
          actor: "rival_ceo",
          emotion: "smug",
          line: "そっちが動くなら、こちらもね",
          action: "enter",
          scene: "rival",
        },
        {
          actor: "regular",
          emotion: "panic",
          line: "向こう、先に告知出したよ！",
          action: "shake",
        },
        {
          actor: "veteran",
          emotion: "worried",
          line: "差をつけられる前に手を打とう",
          action: "point",
        },
      ],
      mission: {
        goal: "ライバルに差をつけられない",
        constraint: "悪口合戦はしない",
      },
      questions: [
        {
          id: "q1",
          kind: "situation",
          ask: "向こうは何をしてる？",
          answer: "割引と短い動画で注目を集め始めてる",
          clue: "割引と短い動画で注目",
          actor: "regular",
        },
        {
          id: "q2",
          kind: "cause",
          ask: "うちの弱みは？",
          answer: "告知のスピードが遅れがちだよ",
          clue: "告知スピードが遅れがち",
          actor: "veteran",
        },
        {
          id: "q3",
          kind: "limit",
          ask: "やってはいけないことは？",
          answer: "相手をけなす投稿は絶対ダメ",
          clue: "相手をけなすのはNG",
          actor: "secretary",
        },
      ],
    },
  };
  return table[type];
}

export function ensureIncidentDialogue(
  raw: {
    script?: unknown;
    mission?: unknown;
    questions?: unknown;
  },
  type: "pinch" | "chance" | "people" | "rival",
  fallbackLine?: string | null,
  fallbackSpeaker?: { castRole: CastRole; emotion: CastEmotion } | null,
): IncidentDialogue {
  const parsed = parseIncidentDialogue(raw);
  if (parsed) return parsed;
  const base = defaultDialogueForType(type);
  if (fallbackLine && fallbackSpeaker) {
    const head: ScriptBeat = {
      actor: fallbackSpeaker.castRole,
      emotion: fallbackSpeaker.emotion,
      line: fallbackLine.slice(0, 40),
      action: "enter",
    };
    base.script = [head, ...base.script.slice(1)].slice(0, 5);
  }
  return base;
}
