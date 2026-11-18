import type { CastEmotion, MeterKey } from "@/lib/office/scenes";
import type { OfficeMeters } from "@/lib/office/meters";
import type { StoryTone } from "@/lib/office/types";

export type ResultPanelKind = "situation" | "choice" | "outcome";

export type ResultPanel = {
  kind: ResultPanelKind;
  caption: string;
  body: string;
  emotion?: CastEmotion | null;
};

export type BuildResultPanelsInput = {
  incidentTitle: string;
  incidentLine?: string | null;
  incidentDescription?: string | null;
  strategyTitle: string;
  targetLabels: string[];
  story: string;
  storyTone: StoryTone;
  comment?: string | null;
};

const NPC_BY_TONE: Record<StoryTone, { emotion: CastEmotion; line: string }> = {
  great: { emotion: "happy", line: "うまくいった！次もこの調子だよ！" },
  ok: { emotion: "smug", line: "まずまず。次はもう一歩攻めてみよっか。" },
  bitter: { emotion: "worried", line: "うう…次は別の打ち手でいこう。" },
};

export function reactionForTone(tone: StoryTone): { emotion: CastEmotion; line: string } {
  return NPC_BY_TONE[tone] ?? NPC_BY_TONE.ok;
}

function firstSentence(text: string, fallback: string): string {
  const raw = text.trim();
  if (!raw) return fallback;
  const parts = raw
    .split(/(?<=[。！？])/u)
    .map((s) => s.trim())
    .filter(Boolean);
  return (parts[0] ?? raw).slice(0, 80);
}

/** 提出結果の3コマ（状況→作戦→結果）をサーバー側で組み立てる */
export function buildResultPanels(input: BuildResultPanelsInput): ResultPanel[] {
  const situationBody =
    (input.incidentLine?.trim() ||
      firstSentence(input.incidentDescription ?? "", input.incidentTitle) ||
      input.incidentTitle).slice(0, 80);

  const targets =
    input.targetLabels.length > 0 ? input.targetLabels.join("・") : "ターゲット未設定";
  const choiceBody = `「${input.strategyTitle}」で、${targets}に挑んだ。`.slice(0, 90);

  const reaction = reactionForTone(input.storyTone);
  const outcomeBody = firstSentence(
    input.story || input.comment || "",
    reaction.line,
  );

  return [
    {
      kind: "situation",
      caption: "① 状況",
      body: situationBody,
      emotion: "worried",
    },
    {
      kind: "choice",
      caption: "② 作戦",
      body: choiceBody,
      emotion: "smug",
    },
    {
      kind: "outcome",
      caption: "③ 結果",
      body: outcomeBody,
      emotion: reaction.emotion,
    },
  ];
}

export function parseResultPanels(raw: unknown): ResultPanel[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ResultPanel[] = [];
  for (const item of raw.slice(0, 3)) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const kind = String(row.kind ?? "") as ResultPanelKind;
    if (kind !== "situation" && kind !== "choice" && kind !== "outcome") return null;
    const caption = String(row.caption ?? "").trim().slice(0, 20);
    const body = String(row.body ?? "").trim().slice(0, 120);
    if (!caption || !body) return null;
    const emotionRaw = row.emotion == null ? null : String(row.emotion);
    out.push({
      kind,
      caption,
      body,
      emotion: (emotionRaw as CastEmotion) || null,
    });
  }
  return out.length === 3 ? out : null;
}

export function parseMetersDelta(raw: unknown): Partial<OfficeMeters> | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const out: Partial<OfficeMeters> = {};
  for (const key of ["customers", "morale", "reputation", "cash"] as MeterKey[]) {
    if (row[key] == null) continue;
    const n = Number(row[key]);
    if (!Number.isFinite(n)) continue;
    out[key] = Math.round(n);
  }
  return Object.keys(out).length ? out : null;
}
