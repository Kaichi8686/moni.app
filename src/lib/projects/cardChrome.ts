import { projectLineShortLabel } from "@/lib/projects/roadmapTemplates";

/** Card thumbnail strip backgrounds (match ProjectTabGlide / Discover) */
export const PROJECT_CARD_ICON_BGS = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
];

export function hashProjectVisualIndex(id: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % mod;
}

export function projectThumbEmoji(businessType: string | null | undefined): string {
  if (businessType === "maker") return "🛒";
  if (businessType === "software") return "💻";
  if (businessType === "social") return "🌐";
  return "📂";
}

export { projectLineShortLabel };
