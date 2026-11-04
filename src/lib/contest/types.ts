export type ContestStatus = "upcoming" | "active" | "ended";

export type ContestRoadmapStep = {
  title: string;
  detail?: string;
};

export type ContestRoadmap = {
  id: string;
  userId: string;
  title: string;
  steps: ContestRoadmapStep[];
  sourceProjectId: string | null;
  createdAt: string;
};

export type Contest = {
  id: string;
  title: string;
  description: string;
  whyText: string | null;
  rewardText: string | null;
  promptHint: string | null;
  category: string;
  startAt: string;
  endAt: string;
  status: ContestStatus;
  createdAt: string;
};

export type ContestEntryAuthor = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ContestEntry = {
  id: string;
  contestId: string;
  userId: string;
  roadmapId: string;
  comment: string | null;
  likeCount: number;
  createdAt: string;
  likedByMe: boolean;
  author: ContestEntryAuthor;
  roadmap: ContestRoadmap;
};

export type ContestGallerySort = "popular" | "newest" | "mine";
