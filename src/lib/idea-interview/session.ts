import type { IdeaInterviewSession } from "@/lib/idea-interview/types";
import { IDEA_INTERVIEW_STORAGE_KEY } from "@/lib/idea-interview/types";

export function loadIdeaInterviewSession(): IdeaInterviewSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(IDEA_INTERVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IdeaInterviewSession;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveIdeaInterviewSession(session: IdeaInterviewSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      IDEA_INTERVIEW_STORAGE_KEY,
      JSON.stringify({ ...session, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* ignore quota */
  }
}

export function clearIdeaInterviewSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(IDEA_INTERVIEW_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function emptySession(): IdeaInterviewSession {
  return {
    version: 1,
    phase: "intro",
    theme: null,
    messages: [],
    userTurns: 0,
    seeds: [],
    readyForIdeas: false,
    updatedAt: new Date().toISOString(),
  };
}
