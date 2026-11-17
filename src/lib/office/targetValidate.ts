import type { IncidentTargetInternal } from "@/lib/office/types";

const LABEL_MAX = 12;

/** 会社説明をそのまま / 含んだターゲットラベルを弾く */
export function isValidTargetLabel(label: string, companyAbout: string): boolean {
  const lab = label.replace(/\s+/g, " ").trim();
  if (!lab) return false;
  if ([...lab].length > LABEL_MAX) return false;

  const about = companyAbout.replace(/\s+/g, " ").trim();
  if (!about) return true;

  if (lab === about) return false;
  if (about.includes(lab) && [...lab].length >= 4) return false;
  if (lab.includes(about) && [...about].length >= 4) return false;

  // 「世界の子供達にビジネ…」のような説明の先頭切り出し
  const aboutHead = about.slice(0, Math.min(10, about.length));
  if (aboutHead.length >= 4 && lab.startsWith(aboutHead.slice(0, 4))) {
    const shared = longestCommonPrefix(lab, about);
    if ([...shared].length >= 6) return false;
  }

  return true;
}

function longestCommonPrefix(a: string, b: string): string {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return a.slice(0, i);
}

export function targetsPassValidation(
  targets: IncidentTargetInternal[],
  companyAbout: string,
): boolean {
  if (targets.length !== 4) return false;
  return targets.every((t) => isValidTargetLabel(t.label, companyAbout));
}

/** 無効ターゲットを含む場合は null */
export function filterValidTargetsOrNull(
  targets: IncidentTargetInternal[] | null,
  companyAbout: string,
): IncidentTargetInternal[] | null {
  if (!targets) return null;
  if (!targetsPassValidation(targets, companyAbout)) return null;
  return targets;
}
