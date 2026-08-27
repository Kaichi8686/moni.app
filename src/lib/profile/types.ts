export type ProfileView = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bio: string;
  website: string | null;
  school?: string | null;
  location?: string | null;
  /** 特技タグ（canonical JA または自由入力） */
  skills?: string[];
  /** 性格タグ */
  traits?: string[];
  postCount: number;
  followerCount: number;
  followingCount: number;
};

export type ProfilePost = {
  id: string;
  caption: string;
  imageUrl: string | null;
  createdAt: string;
};

export type ProfileProjectHighlight = {
  id: string;
  name: string;
  icon: string;
  role?: string;
  description?: string;
};

export type FollowListUser = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isFollowing: boolean;
  isPending: boolean;
};
