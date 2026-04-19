export type BizSeedChatMessage = { role: "user" | "assistant"; content: string };

export type RoadmapDay = {
  day: number;
  title: string;
  detail: string;
  task: string;
};

export type LocalBizSeedState = {
  version: 1;
  interests: string;
  messages: BizSeedChatMessage[];
  stepIndex: number;
  finalizedIdea: string | null;
  roadmap: RoadmapDay[] | null;
  activeChallengeDay: number;
  projectId: string | null;
};
