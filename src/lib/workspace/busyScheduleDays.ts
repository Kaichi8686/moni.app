import type { CalendarSchedule } from "@/components/projects/ProjectScheduleCalendar";

export type ScheduleKind = "event" | "busy";

const BUSY_MARKER = "[[moni:busy]]";

function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function eachDateKeyInRange(startsAtIso: string, endsAtIso: string | null): string[] {
  const s = new Date(startsAtIso);
  const e = endsAtIso ? new Date(endsAtIso) : s;
  const start = startOfDay(s);
  const end = startOfDay(e);
  if (Number.isNaN(start.getTime())) return [];
  if (end < start) return [dateKeyLocal(start)];
  const keys: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    keys.push(dateKeyLocal(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

export function isBusySchedule(schedule: Pick<CalendarSchedule, "kind" | "description">): boolean {
  if (schedule.kind === "busy") return true;
  return (schedule.description ?? "").trimStart().startsWith(BUSY_MARKER);
}

export function encodeScheduleDescription(kind: ScheduleKind, description: string): string {
  const body = description.trim();
  if (kind !== "busy") return body;
  if (body.startsWith(BUSY_MARKER)) return body;
  return body ? `${BUSY_MARKER}\n${body}` : BUSY_MARKER;
}

export function displayScheduleDescription(description: string): string {
  const trimmed = description.trimStart();
  if (!trimmed.startsWith(BUSY_MARKER)) return description;
  return trimmed.slice(BUSY_MARKER.length).replace(/^\n/, "");
}

/** Busy (blocked) date keys (yyyy-MM-dd) from project schedules. */
export function busyDateKeysFromSchedules(
  schedules: Array<Pick<CalendarSchedule, "kind" | "description" | "starts_at" | "ends_at">>,
): Set<string> {
  const keys = new Set<string>();
  for (const s of schedules) {
    if (!isBusySchedule(s)) continue;
    for (const k of eachDateKeyInRange(s.starts_at, s.ends_at)) keys.add(k);
  }
  return keys;
}
