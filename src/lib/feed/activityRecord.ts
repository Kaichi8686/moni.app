/** Activity record helpers — encode title/detail/media/date/category into posts.caption without schema changes. */

const MEDIA_RE = /\n?\n?⟦media:([^\]]*)⟧\s*$/;
const RECORDED_RE = /\n?\n?⟦recorded_at:([^\]]*)⟧\s*$/;
const CAT_RE = /\n?\n?⟦cat:([^\]]*)⟧\s*$/;

export const ACTIVITY_CATEGORIES = [
  { id: "progress", labelJa: "進捗", labelEn: "Progress", postType: "normal" as const },
  { id: "learning", labelJa: "学び", labelEn: "Learning", postType: "idea" as const },
  { id: "outcome", labelJa: "成果", labelEn: "Outcome", postType: "achievement" as const },
  { id: "note", labelJa: "メモ", labelEn: "Note", postType: "normal" as const },
] as const;

export type ActivityCategoryId = (typeof ACTIVITY_CATEGORIES)[number]["id"];

export type ParsedActivity = {
  title: string;
  detail: string;
  /** Extra storage paths beyond posts.image_path (first image). */
  extraImagePaths: string[];
  /** ISO string when author backdated the record; else null. */
  recordedAt: string | null;
  category: ActivityCategoryId | null;
  /** Caption text for display (title + detail, no machine meta). */
  displayCaption: string;
};

function isCategoryId(v: string): v is ActivityCategoryId {
  return ACTIVITY_CATEGORIES.some((c) => c.id === v);
}

export function categoryLabel(id: ActivityCategoryId | null | undefined, locale: "ja" | "en" = "ja"): string {
  if (!id) return "";
  const found = ACTIVITY_CATEGORIES.find((c) => c.id === id);
  if (!found) return "";
  return locale === "ja" ? found.labelJa : found.labelEn;
}

export function categoryToPostType(id: ActivityCategoryId | null | undefined): "normal" | "achievement" | "idea" {
  const found = ACTIVITY_CATEGORIES.find((c) => c.id === id);
  return found?.postType ?? "normal";
}

export function stripActivityMeta(caption: string): string {
  return caption.replace(MEDIA_RE, "").replace(RECORDED_RE, "").replace(CAT_RE, "").trimEnd();
}

export function parseActivityCaption(raw: string): ParsedActivity {
  let rest = raw ?? "";
  let extraImagePaths: string[] = [];
  let recordedAt: string | null = null;
  let category: ActivityCategoryId | null = null;

  const mediaMatch = rest.match(MEDIA_RE);
  if (mediaMatch) {
    extraImagePaths = mediaMatch[1]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    rest = rest.replace(MEDIA_RE, "");
  }

  const recordedMatch = rest.match(RECORDED_RE);
  if (recordedMatch) {
    const iso = recordedMatch[1].trim();
    if (iso && !Number.isNaN(Date.parse(iso))) recordedAt = new Date(iso).toISOString();
    rest = rest.replace(RECORDED_RE, "");
  }

  const catMatch = rest.match(CAT_RE);
  if (catMatch) {
    const id = catMatch[1].trim();
    if (isCategoryId(id)) category = id;
    rest = rest.replace(CAT_RE, "");
  }

  const body = rest.trim();
  if (!body) {
    return { title: "", detail: "", extraImagePaths, recordedAt, category, displayCaption: "" };
  }

  const sep = "\n\n---\n\n";
  if (body.includes(sep)) {
    const [titlePart, ...restParts] = body.split(sep);
    const title = titlePart.trim();
    const detail = restParts.join(sep).trim();
    return {
      title,
      detail,
      extraImagePaths,
      recordedAt,
      category,
      displayCaption: detail ? `${title}\n\n${detail}` : title,
    };
  }

  const lines = body.split("\n");
  if (lines.length > 1 && lines[0].trim().length > 0 && lines[0].trim().length <= 80) {
    const title = lines[0].trim();
    const detail = lines.slice(1).join("\n").trim();
    return {
      title,
      detail,
      extraImagePaths,
      recordedAt,
      category,
      displayCaption: detail ? `${title}\n\n${detail}` : title,
    };
  }

  return {
    title: body,
    detail: "",
    extraImagePaths,
    recordedAt,
    category,
    displayCaption: body,
  };
}

export function formatActivityCaption(input: {
  title: string;
  detail: string;
  extraImagePaths?: string[];
  recordedAt?: string | null;
  category?: ActivityCategoryId | null;
}): string {
  const title = input.title.trim();
  const detail = input.detail.trim();
  let out = detail ? `${title}\n\n---\n\n${detail}` : title;

  if (input.category) {
    out += `\n\n⟦cat:${input.category}⟧`;
  }

  if (input.recordedAt) {
    const iso = new Date(input.recordedAt).toISOString();
    if (!Number.isNaN(Date.parse(iso))) {
      out += `\n\n⟦recorded_at:${iso}⟧`;
    }
  }

  const extras = (input.extraImagePaths ?? []).map((p) => p.trim()).filter(Boolean);
  if (extras.length > 0) {
    out += `\n\n⟦media:${extras.join("|")}⟧`;
  }

  return out;
}

/** Local calendar date key YYYY-MM-DD */
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatActivityDateLabel(iso: string, locale: "ja" | "en" = "ja"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = localDateKey(new Date().toISOString());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateKey(yesterdayDate.toISOString());
  const key = localDateKey(iso);
  if (key === today) return locale === "ja" ? "今日" : "Today";
  if (key === yesterday) return locale === "ja" ? "昨日" : "Yesterday";
  return d.toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function formatActivityTime(iso: string, locale: "ja" | "en" = "ja"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(locale === "ja" ? "ja-JP" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type ActivityStats = {
  streakDays: number;
  monthCount: number;
};

export function computeActivityStats(
  posts: Array<{ authorId: string; createdAt: string; recordedAt?: string | null }>,
  authorId: string,
): ActivityStats {
  const mine = posts
    .filter((p) => p.authorId === authorId)
    .map((p) => p.recordedAt || p.createdAt)
    .filter(Boolean)
    .map((iso) => localDateKey(iso));

  const uniqueDays = [...new Set(mine)].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthCount = uniqueDays.filter((d) => d.startsWith(monthPrefix)).length;

  if (uniqueDays.length === 0) return { streakDays: 0, monthCount: 0 };

  const daySet = new Set(uniqueDays);
  const todayKey = localDateKey(now.toISOString());
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yesterdayKey = localDateKey(yest.toISOString());

  let cursor = daySet.has(todayKey) ? todayKey : daySet.has(yesterdayKey) ? yesterdayKey : null;
  if (!cursor) return { streakDays: 0, monthCount };

  let streak = 0;
  while (cursor && daySet.has(cursor)) {
    streak += 1;
    const [y, m, d] = cursor.split("-").map(Number);
    const prev = new Date(y, m - 1, d);
    prev.setDate(prev.getDate() - 1);
    cursor = localDateKey(prev.toISOString());
  }

  return { streakDays: streak, monthCount };
}

export type ActivityDayGroup<T> = {
  dateKey: string;
  label: string;
  items: T[];
};

export function groupPostsByDay<T extends { createdAt: string; recordedAt?: string | null }>(
  posts: T[],
  locale: "ja" | "en" = "ja",
): ActivityDayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const p of posts) {
    const iso = p.recordedAt || p.createdAt;
    const key = localDateKey(iso);
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([dateKey, items]) => ({
      dateKey,
      label: formatActivityDateLabel(items[0].recordedAt || items[0].createdAt, locale),
      items: [...items].sort(
        (a, b) =>
          new Date(b.recordedAt || b.createdAt).getTime() - new Date(a.recordedAt || a.createdAt).getTime(),
      ),
    }));
}
