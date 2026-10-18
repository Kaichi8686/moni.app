/** 誕生日 (YYYY-MM-DD) と年齢の計算 */

export function parseBirthday(raw: string): string | null {
  const t = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [ys, ms, ds] = t.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (dt > todayUtc) return null;
  const age = ageFromBirthday(t, today);
  if (age == null || age < 5 || age > 120) return null;
  return t;
}

export function ageFromBirthday(birthday: string | null | undefined, now = new Date()): number | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const [ys, ms, ds] = birthday.split("-").map(Number);
  if (!ys || !ms || !ds) return null;
  let age = now.getFullYear() - ys;
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if (month < ms || (month === ms && day < ds)) age -= 1;
  if (!Number.isFinite(age) || age < 0) return null;
  return age;
}

export function formatBirthdayLabel(birthday: string, locale: "ja" | "en"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return birthday;
  const [y, m, d] = birthday.split("-");
  if (locale === "en") return `${y}-${m}-${d}`;
  return `${y}年${Number(m)}月${Number(d)}日`;
}

/** HTML date input max = today */
export function birthdayInputMax(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** HTML date input min ≈ 120 years ago */
export function birthdayInputMin(): string {
  const n = new Date();
  const y = n.getFullYear() - 120;
  return `${y}-01-01`;
}
