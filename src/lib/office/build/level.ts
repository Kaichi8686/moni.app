import { OFFICE_LEVEL_THRESHOLDS } from "@/lib/office/constants";

export function levelFromTotalRevenue(totalRevenue: number): number {
  let level = 1;
  for (let i = 0; i < OFFICE_LEVEL_THRESHOLDS.length; i++) {
    if (totalRevenue >= OFFICE_LEVEL_THRESHOLDS[i]!) level = i + 1;
  }
  return level;
}
