import { OFFICE_SIZE_WEIGHTS } from "@/lib/office/constants";

export function pickIncidentSize(random: () => number = Math.random): 1 | 2 | 3 {
  const total = OFFICE_SIZE_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let roll = random() * total;
  for (const row of OFFICE_SIZE_WEIGHTS) {
    roll -= row.weight;
    if (roll < 0) return row.size;
  }
  return 1;
}
