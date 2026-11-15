const TOKYO = "Asia/Tokyo";

/** Asia/Tokyo 基準のシーズンキー "YYYY-MM" */
export function seasonKeyFor(date: Date = new Date()): string {
  const parts = tokyoParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

/** 直前シーズン（締め対象） */
export function previousSeasonKey(date: Date = new Date()): string {
  const parts = tokyoParts(date);
  let y = parts.year;
  let m = parts.month - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** JST で「今日は1日か」 */
export function isTokyoMonthStart(date: Date = new Date()): boolean {
  return tokyoParts(date).day === 1;
}

export function tokyoParts(date: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TOKYO,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
  };
}

/** 会社の作成月がそのシーズンか（新人初月判定） */
export function isFirstSeasonForCompany(createdAt: Date | string, seasonKey: string): boolean {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return seasonKeyFor(created) === seasonKey;
}
