import { parseCoachingContext, type CoachingContext } from "@/lib/projects/coachingContext";

/** 新規作成・設定で使うプロジェクト詳細の3欄 */
export type ProjectBrief = {
  /** どのようなことを解決したくてこのプロジェクトを思いついたか */
  problemMotivation: string;
  /** このプロジェクトのゴール（coaching_context.dreamStatement と同期） */
  projectGoal: string;
  /** 何をするのか */
  whatToDo: string;
};

const EMPTY_BRIEF: ProjectBrief = {
  problemMotivation: "",
  projectGoal: "",
  whatToDo: "",
};

const SECTION_MARKERS = {
  problemMotivation: "【きっかけ】",
  projectGoal: "【ゴール】",
  whatToDo: "【すること】",
} as const;

export function emptyProjectBrief(): ProjectBrief {
  return { ...EMPTY_BRIEF };
}

export function trimProjectBrief(brief: ProjectBrief): ProjectBrief {
  return {
    problemMotivation: brief.problemMotivation.trim(),
    projectGoal: brief.projectGoal.trim(),
    whatToDo: brief.whatToDo.trim(),
  };
}

export function hasProjectBriefContent(brief: ProjectBrief): boolean {
  const t = trimProjectBrief(brief);
  return Boolean(t.problemMotivation || t.projectGoal || t.whatToDo);
}

/** description カラム向けの読みやすいまとめ文 */
export function composeProjectDescription(brief: ProjectBrief): string {
  const t = trimProjectBrief(brief);
  const parts: string[] = [];
  if (t.problemMotivation) parts.push(`${SECTION_MARKERS.problemMotivation}\n${t.problemMotivation}`);
  if (t.projectGoal) parts.push(`${SECTION_MARKERS.projectGoal}\n${t.projectGoal}`);
  if (t.whatToDo) parts.push(`${SECTION_MARKERS.whatToDo}\n${t.whatToDo}`);
  return parts.join("\n\n");
}

function parseComposedDescription(description: string): ProjectBrief | null {
  const raw = description.trim();
  if (!raw) return null;
  const hasAnyMarker =
    raw.includes(SECTION_MARKERS.problemMotivation) ||
    raw.includes(SECTION_MARKERS.projectGoal) ||
    raw.includes(SECTION_MARKERS.whatToDo);
  if (!hasAnyMarker) return null;

  const next = emptyProjectBrief();
  const re =
    /【(きっかけ|ゴール|すること)】\s*([\s\S]*?)(?=【(?:きっかけ|ゴール|すること)】|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const key = m[1];
    const value = (m[2] ?? "").trim();
    if (key === "きっかけ") next.problemMotivation = value;
    else if (key === "ゴール") next.projectGoal = value;
    else if (key === "すること") next.whatToDo = value;
  }
  return hasProjectBriefContent(next) ? next : null;
}

/** coaching_context + description から詳細3欄を復元 */
export function resolveProjectBrief(input: {
  coachingContext?: unknown | CoachingContext;
  description?: string | null;
}): ProjectBrief {
  const ctx = parseCoachingContext(input.coachingContext);

  const fromCtx: ProjectBrief = {
    problemMotivation: ctx.problemMotivation?.trim() ?? "",
    projectGoal: ctx.dreamStatement?.trim() ?? "",
    whatToDo: ctx.whatToDo?.trim() ?? "",
  };
  if (hasProjectBriefContent(fromCtx)) return fromCtx;

  const fromDesc = parseComposedDescription(input.description ?? "");
  if (fromDesc) return fromDesc;

  const legacy = (input.description ?? "").trim();
  if (legacy) {
    return { ...emptyProjectBrief(), whatToDo: legacy };
  }
  return emptyProjectBrief();
}

/** coaching_context に詳細3欄を反映（空欄はキー削除） */
export function applyBriefToCoachingContext(prev: CoachingContext, brief: ProjectBrief): CoachingContext {
  const next: CoachingContext = { ...prev };
  const t = trimProjectBrief(brief);
  if (t.problemMotivation) next.problemMotivation = t.problemMotivation;
  else delete next.problemMotivation;
  if (t.projectGoal) next.dreamStatement = t.projectGoal;
  else delete next.dreamStatement;
  if (t.whatToDo) next.whatToDo = t.whatToDo;
  else delete next.whatToDo;
  return next;
}
