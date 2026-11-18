import { CAST_ROLES, type CastRole } from "@/lib/office/scenes";

export type CastLook = {
  skin: number;
  hair: number;
  accessory: number;
  color: number;
};

export type CastMember = {
  id: string;
  role: CastRole;
  name: string;
  look: CastLook;
};

const FIRST_NAMES = [
  "ハルト",
  "アオイ",
  "ユイ",
  "ソラ",
  "レン",
  "ミオ",
  "カイ",
  "ヒナ",
  "タクト",
  "ナナ",
  "コウ",
  "サクラ",
  "リク",
  "メイ",
  "ショウ",
  "アヤ",
];

const LAST_NAMES = [
  "佐藤",
  "鈴木",
  "高橋",
  "田中",
  "伊藤",
  "渡辺",
  "山本",
  "中村",
  "小林",
  "加藤",
  "吉田",
  "山田",
];

const ROLE_NAME_HINT: Partial<Record<CastRole, string[]>> = {
  rival_ceo: ["ライバル社長", "対抗社長", "向かいの社長"],
  secretary: ["秘書", "アシスタント"],
  accountant: ["経理の", "帳簿係"],
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)]!;
}

function makeName(rand: () => number, role: CastRole, used: Set<string>): string {
  for (let i = 0; i < 24; i++) {
    let name: string;
    if (role === "rival_ceo") {
      name = `${pick(rand, LAST_NAMES)}${pick(rand, ROLE_NAME_HINT.rival_ceo!)}`;
    } else if (role === "secretary") {
      name = `${pick(rand, FIRST_NAMES)}${pick(rand, ROLE_NAME_HINT.secretary!)}`;
    } else if (role === "accountant") {
      name = `${pick(rand, ROLE_NAME_HINT.accountant!)}${pick(rand, FIRST_NAMES)}`;
    } else {
      name = `${pick(rand, LAST_NAMES)}${pick(rand, FIRST_NAMES)}`;
    }
    if (!used.has(name)) {
      used.add(name);
      return name.slice(0, 12);
    }
  }
  const fallback = `${pick(rand, FIRST_NAMES)}${Math.floor(rand() * 90 + 10)}`;
  used.add(fallback);
  return fallback;
}

function makeLook(rand: () => number): CastLook {
  return {
    skin: Math.floor(rand() * 4),
    hair: Math.floor(rand() * 4),
    accessory: Math.floor(rand() * 4),
    color: Math.floor(rand() * 6),
  };
}

/** 会社キャスト6人をランダム生成（AI不使用） */
export function generateCompanyCast(seed?: string | number): CastMember[] {
  let h = 1;
  if (typeof seed === "number") h = seed >>> 0;
  else if (seed) {
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  } else {
    h = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  }
  const rand = mulberry32(h || 1);
  const used = new Set<string>();
  return CAST_ROLES.map((role, i) => ({
    id: `c${i + 1}`,
    role,
    name: makeName(rand, role, used),
    look: makeLook(rand),
  }));
}

export function parseCompanyCast(raw: unknown): CastMember[] | null {
  if (!Array.isArray(raw) || raw.length !== 6) return null;
  const out: CastMember[] = [];
  const roles = new Set<CastRole>();
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    const role = String(row.role ?? "").trim() as CastRole;
    const name = String(row.name ?? "").trim().slice(0, 12);
    const lookRaw = row.look;
    if (!id || !name || !(CAST_ROLES as readonly string[]).includes(role)) return null;
    if (!lookRaw || typeof lookRaw !== "object") return null;
    const lookObj = lookRaw as Record<string, unknown>;
    const look: CastLook = {
      skin: Math.max(0, Math.min(3, Number(lookObj.skin) || 0)),
      hair: Math.max(0, Math.min(3, Number(lookObj.hair) || 0)),
      accessory: Math.max(0, Math.min(3, Number(lookObj.accessory) || 0)),
      color: Math.max(0, Math.min(5, Number(lookObj.color) || 0)),
    };
    if (roles.has(role)) return null;
    roles.add(role);
    out.push({ id, role, name, look });
  }
  if (roles.size !== 6) return null;
  return out;
}

export function ensureCompanyCast(raw: unknown, seed?: string): CastMember[] {
  return parseCompanyCast(raw) ?? generateCompanyCast(seed);
}

export function castMemberByRole(cast: CastMember[], role: CastRole): CastMember | null {
  return cast.find((c) => c.role === role) ?? null;
}
