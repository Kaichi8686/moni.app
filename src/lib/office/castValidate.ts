const NG_WORDS = [
  "ばか",
  "死ね",
  "殺す",
  "クソ",
  "くそ",
  "バカ",
  "アホ",
];

export function looksLikeEmail(text: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
}

export function looksLikePhone(text: string): boolean {
  const digits = text.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function validateCastName(raw: string): string | null {
  const name = String(raw ?? "").trim();
  if (name.length < 1 || name.length > 12) return "名前は1〜12文字で書いてね";
  if (looksLikeEmail(name)) return "メールアドレスは使わないでね";
  if (looksLikePhone(name)) return "電話番号は使わないでね";
  const lower = name.toLowerCase();
  for (const w of NG_WORDS) {
    if (name.includes(w) || lower.includes(w.toLowerCase())) {
      return "その名前は使えないよ";
    }
  }
  return null;
}

export type CastEditMember = {
  id: string;
  role: string;
  name: string;
  look: { skin: number; hair: number; accessory: number; color: number };
};

/** 編集可能ロール（仲間4人） */
export const EDITABLE_CAST_ROLES = ["newbie", "veteran", "accountant", "regular"] as const;

export function validateOwnerName(raw: string): string | null {
  return validateCastName(raw);
}
