import {
  parseCastEmotion,
  parseCastRole,
  parseMeterKey,
  parseOfficeScene,
  type CastEmotion,
  type CastRole,
  type MeterKey,
  type OfficeSceneId,
} from "@/lib/office/scenes";
import type { IncidentSpeaker } from "@/lib/office/types";

export type IncidentStageFields = {
  scene: OfficeSceneId;
  speaker: IncidentSpeaker;
  line: string;
  stakes: string;
  metersAtRisk: MeterKey[];
};

export function parseIncidentStageFields(raw: {
  scene?: unknown;
  speaker?: unknown;
  line?: unknown;
  stakes?: unknown;
  meters_at_risk?: unknown;
  metersAtRisk?: unknown;
}): IncidentStageFields | null {
  const scene = parseOfficeScene(raw.scene);
  if (!scene) return null;
  const speakerRaw = raw.speaker;
  if (!speakerRaw || typeof speakerRaw !== "object") return null;
  const sp = speakerRaw as Record<string, unknown>;
  const castRole =
    parseCastRole(sp.cast_role ?? sp.castRole) ??
    parseCastRole(sp.role);
  const emotion = parseCastEmotion(sp.emotion);
  if (!castRole || !emotion) return null;
  const line = String(raw.line ?? "").trim().slice(0, 40);
  const stakes = String(raw.stakes ?? "").trim().slice(0, 30);
  if (!line || !stakes) return null;
  const riskRaw = raw.meters_at_risk ?? raw.metersAtRisk;
  if (!Array.isArray(riskRaw) || riskRaw.length < 1 || riskRaw.length > 2) return null;
  const metersAtRisk: MeterKey[] = [];
  for (const item of riskRaw) {
    const key = parseMeterKey(item);
    if (!key) return null;
    if (!metersAtRisk.includes(key)) metersAtRisk.push(key);
  }
  if (metersAtRisk.length < 1) return null;
  return {
    scene,
    speaker: { castRole, emotion },
    line,
    stakes,
    metersAtRisk,
  };
}

export function defaultStageForType(
  type: "pinch" | "chance" | "people" | "rival",
): IncidentStageFields {
  const table: Record<typeof type, IncidentStageFields> = {
    pinch: {
      scene: "staff_trouble",
      speaker: { castRole: "newbie", emotion: "panic" },
      line: "社長、現場が回ってません！",
      stakes: "放置すると納期に間に合わない",
      metersAtRisk: ["morale"],
    },
    chance: {
      scene: "queue",
      speaker: { castRole: "veteran", emotion: "happy" },
      line: "社長、いい話が来ました！",
      stakes: "逃すと話題も売上も逃す",
      metersAtRisk: ["customers", "reputation"],
    },
    people: {
      scene: "new_hire",
      speaker: { castRole: "secretary", emotion: "worried" },
      line: "みんな、ちょっと元気がないみたいです",
      stakes: "士気が下がるとミスが増える",
      metersAtRisk: ["morale"],
    },
    rival: {
      scene: "rival",
      speaker: { castRole: "rival_ceo", emotion: "smug" },
      line: "そっちが動くなら、こちらもね",
      stakes: "差をつけられるとお客が流れる",
      metersAtRisk: ["reputation", "customers"],
    },
  };
  return table[type];
}

export function emotionAllowed(_role: CastRole, emotion: CastEmotion): boolean {
  return Boolean(emotion);
}
