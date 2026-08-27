export type AdminSignupDay = { day: string; count: number };

export type AdminRoleCount = { role: string; count: number };

export type AdminUserRow = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string;
  goal: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  projectCount: number;
  postCount: number;
};

export type AdminStatsPayload = {
  generatedAt: string;
  totals: {
    authUsers: number;
    profiles: number;
    projects: number;
    posts: number;
    articles: number;
    pitches: number;
    chatMessages: number;
    follows: number;
    ideaQuestions: number;
  };
  signupsLast14Days: AdminSignupDay[];
  roleBreakdown: AdminRoleCount[];
  activeLast7Days: number;
  recentUsers: AdminUserRow[];
};
