export type ProfileGender = "male" | "female" | "other" | "prefer_not";

export const GENDER_OPTIONS: Array<{ id: ProfileGender; ja: string; en: string }> = [
  { id: "male", ja: "男性", en: "Male" },
  { id: "female", ja: "女性", en: "Female" },
  { id: "other", ja: "その他", en: "Other" },
  { id: "prefer_not", ja: "選びたくない", en: "Prefer not to say" },
];

export function isProfileGender(raw: unknown): raw is ProfileGender {
  return raw === "male" || raw === "female" || raw === "other" || raw === "prefer_not";
}

export function genderLabel(value: string | null | undefined, locale: "ja" | "en"): string {
  if (!value) return "";
  const hit = GENDER_OPTIONS.find((g) => g.id === value);
  if (!hit) return value;
  return locale === "en" ? hit.en : hit.ja;
}
