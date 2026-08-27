export type IdeaInterviewTheme =
  | "school"
  | "parttime"
  | "club"
  | "friends"
  | "family"
  | "other";

export type IdeaInterviewPhase = "intro" | "theme" | "chat" | "results";

export type IdeaInterviewMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

export type IdeaSeed = {
  id: string;
  title: string;
  summary: string;
};

export type IdeaInterviewSession = {
  version: 1;
  phase: IdeaInterviewPhase;
  theme: IdeaInterviewTheme | null;
  messages: IdeaInterviewMessage[];
  userTurns: number;
  seeds: IdeaSeed[];
  readyForIdeas: boolean;
  updatedAt: string;
};

export const IDEA_INTERVIEW_THEMES: {
  id: IdeaInterviewTheme;
  label: string;
}[] = [
  { id: "school", label: "学校" },
  { id: "parttime", label: "バイト" },
  { id: "club", label: "部活" },
  { id: "friends", label: "友人関係" },
  { id: "family", label: "家庭" },
  { id: "other", label: "その他" },
];

export function themeLabel(theme: IdeaInterviewTheme | null): string {
  return IDEA_INTERVIEW_THEMES.find((t) => t.id === theme)?.label ?? "日常";
}

export const IDEA_INTERVIEW_STORAGE_KEY = "moni.ideaInterview.v1";
export const IDEA_INTERVIEW_HANDOFF_KEY = "moni.ideaInterview.handoff.v1";

export type IdeaInterviewHandoff = {
  seedTitle: string;
  seedSummary: string;
  theme: IdeaInterviewTheme | null;
  notes: string;
};
