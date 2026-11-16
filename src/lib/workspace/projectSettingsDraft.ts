import type { ProjectVisibility } from "@/lib/projects/types";
import type { ProjectBrief } from "@/lib/projects/projectBrief";
import { emptyProjectBrief } from "@/lib/projects/projectBrief";

export type ProjectSettingsDraft = {
  editName: string;
  editThumb: string;
  editBg: string;
  showUrlField: boolean;
  editBrief: ProjectBrief;
  editCategory: string;
  editBusinessType: "maker" | "software" | "social";
  editRecruitmentTarget: string;
  editRecruitmentMessage: string;
  editVisibility: ProjectVisibility;
  updatedAt: number;
};

function storageKey(projectId: string): string {
  return `moni:projectSettingsDraft:v1:${projectId}`;
}

function parseBusinessType(raw: unknown): "maker" | "software" | "social" {
  return raw === "maker" || raw === "social" ? raw : "software";
}

function parseBrief(raw: unknown): ProjectBrief {
  if (!raw || typeof raw !== "object") return emptyProjectBrief();
  const o = raw as Record<string, unknown>;
  return {
    problemMotivation: typeof o.problemMotivation === "string" ? o.problemMotivation : "",
    projectGoal: typeof o.projectGoal === "string" ? o.projectGoal : "",
    whatToDo: typeof o.whatToDo === "string" ? o.whatToDo : "",
  };
}

export function readProjectSettingsDraft(projectId: string): ProjectSettingsDraft | null {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProjectSettingsDraft>;
    return {
      editName: typeof parsed.editName === "string" ? parsed.editName : "",
      editThumb: typeof parsed.editThumb === "string" ? parsed.editThumb : "",
      editBg: typeof parsed.editBg === "string" ? parsed.editBg : "",
      showUrlField: Boolean(parsed.showUrlField),
      editBrief: parseBrief(parsed.editBrief),
      editCategory: typeof parsed.editCategory === "string" ? parsed.editCategory : "",
      editBusinessType: parseBusinessType(parsed.editBusinessType),
      editRecruitmentTarget:
        typeof parsed.editRecruitmentTarget === "string" ? parsed.editRecruitmentTarget : "",
      editRecruitmentMessage:
        typeof parsed.editRecruitmentMessage === "string" ? parsed.editRecruitmentMessage : "",
      editVisibility: parsed.editVisibility === "private" ? "private" : "public",
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeProjectSettingsDraft(
  projectId: string,
  draft: Omit<ProjectSettingsDraft, "updatedAt">,
) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    const payload: ProjectSettingsDraft = { ...draft, updatedAt: Date.now() };
    window.sessionStorage.setItem(storageKey(projectId), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearProjectSettingsDraft(projectId: string) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    window.sessionStorage.removeItem(storageKey(projectId));
  } catch {
    /* ignore */
  }
}
