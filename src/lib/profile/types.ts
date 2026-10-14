export type ProfileView = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  /** プロフィール背景（カバー）画像 */
  backgroundUrl: string | null;
  bio: string;
  website: string | null;
  school?: string | null;
  location?: string | null;
  /** 特技タグ（canonical JA または自由入力） */
  skills?: string[];
  /** 性格タグ */
  traits?: string[];
  followerCount: number;
  followingCount: number;
};

export type ProfileProjectHighlight = {
  id: string;
  name: string;
  icon: string;
  /** プロジェクト設定のサムネイル（ある場合は参加一覧で表示） */
  thumbnailUrl?: string | null;
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
