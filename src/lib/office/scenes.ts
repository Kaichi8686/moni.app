export const OFFICE_SCENES = [
  "queue",
  "complaint",
  "rival",
  "viral",
  "staff_trouble",
  "sold_out",
  "equipment",
  "vip",
  "rainy",
  "sns_fire",
  "deadline",
  "new_hire",
] as const;

export type OfficeSceneId = (typeof OFFICE_SCENES)[number];

export const OFFICE_SCENE_LABEL_JA: Record<OfficeSceneId, string> = {
  queue: "行列",
  complaint: "クレーム",
  rival: "ライバル",
  viral: "バズ",
  staff_trouble: "社員トラブル",
  sold_out: "売り切れ",
  equipment: "機材トラブル",
  vip: "大物客",
  rainy: "雨の日",
  sns_fire: "炎上気味",
  deadline: "締切",
  new_hire: "新人",
};

export function parseOfficeScene(raw: unknown): OfficeSceneId | null {
  const s = String(raw ?? "").trim();
  return (OFFICE_SCENES as readonly string[]).includes(s) ? (s as OfficeSceneId) : null;
}

export const CAST_ROLES = [
  "newbie",
  "veteran",
  "accountant",
  "regular",
  "rival_ceo",
  "secretary",
] as const;

export type CastRole = (typeof CAST_ROLES)[number];

export const CAST_EMOTIONS = ["panic", "angry", "happy", "worried", "smug"] as const;
export type CastEmotion = (typeof CAST_EMOTIONS)[number];

export const METER_KEYS = ["customers", "morale", "reputation", "cash"] as const;
export type MeterKey = (typeof METER_KEYS)[number];

export const METER_LABEL_JA: Record<MeterKey, string> = {
  customers: "お客",
  morale: "士気",
  reputation: "評判",
  cash: "資金",
};

export function parseMeterKey(raw: unknown): MeterKey | null {
  const s = String(raw ?? "").trim();
  return (METER_KEYS as readonly string[]).includes(s) ? (s as MeterKey) : null;
}

export function parseCastRole(raw: unknown): CastRole | null {
  const s = String(raw ?? "").trim();
  return (CAST_ROLES as readonly string[]).includes(s) ? (s as CastRole) : null;
}

export function parseCastEmotion(raw: unknown): CastEmotion | null {
  const s = String(raw ?? "").trim();
  return (CAST_EMOTIONS as readonly string[]).includes(s) ? (s as CastEmotion) : null;
}

/** 図鑑：マス初回クリアボーナス */
export const OFFICE_CODEX_FIRST_BONUS = 50;
/** 図鑑：12×4 コンプリートボーナス */
export const OFFICE_CODEX_COMPLETE_BONUS = 500;
/** みんなの解決策：通報非表示閾値 */
export const OFFICE_PEER_REPORT_HIDE_AT = 3;
