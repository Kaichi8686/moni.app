/** 期限日（YYYY-MM-DD）の終日を過ぎているか */
export function isTaskPastDue(dueDate: string | null | undefined): boolean {
  if (!dueDate?.trim()) return false;
  const key = dueDate.trim().slice(0, 10);
  const end = new Date(`${key}T23:59:59.999`);
  if (Number.isNaN(end.getTime())) return false;
  return Date.now() > end.getTime();
}
