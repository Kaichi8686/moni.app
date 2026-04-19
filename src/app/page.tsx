"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MoniLanding } from "@/components/MoniLanding";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type AppRole = "child" | "parent" | "investor";
type FeaturePage = "posts" | "articles" | "mentor" | "discovery" | "chat" | "account";
type Language = "ja" | "en";
type ContactPermission = "all" | "followers" | "message_only" | "none";
type IdeaTool = { id: string; title: string; description: string; effect: string };
type TestSheetThreadPost = { id: string; author: string; body: string; createdAt: string };
type ProblemPost = {
  id: string;
  author: string;
  area: "学校" | "家" | "友だち" | "趣味" | "地域";
  body: string;
  createdAt: string;
  supportCount: number;
  supportedByMe: boolean;
};
type IdeaSquarePost = { id: string; author: string; text: string; likes: number; createdAt: string };

type IdeaChieQuestion = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  bestAnswerId: string | null;
  createdAtIso: string;
  answerCount: number;
};

type IdeaChieAnswer = {
  id: string;
  questionId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAtIso: string;
};
type ProblemCluster = { id: string; title: string; count: number; sample: string[] };

type IdeaBlueprint = {
  title: string;
  target: string;
  problem: string;
  solution: string;
  value: string;
  firstStep: string;
  elevatorPitch: string;
  hypothesis: string;
  risks: string;
  metric: string;
  mentorSeed: string;
  alternatives: string;
};

const IDEA_BLUEPRINT_INITIAL: IdeaBlueprint = {
  title: "",
  target: "",
  problem: "",
  solution: "",
  value: "",
  firstStep: "",
  elevatorPitch: "",
  hypothesis: "",
  risks: "",
  metric: "",
  mentorSeed: "",
  alternatives: "",
};

type Article = {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "published";
  authorId?: string;
  authorName?: string;
  createdAt?: string;
  body?: string;
  category?: string;
  imageUrl?: string | null;
  likeCount?: number;
  likedByMe?: boolean;
  comments?: Array<{ id: string; authorName: string; body: string; createdAt: string }>;
};

type Pitch = {
  id: string;
  title: string;
  body: string;
  likes: number;
};

type FeedPost = {
  id: string;
  authorId: string;
  authorName: string;
  caption: string;
  imageUrl: string | null;
  /** Storage object path（Supabase 時のみ。削除時に使用） */
  storagePath?: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  comments: FeedComment[];
};

type FeedComment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

type FollowUser = {
  id: string;
  name: string;
  goal: string;
};

type ChatMessage = {
  id: string;
  sender: string;
  senderId: string | null;
  body: string;
  createdAt: string;
  createdAtIso: string;
};

type PresenceState = Record<string, Array<{ name?: string }>>;
type AiMatchType = "engineer" | "marketer" | "idea";
type MatchMember = { id?: string; name: string; goal: string; strength: string; aiType?: AiMatchType };

type MentorChatMessage = { id: string; role: "user" | "assistant"; content: string };

const MENTOR_WELCOME_TEXT =
  "こんにちは。なんでも気軽に送ってみてください。雑談でも相談でも、そのままの言葉で大丈夫です。";

function createMentorWelcomeMessage(): MentorChatMessage {
  return { id: "mentor-welcome", role: "assistant", content: MENTOR_WELCOME_TEXT };
}

type DmPeerRow = { room_id: string; peer_id: string; peer_name: string };
type GroupRoomRow = { room_id: string; room_name: string };
type TalkRoomMeta = { previewText: string; timeLabel: string; unread: number };
type OpsEvent = { id: string; name: string; at: string; page: FeaturePage; userId: string | null };
type ReportEntry = {
  id: string;
  targetType: "post" | "article" | "message" | "profile";
  targetId: string;
  reason: string;
  excerpt: string;
  createdAt: string;
  status?: "new" | "reviewing" | "resolved";
  assignee?: string;
  dueAt?: string;
};

type IdeaSprintTask = { id: string; day: string; task: string; outcome: string };
type DiscoveryIdeaCandidate = {
  id: string;
  title: string;
  summary: string;
  whyFit: string;
  firstStep: string;
  target: string;
  tags: string[];
};

function sortPeerIds(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

function makeDmRoomId(uidA: string, uidB: string): string {
  const [x, y] = sortPeerIds(uidA, uidB);
  return `dm|${x}|${y}`;
}

/** 日本語はスペースなしでも1語として扱えるよう、区切りが無ければ全文を1キーワードにする */
function matchingKeywords(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const parts = t.split(/[\s、。,.，．]+/).filter(Boolean);
  return parts.length > 0 ? parts : [t];
}

/** LIKE の % _ をユーザー入力から除く（パターン破壊・意図しないワイルドカード防止） */
function sanitizeLikeTerm(term: string): string {
  return term.replace(/%/g, "").replace(/_/g, "").trim();
}

function formatFeedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 45) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}日前`;
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

const pageTaglines: Record<Language, Record<FeaturePage, string>> = {
  ja: {
    posts: "投稿",
    articles: "記事",
    mentor: "AIに相談して次の一歩を決めよう",
    discovery: "アイデア",
    chat: "検索 / チャット",
    account: "プロフィールとフォローを管理",
  },
  en: {
    posts: "Posts",
    articles: "Articles",
    mentor: "Talk to AI and plan your next step",
    discovery: "Ideas",
    chat: "Search / Chat",
    account: "Manage profile and follows",
  },
};

const featureItems: Array<{ key: FeaturePage; icon: string }> = [
  { key: "posts", icon: "⌂" },
  { key: "articles", icon: "☰" },
  { key: "discovery", icon: "✦" },
  { key: "chat", icon: "✉" },
  { key: "account", icon: "◉" },
];

const featureLabels: Record<Language, Record<FeaturePage, string>> = {
  ja: {
    posts: "投稿",
    articles: "記事",
    mentor: "相談AI",
    discovery: "アイデア",
    chat: "検索・チャット",
    account: "アカウント",
  },
  en: {
    posts: "Posts",
    articles: "Articles",
    mentor: "AI",
    discovery: "Ideas",
    chat: "Search/Chat",
    account: "Account",
  },
};

const AI_MATCH_TYPE_META: Record<AiMatchType, { label: string; description: string; keywords: string[] }> = {
  engineer: {
    label: "エンジニア型",
    description: "作るのが得意。実装・改善・プロトタイプで前に進めるタイプ。",
    keywords: ["作る", "開発", "実装", "アプリ", "プロト", "コード", "改善", "設計"],
  },
  marketer: {
    label: "マーケター型",
    description: "届けるのが得意。発信・調査・提案で価値を広げるタイプ。",
    keywords: ["発表", "営業", "対話", "プレゼン", "提案", "調査", "分析", "広める"],
  },
  idea: {
    label: "アイデア型",
    description: "発想が得意。企画・着想・課題発見で新しい案を生むタイプ。",
    keywords: ["アイデア", "企画", "発想", "ひらめき", "課題", "仮説", "新しい", "着想"],
  },
};

function detectAiMatchType(raw: string): AiMatchType {
  const text = raw.trim().toLowerCase();
  if (!text) return "engineer";
  const scores = (Object.keys(AI_MATCH_TYPE_META) as AiMatchType[]).map((type) => {
    const score = AI_MATCH_TYPE_META[type].keywords.reduce(
      (acc, kw) => (text.includes(kw.toLowerCase()) ? acc + 1 : acc),
      0,
    );
    return { type, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.score > 0 ? scores[0].type : "engineer";
}

function inferAiTypeFromMember(member: Pick<MatchMember, "goal" | "strength">): AiMatchType {
  const text = `${member.goal} ${member.strength}`;
  return detectAiMatchType(text);
}

function normalizeDiscoveryText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[。、,.!?！？「」"'`]/g, "")
    .trim();
}

function scoreProblemDraft(raw: string): { score: number; hints: string[] } {
  const text = raw.trim();
  const hints: string[] = [];
  let score = 0;
  if (text.length >= 16) score += 1;
  else hints.push("短すぎるので、状況をもう少し具体的に書く");

  if (/(いつ|朝|夜|放課後|毎日|週|時間|とき|時)/.test(text)) score += 1;
  else hints.push("いつ起きる困りごとかを入れる");

  if (/(誰|自分|友だち|家族|先生|兄弟|親)/.test(text)) score += 1;
  else hints.push("誰が困るのかを入れる");

  if (/(困る|不便|大変|面倒|できない|遅れる|忘れ)/.test(text)) score += 1;
  else hints.push("困りごとの痛みを1語入れる（例: 面倒・遅れる）");

  return { score, hints };
}

function createDiscoveryCandidates(input: {
  interests: string[];
  strengths: string[];
  problems: string[];
  target: string;
  problemText: string;
}): DiscoveryIdeaCandidate[] {
  const interest = input.interests[0] ?? "身近な活動";
  const strength = input.strengths[0] ?? "実行力";
  const problem = input.problemText.trim() || input.problems[0] || "日常の不便";
  const target = input.target || "同じ課題を持つ人";
  const base = [
    {
      suffix: "共有ボード",
      summary: `${target}の「${problem}」を短く記録して、解決例を集める仕組み`,
      firstStep: "まず10人向けの投稿フォームを作って、課題を3件集める",
    },
    {
      suffix: "チェックアシスト",
      summary: `${interest}と${strength}を活かして、準備や進行漏れを減らすサポート`,
      firstStep: "漏れやすい行動を3つ書き出し、チェック手順を1週間試す",
    },
    {
      suffix: "マッチングノート",
      summary: `${target}同士で課題と得意を交換できる、協力向けの小さな仕組み`,
      firstStep: "必要な助けと提供できることを1行ずつ募集してペアを作る",
    },
    {
      suffix: "ミニ検証ラボ",
      summary: `${problem}に対して、毎週1つずつ改善案をテストして残す運用`,
      firstStep: "今週の改善案を1つ決め、効果を数字で1項目だけ記録する",
    },
    {
      suffix: "課題ダッシュボード",
      summary: `${target}の困りごとを可視化し、優先度順に改善テーマを回す`,
      firstStep: "課題を頻度×困り度で5件並べ、上位1件だけ着手する",
    },
  ];
  return base.slice(0, 5).map((row, idx) => ({
    id: `cand-${idx + 1}`,
    title: `${interest}${row.suffix}`,
    summary: row.summary,
    whyFit: `「${interest}」への関心と「${strength}」を活かしやすく、${target}に価値が届きやすい案。`,
    firstStep: row.firstStep,
    target,
    tags: [interest, strength, input.problems[0] ?? "課題解決"],
  }));
}

const DEMO_MEMBERS: MatchMember[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "ゆい", goal: "教育アプリを作りたい", strength: "UIデザイン", aiType: "engineer" },
  { id: "22222222-2222-4222-8222-222222222222", name: "たくみ", goal: "学校の困りごとを解決したい", strength: "調査", aiType: "marketer" },
  { id: "33333333-3333-4333-8333-333333333333", name: "みさき", goal: "環境系スタートアップに興味がある", strength: "発表", aiType: "marketer" },
  { id: "44444444-4444-4444-8444-444444444444", name: "そら", goal: "ゲームで英語学習を楽しくしたい", strength: "プロトタイプ作成", aiType: "engineer" },
  { id: "55555555-5555-4555-8555-555555555555", name: "りく", goal: "地域のフードロスを減らしたい", strength: "営業・ヒアリング", aiType: "marketer" },
  { id: "66666666-6666-4666-8666-666666666666", name: "あかり", goal: "親子で使える家計教育サービス", strength: "コンテンツ企画", aiType: "idea" },
  { id: "77777777-7777-4777-8777-777777777777", name: "けん", goal: "部活の連絡をラクにするアプリ", strength: "フロント実装", aiType: "engineer" },
  { id: "88888888-8888-4888-8888-888888888888", name: "もも", goal: "小学生向け安全SNSを作りたい", strength: "ユーザー調査", aiType: "idea" },
];

const DEMO_FOLLOW_USERS: FollowUser[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "ゆい", goal: "教育アプリを作りたい" },
  { id: "22222222-2222-4222-8222-222222222222", name: "たくみ", goal: "学校の困りごとを解決したい" },
  { id: "33333333-3333-4333-8333-333333333333", name: "みさき", goal: "環境系スタートアップに興味がある" },
  { id: "44444444-4444-4444-8444-444444444444", name: "そら", goal: "ゲームで英語学習を楽しくしたい" },
  { id: "55555555-5555-4555-8555-555555555555", name: "りく", goal: "地域のフードロスを減らしたい" },
  { id: "66666666-6666-4666-8666-666666666666", name: "あかり", goal: "親子で使える家計教育サービス" },
  { id: "77777777-7777-4777-8777-777777777777", name: "けん", goal: "部活の連絡をラクにするアプリ" },
  { id: "88888888-8888-4888-8888-888888888888", name: "もも", goal: "小学生向け安全SNSを作りたい" },
];

const DEMO_PROBLEM_POSTS: ProblemPost[] = [
  {
    id: "problem-1",
    author: "ゆい",
    area: "学校",
    body: "忘れ物チェックが朝バタバタして抜けやすい。前日に楽しく準備できる仕組みが欲しい。",
    createdAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    supportCount: 4,
    supportedByMe: false,
  },
  {
    id: "problem-2",
    author: "たくみ",
    area: "家",
    body: "兄弟でタブレットの順番でもめる。時間を公平に管理できる見える化が欲しい。",
    createdAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
    supportCount: 6,
    supportedByMe: false,
  },
];

const IDEA_TOOLS: IdeaTool[] = [
  {
    id: "weekly-mission",
    title: "今週のアイデアミッション",
    description: "毎週「雨の日を楽しくする」「学校で役立つ」などお題を出す。",
    effect: "白紙から考える負担が減り、継続的に考える習慣がつく。",
  },
  {
    id: "pattern-cards",
    title: "アイデアの型カード",
    description: "「作る」「助ける」「教える」「楽しませる」等、考え方の型を提示する。",
    effect: "「どう考えればいいか分からない」を減らし、形にする基本パターンを学べる。",
  },
  {
    id: "idea-square",
    title: "みんなのアイデア広場",
    description: "他の子どものアイデアを見て、いいね・応援コメントを送れる。",
    effect: "他の発想から刺激を受けて視野が広がり、意欲につながる。",
  },
  {
    id: "flash-memo",
    title: "ひらめきメモ",
    description: "思いつきをすぐ残せるメモ（文章・音声・絵・スタンプ想定）。",
    effect: "発想を逃さず積み重ねやすく、言語化が苦手でも使いやすい。",
  },
  {
    id: "interview-mission",
    title: "インタビューミッション",
    description: "家族・友だちに「何に困る？」「あったら使う？」を聞く課題を出す。",
    effect: "相手のニーズを知る経験になり、独りよがりでないアイデアに近づく。",
  },
  {
    id: "town-check",
    title: "まちたんけんチェック",
    description: "お店・学校・公園等を見て「人気の理由」「困りそうなこと」を観察する。",
    effect: "社会を見る視点が育ち、仕事や工夫を学びながら発想を広げられる。",
  },
  {
    id: "combo-maker",
    title: "アイデア組み合わせメーカー",
    description: "「好き×困りごと」「得意×仲間」「楽しい×役立つ」を組み合わせて案を作る。",
    effect: "ゼロから考えにくい子でも発想を広げやすくなる。",
  },
];

const DISCOVERY_WEEKLY_MISSIONS = [
  "雨の日を楽しくする",
  "学校で役立つ",
  "家族が助かる",
  "朝の準備をラクにする",
  "忘れ物を減らす",
  "友だちと協力しやすくする",
  "地域をもっと安全にする",
  "勉強のやる気を続ける",
  "お手伝いを習慣にする",
  "環境にやさしい行動を増やす",
];
const DISCOVERY_WEEKLY_MISSION_DETAILS: Record<string, { forWho: string; firstAction: string; evidence: string }> = {
  "雨の日を楽しくする": {
    forWho: "天気で行動が止まりやすい人向け。通学・遊び・準備のストレスに効くテーマ。",
    firstAction: "雨の日に一番困る瞬間を3つ書き出す（例: 靴が濡れる、荷物が増える）。",
    evidence: "「これがあると助かる」の声を2件以上。",
  },
  "学校で役立つ": {
    forWho: "授業・提出・連絡の小さな詰まりを改善したいときに最適。",
    firstAction: "1日の中で手間がかかる作業を1つ選び、現状の流れを3行で整理。",
    evidence: "同級生/先生の共感コメント2件以上。",
  },
  "家族が助かる": {
    forWho: "家庭内の分担・時間管理のモヤモヤを減らしたいとき向け。",
    firstAction: "家で毎週もめることを1つ決め、誰が何で困るかを書き分ける。",
    evidence: "家族の「使ってみたい」反応1件以上。",
  },
  "朝の準備をラクにする": {
    forWho: "忘れ物・遅刻・支度のバタつき改善に向く即効テーマ。",
    firstAction: "朝の準備で詰まる順番を時系列で3ステップ記録する。",
    evidence: "準備時間が短くなった体感メモ1件以上。",
  },
  "忘れ物を減らす": {
    forWho: "持ち物管理を習慣化したい人向け。チェック設計がしやすい。",
    firstAction: "直近1週間の忘れ物を種類ごとに数える。",
    evidence: "次週の忘れ物件数が減ったかどうか。",
  },
  "友だちと協力しやすくする": {
    forWho: "役割分担・連絡漏れ・グループ作業の詰まりを解くテーマ。",
    firstAction: "協力がうまくいかなかった場面を1つ選び、原因を2つ書く。",
    evidence: "協力作業での「やりやすさ」評価コメント2件。",
  },
  "地域をもっと安全にする": {
    forWho: "通学路・公園・夜道など、身近な安全課題に取り組むとき向け。",
    firstAction: "危ないと感じる場所を1箇所選び、いつ・誰が・何に困るかを整理。",
    evidence: "見守り側（大人）のフィードバック1件以上。",
  },
  "勉強のやる気を続ける": {
    forWho: "三日坊主対策や、学習継続の仕組み作りに向くテーマ。",
    firstAction: "やる気が切れるタイミングを1つ決めて、直前行動を記録。",
    evidence: "継続日数または学習回数の増加。",
  },
  "お手伝いを習慣にする": {
    forWho: "家庭での小タスクを続けやすくしたい場合に有効。",
    firstAction: "続きにくいお手伝いを1つ選び、面倒ポイントを分解。",
    evidence: "1週間で実行回数が増えたか。",
  },
  "環境にやさしい行動を増やす": {
    forWho: "エコ行動を無理なく習慣化したいときの定番テーマ。",
    firstAction: "すぐ始められる行動を1つ選び、実行ハードルを下げる案を考える。",
    evidence: "行動実施数または家族の参加人数の増加。",
  },
};
const DISCOVERY_PATTERN_TYPES = ["作る", "助ける", "教える", "楽しませる", "届ける", "まとめる", "つなぐ", "見える化する", "自動化する", "共有する"];
const DISCOVERY_FLASH_MODES = ["文章", "音声メモ（テキスト化）", "絵メモ（説明文）", "写真メモ（説明文）", "3行メモ", "1分ふりかえり"];
const DISCOVERY_PROBLEM_AREAS = ["学校", "家", "友だち", "趣味", "地域", "健康", "お金", "安全"];
const DISCOVERY_PROBLEM_STAMPS = ["💡", "😢", "😤", "🛠️", "⏰", "🎒", "📚", "🏠", "🚸", "💬"];
const DISCOVERY_INTERVIEW_TARGETS = ["友だち", "家族", "先生", "部活の仲間", "地域の人", "お店の人"];
const DISCOVERY_INTERVIEW_NEEDS = ["どんな時に困る？", "今どうやって解決してる？", "あったら毎日使う機能は？", "面倒だと思う瞬間は？"];
const DISCOVERY_TOWN_PLACES = ["学校", "図書館", "公園", "スーパー", "駅", "病院", "コンビニ", "商店街"];
const DISCOVERY_NAV_INTERESTS = ["教育", "部活", "ゲーム", "音楽", "動画", "デザイン", "SNS", "地域", "学習効率", "健康"];
const DISCOVERY_NAV_STRENGTHS = ["調べる", "まとめる", "話す", "書く", "作る", "デザイン", "企画する", "継続する", "撮影・編集", "分析する"];
const DISCOVERY_NAV_PROBLEMS = ["時間が足りない", "連絡が伝わらない", "続かない", "忘れやすい", "情報が散らばる", "不公平が起きる", "やる気が続かない", "準備が面倒"];
const DISCOVERY_NAV_TARGETS = ["同級生", "後輩", "家族", "部活メンバー", "学校全体", "地域の人"];
const DISCOVERY_MENU_IMAGES: Record<string, string> = {
  board:
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
  "weekly-mission":
    "https://images.unsplash.com/photo-1506784365847-bbad939e9335?auto=format&fit=crop&w=900&q=80",
  "pattern-cards":
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
  "idea-square":
    "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=900&q=80",
  "flash-memo":
    "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=80",
  "interview-mission":
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80",
  "town-check":
    "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=900&q=80",
  "combo-maker":
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=900&q=80",
};
const DISCOVERY_TOOL_GUIDES: Record<string, { purpose: string; steps: string[]; output: string }> = {
  "weekly-mission": {
    purpose: "毎週のお題で『考える筋トレ』をして、ゼロから悩む時間を減らす",
    steps: ["気になるお題を1つ選ぶ", "10分以内でミニ案を1つ書く", "完了にして次のお題へ進む"],
    output: "継続できる課題発見の習慣",
  },
  "pattern-cards": {
    purpose: "アイデアの型を選んで、解決案を構造化する",
    steps: ["型を1つ選ぶ（例: 見える化する）", "誰の困りごとかを1行で決める", "その型で解決する文を完成させる"],
    output: "伝わる1文ピッチ",
  },
  "idea-square": {
    purpose: "他ユーザーの視点を取り入れて、案を客観視する",
    steps: ["自分の案を短文投稿", "他の案にも2件いいね", "反応の高い表現を取り込む"],
    output: "反応が取れる表現への改善",
  },
  "flash-memo": {
    purpose: "思いつきを即保存し、検証前の素材を増やす",
    steps: ["30秒でメモを保存", "後で見返して共通語を探す", "共通語を完成室に反映"],
    output: "アイデア素材のストック",
  },
  "interview-mission": {
    purpose: "実際の困りごとを聞き、独りよがりを防ぐ",
    steps: ["誰に聞くか選ぶ", "困りごとを1件記録", "3人分集めて共通点を探す"],
    output: "ターゲットの実データ",
  },
  "town-check": {
    purpose: "街の観察から『使われる理由』と『不便』を抽出する",
    steps: ["場所を1つ選ぶ", "人気の理由と困りごとを記録", "改善アイデアを1つ添える"],
    output: "現場起点の改善テーマ",
  },
  "combo-maker": {
    purpose: "好き・困りごと・仲間を掛け合わせて実行可能性を上げる",
    steps: ["3つの要素を埋める", "提案文を1行で作る", "完成室で具体化する"],
    output: "実装しやすい初期コンセプト",
  },
};

const FAVORITE_DISCOVERY_OPTIONS: Array<{ genre: string; icon: string; items: string[] }> = [
  { genre: "遊び", icon: "🎈", items: ["外遊び", "パズル", "ごっこ遊び", "工作", "スポーツ", "探検", "カードゲーム", "なわとび", "鬼ごっこ", "自由研究"] },
  { genre: "勉強", icon: "📘", items: ["算数", "理科実験", "英語", "歴史", "社会", "プログラミング学習", "地図", "調べ学習", "プレゼン", "統計"] },
  { genre: "趣味", icon: "🎨", items: ["絵を描く", "音楽", "読書", "ダンス", "写真", "料理", "手芸", "作曲", "動画づくり", "DIY雑貨"] },
  { genre: "動物", icon: "🐾", items: ["犬", "猫", "鳥", "水の生き物", "昆虫", "動物のお世話", "保護活動", "観察日記"] },
  { genre: "ゲーム", icon: "🎮", items: ["ボードゲーム", "デジタルゲーム", "なぞ解き", "協力プレイ", "戦略ゲーム", "ゲーム制作", "マイクラ設計", "eスポーツ研究"] },
  { genre: "ものづくり", icon: "🛠️", items: ["アプリ作り", "ロボット", "DIY", "デザイン", "3D制作", "動画編集", "Web制作", "電子工作", "UI設計", "プロトタイピング"] },
  { genre: "人と関わる", icon: "🤝", items: ["発表", "人に教える", "イベント運営", "リーダー役", "インタビュー", "相談にのる", "司会", "ファシリテーション", "交渉", "コミュニティ運営"] },
  { genre: "社会・地域", icon: "🌍", items: ["地域活動", "環境問題", "福祉", "防災", "学校改善", "まちづくり", "フードロス対策", "交通安全", "高齢者支援", "国際交流"] },
];

const FAVORITE_CARD_TYPE_SCORE: Record<string, Partial<Record<AiMatchType, number>>> = {
  アプリ作り: { engineer: 3 },
  ロボット: { engineer: 3 },
  DIY: { engineer: 2 },
  プログラミング学習: { engineer: 3 },
  "3D制作": { engineer: 2 },
  動画編集: { engineer: 2, idea: 1 },
  理科実験: { engineer: 2, idea: 1 },
  パズル: { engineer: 2 },
  発表: { marketer: 3 },
  人に教える: { marketer: 2, idea: 1 },
  イベント運営: { marketer: 3 },
  リーダー役: { marketer: 2 },
  インタビュー: { marketer: 3 },
  相談にのる: { marketer: 2, idea: 1 },
  地域活動: { marketer: 2, idea: 1 },
  まちづくり: { marketer: 2, idea: 1 },
  環境問題: { idea: 2, marketer: 1 },
  絵を描く: { idea: 3 },
  音楽: { idea: 2 },
  読書: { idea: 2 },
  ダンス: { idea: 2 },
  写真: { idea: 2 },
  料理: { idea: 2 },
  ごっこ遊び: { idea: 2 },
  学校改善: { idea: 2, marketer: 1 },
};

const initialArticles: Article[] = [
  {
    id: "article-slot-1",
    title: "投資家インタビュー枠 #1",
    summary: "ここにインタビュー記事を掲載予定",
    status: "draft",
    body:
      "この記事では、子どもの挑戦を支えるために大切な視点をまとめます。\n\n" +
      "・最初の一歩を小さく設計する\n" +
      "・失敗から学べる環境を作る\n" +
      "・親子で対話しながら進める\n\n" +
      "moni の記事機能では、こうした知見をストックしていつでも振り返れるようにします。",
    category: "インタビュー",
    imageUrl:
      "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&w=1200&q=80",
    likeCount: 2,
    likedByMe: false,
    comments: [
      { id: "c-1", authorName: "ゆい", body: "この視点すごく参考になります！", createdAt: new Date().toISOString() },
      { id: "c-2", authorName: "たくみ", body: "次の記事も読みたいです。", createdAt: new Date().toISOString() },
    ],
  },
];

const DEMO_FEED: FeedPost[] = [
  {
    id: "demo-feed-welcome",
    authorId: "demo",
    authorName: "moni",
    caption: "Twitterみたいに短文を気軽に投稿できるようにしました。画像は任意で添付できます！",
    imageUrl:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#fce7f3"/><stop offset="50%" style="stop-color:#e0e7ff"/><stop offset="100%" style="stop-color:#cffafe"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><text x="400" y="380" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" fill="#64748b">サンプル</text><text x="400" y="430" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" fill="#94a3b8">Supabase 接続でみんなの投稿が見られます</text></svg>`,
      ),
    createdAt: new Date().toISOString(),
    likeCount: 0,
    likedByMe: false,
    commentCount: 0,
    comments: [],
  },
];

export default function Home() {
  const cardClass =
    "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6";
  const inputClass =
    "min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-500 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 sm:text-sm";
  const primaryButtonClass =
    "min-h-[42px] rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 hover:border-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 sm:text-xs";
  const secondaryButtonClass =
    "min-h-[42px] rounded-xl border border-zinc-900 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-100 active:bg-zinc-200 sm:text-xs";
  const bottomNavButtonClass = (page: FeaturePage) =>
    `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] leading-tight tracking-wide transition ${
      activePage === page ? "font-semibold text-sky-500" : "font-medium text-zinc-500 hover:text-zinc-800"
    }`;
  const [role, setRole] = useState<AppRole>("child");
  const [activePage, setActivePage] = useState<FeaturePage>("posts");
  const [language, setLanguage] = useState<Language>("ja");
  const [email, setEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileGoal, setProfileGoal] = useState("");
  const [profileType, setProfileType] = useState<AiMatchType>("idea");
  const [contactPermission, setContactPermission] = useState<ContactPermission>("followers");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState("");

  const [mentorMessages, setMentorMessages] = useState<MentorChatMessage[]>(() => [
    createMentorWelcomeMessage(),
  ]);
  const [mentorInput, setMentorInput] = useState("");
  const [mentorLoading, setMentorLoading] = useState(false);
  const [mentorError, setMentorError] = useState("");
  const mentorScrollAnchorRef = useRef<HTMLDivElement>(null);
  const chatScrollAnchorRef = useRef<HTMLDivElement>(null);

  const [matchGoal, setMatchGoal] = useState("");
  const [matches, setMatches] = useState<MatchMember[]>(DEMO_MEMBERS);
  const [matchNotice, setMatchNotice] = useState("");
  const [aiTypeInput, setAiTypeInput] = useState("");
  const [selectedAiType, setSelectedAiType] = useState<AiMatchType | null>(null);
  const [activeProfileMember, setActiveProfileMember] = useState<MatchMember | null>(null);
  const [activeIdeaToolId, setActiveIdeaToolId] = useState<string>(IDEA_TOOLS[0]?.id ?? "");
  const [discoverySubTab, setDiscoverySubTab] = useState<"menu" | "board" | "blueprint" | "tool">("menu");
  const [discoveryInterests, setDiscoveryInterests] = useState<string[]>([]);
  const [discoveryStrengths, setDiscoveryStrengths] = useState<string[]>([]);
  const [discoveryProblems, setDiscoveryProblems] = useState<string[]>([]);
  const [discoveryProblemText, setDiscoveryProblemText] = useState("");
  const [discoveryTarget, setDiscoveryTarget] = useState(DISCOVERY_NAV_TARGETS[0]);
  const [discoveryCandidates, setDiscoveryCandidates] = useState<DiscoveryIdeaCandidate[]>([]);
  const [discoveryComparisonIds, setDiscoveryComparisonIds] = useState<string[]>([]);
  const [discoveryScores, setDiscoveryScores] = useState<Record<string, Record<string, number>>>({});
  const [discoveryFinalIdeaId, setDiscoveryFinalIdeaId] = useState<string | null>(null);
  const [discoveryCompareView, setDiscoveryCompareView] = useState<"table" | "cards">("cards");
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [ideaDoneMap, setIdeaDoneMap] = useState<Record<string, boolean>>({});
  const [ideaMemoMap, setIdeaMemoMap] = useState<Record<string, string>>({});
  const [favoriteCards, setFavoriteCards] = useState<string[]>([]);
  const [testSheetQuestion, setTestSheetQuestion] = useState("このアイデア、友だちに使ってもらえると思う？");
  const [testSheetOptions, setTestSheetOptions] = useState<string[]>(["めっちゃ使いたい", "たぶん使う", "使わない"]);
  const [testSheetVotes, setTestSheetVotes] = useState<Record<number, number>>({ 0: 0, 1: 0, 2: 0 });
  const [testSheetThread, setTestSheetThread] = useState<TestSheetThreadPost[]>([]);
  const [testSheetPostDraft, setTestSheetPostDraft] = useState("");
  const [problemArea, setProblemArea] = useState<ProblemPost["area"]>("学校");
  const [problemDraft, setProblemDraft] = useState("");
  const [problemPosts, setProblemPosts] = useState<ProblemPost[]>(DEMO_PROBLEM_POSTS);
  const [problemIdeasMap, setProblemIdeasMap] = useState<Record<string, string[]>>({});
  const [strengthEntries, setStrengthEntries] = useState<Array<{ id: string; praise: string; requested: string; easy: string }>>([]);
  const [strengthDraft, setStrengthDraft] = useState({ praise: "", requested: "", easy: "" });
  const [problemHunterEntries, setProblemHunterEntries] = useState<Array<{ id: string; area: string; memo: string; stamp: string }>>([]);
  const [problemHunterDraft, setProblemHunterDraft] = useState({ area: "学校", memo: "", stamp: "💡" });
  const [whyQuestions, setWhyQuestions] = useState<Array<{ id: string; text: string }>>([]);
  const [whyDraft, setWhyDraft] = useState("");
  const [weeklyMissionDone, setWeeklyMissionDone] = useState<Record<string, boolean>>({});
  const [patternType, setPatternType] = useState("作る");
  const [ideaSquarePosts, setIdeaSquarePosts] = useState<IdeaSquarePost[]>([]);
  const [ideaSquareDraft, setIdeaSquareDraft] = useState("");
  const [flashMemos, setFlashMemos] = useState<Array<{ id: string; mode: string; text: string }>>([]);
  const [flashMode, setFlashMode] = useState("文章");
  const [flashDraft, setFlashDraft] = useState("");
  const [interviewLogs, setInterviewLogs] = useState<Array<{ id: string; who: string; need: string }>>([]);
  const [interviewDraft, setInterviewDraft] = useState({ who: "", need: "" });
  const [townChecks, setTownChecks] = useState<Array<{ id: string; place: string; popularReason: string; problem: string }>>([]);
  const [townDraft, setTownDraft] = useState({ place: "", popularReason: "", problem: "" });
  const [comboLike, setComboLike] = useState("");
  const [comboProblem, setComboProblem] = useState("");
  const [comboBuddy, setComboBuddy] = useState("");
  const [quickMemoOpen, setQuickMemoOpen] = useState(false);
  const [quickMemoDraft, setQuickMemoDraft] = useState("");
  const [quickMemoEntries, setQuickMemoEntries] = useState<Array<{ id: string; text: string; createdAt: string }>>([]);
  const [ideaBlueprint, setIdeaBlueprint] = useState<IdeaBlueprint>(IDEA_BLUEPRINT_INITIAL);
  const [ideaSprintPlan, setIdeaSprintPlan] = useState<IdeaSprintTask[]>([]);
  const [patternOneLiner, setPatternOneLiner] = useState("");

  const [code, setCode] = useState(
    'const service = "moni";\nconsole.log(service + "で挑戦を始めよう");',
  );
  const [codeOutput, setCodeOutput] = useState("ここに実行結果が表示されます。");

  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSummary, setArticleSummary] = useState("");
  const [articleBody, setArticleBody] = useState("");
  const [articleCategory, setArticleCategory] = useState("インタビュー");
  const [articleImageFile, setArticleImageFile] = useState<File | null>(null);
  const [articleImagePreview, setArticleImagePreview] = useState<string | null>(null);
  const [articleQuery, setArticleQuery] = useState("");
  const [articleFilterCategory, setArticleFilterCategory] = useState("all");
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [articleCommentDrafts, setArticleCommentDrafts] = useState<Record<string, string>>({});
  const [articleEditId, setArticleEditId] = useState<string | null>(null);
  const [articleEditTitle, setArticleEditTitle] = useState("");
  const [articleEditSummary, setArticleEditSummary] = useState("");
  const [articleEditBody, setArticleEditBody] = useState("");
  const [articleEditCategory, setArticleEditCategory] = useState("インタビュー");
  const [accountSubTab, setAccountSubTab] = useState<"profile" | "settings">("profile");
  const [mentorSubTab, setMentorSubTab] = useState<"menu" | "ai" | "validation">("menu");

  const [ideaChieQuestions, setIdeaChieQuestions] = useState<IdeaChieQuestion[]>([]);
  const [ideaChieDetailId, setIdeaChieDetailId] = useState<string | null>(null);
  const [ideaChieAnswers, setIdeaChieAnswers] = useState<IdeaChieAnswer[]>([]);
  const [ideaChieLoading, setIdeaChieLoading] = useState(false);
  const [ideaChieNewTitle, setIdeaChieNewTitle] = useState("");
  const [ideaChieNewBody, setIdeaChieNewBody] = useState("");
  const [ideaChieAnswerDraft, setIdeaChieAnswerDraft] = useState("");

  const accountText =
    language === "ja"
      ? {
          title: "アカウント",
          subtitle: "Google登録・フォロー数・タイプ設定・自己紹介",
          settingsSubtitle: "ユーザーネームなどの編集",
          back: "戻る",
          unnamed: "名前未設定",
          notLoggedIn: "未ログイン",
          posts: "投稿",
          followers: "フォロワー",
          following: "フォロー中",
          googleLogin: "Googleでログイン",
          saveAccount: "アカウント設定を保存",
          myPosts: "あなたの投稿",
          noPosts: "まだ投稿がありません。",
          loginForPosts: "ログインすると自分の投稿一覧が表示されます。",
          imageOnlyPost: "（画像投稿）",
          suggestedUsers: "おすすめユーザー",
          typeRecommend: "タイプ別AIおすすめ",
          followed: "フォロー中",
          follow: "フォロー",
          settingsSave: "Settingsを保存",
          username: "ユーザーネーム",
          usernameHint: "チャット・投稿・コメントに表示される名前です。",
          yourType: "あなたのタイプ",
          bio: "自己紹介",
          bioPlaceholder: "あなたの得意なことや挑戦したいことを書いてください",
          language: "言語",
          logout: "ログアウト",
          loginStatus: "ログイン",
        }
      : {
          title: "Account",
          subtitle: "Google sign-in, follows, type, and bio",
          settingsSubtitle: "Edit username and preferences",
          back: "Back",
          unnamed: "No name",
          notLoggedIn: "Not logged in",
          posts: "Posts",
          followers: "Followers",
          following: "Following",
          googleLogin: "Sign in with Google",
          saveAccount: "Save account",
          myPosts: "Your posts",
          noPosts: "No posts yet.",
          loginForPosts: "Sign in to see your post history.",
          imageOnlyPost: "(Image post)",
          suggestedUsers: "Suggested users",
          typeRecommend: "AI recommendations",
          followed: "Following",
          follow: "Follow",
          settingsSave: "Save settings",
          username: "Username",
          usernameHint: "Shown in posts and comments.",
          yourType: "Your type",
          bio: "Bio",
          bioPlaceholder: "Tell others what you are good at and want to build.",
          language: "Language",
          logout: "Log out",
          loginStatus: "Login",
        };

  const [pitchTitle, setPitchTitle] = useState("");
  const [pitchBody, setPitchBody] = useState("");
  const [pitches, setPitches] = useState<Pitch[]>([]);

  const [feedPosts, setFeedPosts] = useState<FeedPost[]>(() => (supabaseEnabled ? [] : DEMO_FEED));
  const [postCaption, setPostCaption] = useState("");
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postUploadPreview, setPostUploadPreview] = useState<string | null>(null);
  const [postPosting, setPostPosting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followListModal, setFollowListModal] = useState<"followers" | "following" | null>(null);
  const [accountPostCount, setAccountPostCount] = useState(0);
  const [followSuggestions, setFollowSuggestions] = useState<FollowUser[]>(DEMO_FOLLOW_USERS);
  const visibleFollowSuggestions = followSuggestions.length > 0 ? followSuggestions : DEMO_FOLLOW_USERS;
  const articleCategories = useMemo(() => {
    const cats = Array.from(new Set(articles.map((a) => a.category).filter(Boolean))) as string[];
    return ["all", ...cats];
  }, [articles]);
  const filteredArticles = useMemo(() => {
    const query = articleQuery.trim().toLowerCase();
    return articles.filter((a) => {
      const matchCategory = articleFilterCategory === "all" || (a.category ?? "") === articleFilterCategory;
      if (!matchCategory) return false;
      if (!query) return true;
      const haystack = `${a.title} ${a.summary} ${a.body ?? ""} ${a.category ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [articles, articleFilterCategory, articleQuery]);
  const activeArticle = useMemo(
    () => filteredArticles.find((a) => a.id === activeArticleId) ?? articles.find((a) => a.id === activeArticleId) ?? null,
    [activeArticleId, articles, filteredArticles],
  );
  const activeIdeaTool = useMemo(
    () => IDEA_TOOLS.find((tool) => tool.id === activeIdeaToolId) ?? IDEA_TOOLS[0] ?? null,
    [activeIdeaToolId],
  );
  const ideaCompletedCount = useMemo(
    () => IDEA_TOOLS.filter((tool) => ideaDoneMap[tool.id]).length,
    [ideaDoneMap],
  );
  const ideaChieDetailQuestion = useMemo(
    () => (ideaChieDetailId ? ideaChieQuestions.find((x) => x.id === ideaChieDetailId) ?? null : null),
    [ideaChieDetailId, ideaChieQuestions],
  );
  const ideaSupportChecklist = useMemo(() => {
    const items = [
      { id: "board", label: "困りごと・観察がボードに2件以上", done: problemHunterEntries.length + problemPosts.length >= 2 },
      { id: "why", label: "「なんで？」疑問が1件以上", done: whyQuestions.length >= 1 },
      { id: "talk", label: "インタビュー記録が1件以上", done: interviewLogs.length >= 1 },
      { id: "town", label: "まち観察が1件以上", done: townChecks.length >= 1 },
      { id: "mission", label: "週ミッションを1つ以上チェック", done: Object.values(weeklyMissionDone).some(Boolean) },
      { id: "flash", label: "ひらめきメモが1件以上", done: flashMemos.length >= 1 },
      {
        id: "combo",
        label: "組み合わせ（好き×困り×仲間）または広場投稿",
        done: (comboLike.trim() && comboProblem.trim()) || ideaSquarePosts.length >= 1,
      },
    ];
    const score = items.filter((i) => i.done).length;
    return { items, score, total: items.length, ready: score >= 5 };
  }, [
    comboLike,
    comboProblem,
    flashMemos.length,
    ideaSquarePosts.length,
    interviewLogs.length,
    problemHunterEntries.length,
    problemPosts.length,
    townChecks.length,
    weeklyMissionDone,
    whyQuestions.length,
  ]);
  const discoveryEvidence = useMemo(
    () => ({
      boardItems: problemPosts.length + problemHunterEntries.length,
      interviewItems: interviewLogs.length,
      validationItems: testSheetThread.length,
      publishItems: ideaSquarePosts.length,
      memoItems: flashMemos.length,
    }),
    [
      flashMemos.length,
      ideaSquarePosts.length,
      interviewLogs.length,
      problemHunterEntries.length,
      problemPosts.length,
      testSheetThread.length,
    ],
  );
  const problemClusters = useMemo<ProblemCluster[]>(() => {
    const buckets: Array<{ id: string; title: string; keywords: string[] }> = [
      { id: "study", title: "学習・学校オペレーション", keywords: ["宿題", "授業", "勉強", "学校", "忘れ物", "連絡", "提出"] },
      { id: "family", title: "家庭内の分担・時間管理", keywords: ["家", "兄弟", "親", "手伝い", "家事", "時間", "順番"] },
      { id: "social", title: "友だち・コミュニケーション", keywords: ["友だち", "会話", "相談", "いじめ", "関係", "連絡"] },
      { id: "safety", title: "地域・移動・安全", keywords: ["地域", "防災", "危険", "安全", "通学", "道", "交通"] },
      { id: "hobby", title: "趣味・習慣づくり", keywords: ["趣味", "ゲーム", "継続", "やる気", "習慣"] },
    ];
    const grouped = buckets.map((bucket) => {
      const hits = problemPosts.filter((post) => {
        const body = post.body.toLowerCase();
        return bucket.keywords.some((kw) => body.includes(kw.toLowerCase()));
      });
      return {
        id: bucket.id,
        title: bucket.title,
        count: hits.length,
        sample: hits.slice(0, 3).map((x) => x.body),
      };
    });
    const uncategorized = problemPosts.filter((post) => {
      const body = post.body.toLowerCase();
      return !buckets.some((bucket) => bucket.keywords.some((kw) => body.includes(kw.toLowerCase())));
    });
    const result = grouped.filter((g) => g.count > 0);
    if (uncategorized.length > 0) {
      result.push({
        id: "other",
        title: "その他・新規テーマ",
        count: uncategorized.length,
        sample: uncategorized.slice(0, 3).map((x) => x.body),
      });
    }
    return result.sort((a, b) => b.count - a.count);
  }, [problemPosts]);
  const problemDraftQuality = useMemo(() => scoreProblemDraft(problemDraft), [problemDraft]);
  const similarProblemPost = useMemo(() => {
    const normalized = normalizeDiscoveryText(problemDraft);
    if (!normalized || normalized.length < 10) return null;
    return (
      problemPosts.find((post) => {
        const existing = normalizeDiscoveryText(post.body);
        return existing.includes(normalized.slice(0, 10)) || normalized.includes(existing.slice(0, 10));
      }) ?? null
    );
  }, [problemDraft, problemPosts]);
  const ideaBlueprintHealth = useMemo(() => {
    const checks = [
      { id: "problem", label: "課題が具体的", ok: ideaBlueprint.problem.trim().length >= 16, fix: "共有ボードの上位投稿から課題文を1つ引用する" },
      { id: "target", label: "対象ユーザーが明確", ok: ideaBlueprint.target.trim().length >= 6, fix: "誰が困るか（例: 朝の準備に困る小学生）を明記する" },
      { id: "solution", label: "解決方法が行動レベル", ok: ideaBlueprint.solution.trim().length >= 24, fix: "機能の動きが分かる1文にする" },
      { id: "hypothesis", label: "仮説が検証可能", ok: ideaBlueprint.hypothesis.trim().length >= 20, fix: "もし〜なら、〜が増える/減る の形で書く" },
      { id: "metric", label: "成功指標が数値化", ok: /\d/.test(ideaBlueprint.metric), fix: "件数や回数など数字を入れる" },
    ];
    const weakPoints = checks.filter((c) => !c.ok);
    return { checks, weakPoints, score: checks.length - weakPoints.length, total: checks.length };
  }, [ideaBlueprint]);
  const validationSummary = useMemo(() => {
    const votes = testSheetOptions.map((opt, idx) => ({ option: opt, count: testSheetVotes[idx] ?? 0 }));
    const total = votes.reduce((sum, v) => sum + v.count, 0);
    const top = [...votes].sort((a, b) => b.count - a.count)[0];
    const positiveWords = ["使いたい", "いい", "欲しい", "便利", "最高", "賛成", "神", "あり"];
    const negativeWords = ["使わない", "むずい", "分から", "いらない", "微妙", "反対", "高い", "面倒"];
    let pos = 0;
    let neg = 0;
    for (const post of testSheetThread) {
      const text = post.body;
      if (positiveWords.some((w) => text.includes(w))) pos += 1;
      if (negativeWords.some((w) => text.includes(w))) neg += 1;
    }
    const sentiment = pos === neg ? "拮抗" : pos > neg ? "好意的" : "慎重";
    const decision =
      total === 0
        ? "まだデータ不足。まずは投票を集める。"
        : top && top.count / Math.max(total, 1) >= 0.5
          ? `最有力は「${top.option}」方向。`
          : "回答が割れているため、案を絞って再検証。";
    const nextAction =
      sentiment === "好意的"
        ? "コア機能だけの試作を作り、少人数に再テスト。"
        : sentiment === "慎重"
          ? "否定コメントの原因を3つに分解して改善案を作る。"
          : "賛否の分岐条件を質問追加して再投票。";
    return { total, top, sentiment, decision, nextAction, pos, neg };
  }, [testSheetOptions, testSheetThread, testSheetVotes]);
  const myFeedPosts = useMemo(
    () => (session ? feedPosts.filter((post) => post.authorId === session.user.id) : []),
    [feedPosts, session],
  );
  const postFileInputRef = useRef<HTMLInputElement>(null);

  const [chatBody, setChatBody] = useState("");
  const [chatAttachmentName, setChatAttachmentName] = useState("");
  const [chatAttachmentPreview, setChatAttachmentPreview] = useState<string | null>(null);
  const chatAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatSearch, setChatSearch] = useState("");
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [callRoom, setCallRoom] = useState("");
  const [callUrl, setCallUrl] = useState("");
  /** LINE のトーク一覧 ↔ 個別トーク */
  const [chatSubView, setChatSubView] = useState<"list" | "room">("list");
  const [activeRoomId, setActiveRoomId] = useState("global");
  const [dmPeers, setDmPeers] = useState<DmPeerRow[]>([]);
  const [groupRooms, setGroupRooms] = useState<GroupRoomRow[]>([]);
  const [groupRoomDraft, setGroupRoomDraft] = useState("");
  const [talkMeta, setTalkMeta] = useState<Record<string, TalkRoomMeta>>({});
  const [opsEvents, setOpsEvents] = useState<OpsEvent[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  /** ログイン済みでも「サービス説明」LPを重ねて表示 */
  const [showLandingPage, setShowLandingPage] = useState(false);
  const canUseSupabase = useMemo(() => Boolean(supabase && supabaseEnabled), []);
  const requiresLogin = canUseSupabase && !session;

  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const loadRole = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("role,display_name,goal")
      .eq("id", userId)
      .maybeSingle();
    if (error) return;
    if (data?.role === "child" || data?.role === "parent" || data?.role === "investor") {
      setRole(data.role);
    }
    setDisplayName((data?.display_name as string | null) ?? "");
    setProfileGoal((data?.goal as string | null) ?? "");
  }, []);

  async function saveRole(nextRole: AppRole) {
    setRole(nextRole);
    if (!supabase || !session) return;
    const { error } = await supabase.from("profiles").upsert({
      id: session.user.id,
      role: nextRole,
      display_name: displayName || session.user.email || "user",
      goal: profileGoal,
    });
    if (error) {
      setAuthMessage(`ロール保存に失敗: ${error.message}`);
    }
  }

  async function saveProfile() {
    if (!supabase || !session) return;
    const { error } = await supabase.from("profiles").upsert({
      id: session.user.id,
      role,
      display_name: displayName || session.user.email || "user",
      goal: profileGoal,
    });
    if (error) {
      setAuthMessage(`プロフィール保存に失敗: ${error.message}`);
      return;
    }
    setAuthMessage("プロフィールを保存しました。");
  }

  const loadArticles = useCallback(async () => {
    if (!supabase) return;
    let query = supabase
      .from("articles")
      .select("id,title,summary,status,author_id,created_at,body,category,image_url")
      .order("created_at", { ascending: false });
    if (role !== "investor") query = query.eq("status", "published");
    const { data, error } = await query;
    if (error) {
      setAuthMessage(`記事の取得に失敗: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      setArticles(initialArticles);
      return;
    }
    const authorIds = [...new Set((data as Array<{ author_id?: string | null }>).map((r) => r.author_id).filter(Boolean) as string[])];
    const { data: profiles } =
      authorIds.length > 0
        ? await supabase.from("profiles").select("id,display_name").in("id", authorIds)
        : { data: [] as Array<{ id: string; display_name: string | null }> };
    const authorNameMap = new Map(
      (profiles ?? []).map((p) => [p.id as string, ((p.display_name as string | null)?.trim() || "ユーザー") as string]),
    );
    setArticles(
      (data as Array<Record<string, unknown>>).map((a) => ({
        id: (a.id as string) ?? "",
        title: (a.title as string) ?? "",
        summary: (a.summary as string) ?? "",
        status: ((a.status as "draft" | "published") ?? "draft") as "draft" | "published",
        authorId: (a.author_id as string | undefined) ?? undefined,
        authorName: authorNameMap.get((a.author_id as string | undefined) ?? "") ?? "ユーザー",
        createdAt: (a.created_at as string | undefined) ?? undefined,
        body: ((a.body as string | undefined) ?? (a.summary as string) ?? "").trim(),
        category: ((a.category as string | undefined) ?? "インタビュー").trim() || "インタビュー",
        imageUrl: (a.image_url as string | null | undefined) ?? null,
        likeCount: 0,
        likedByMe: false,
        comments: [],
      })),
    );
  }, [role]);

  const loadPitches = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("pitches")
      .select("id,title,body,likes")
      .order("created_at", { ascending: false });
    if (error) {
      setAuthMessage(`ピッチの取得に失敗: ${error.message}`);
      return;
    }
    setPitches((data as Pitch[]) ?? []);
  }, []);

  const loadPosts = useCallback(async () => {
    if (!supabaseEnabled || !supabase) {
      setFeedPosts(DEMO_FEED);
      return;
    }
    const client = supabase;
    const uid = sessionRef.current?.user.id ?? null;
    const { data: rows, error } = await client
      .from("posts")
      .select("id,author_id,caption,image_path,created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      const hint = `${error.message}${error.code ? ` (${error.code})` : ""}`;
      if (
        hint.includes("does not exist") ||
        hint.includes("schema cache") ||
        error.code === "42P01" ||
        error.code === "PGRST205"
      ) {
        setFeedPosts(DEMO_FEED);
        return;
      }
      setAuthMessage(`投稿の取得に失敗: ${error.message}`);
      return;
    }
    if (!rows?.length) {
      setFeedPosts([]);
      return;
    }
    const authorIds = [...new Set(rows.map((r) => r.author_id as string))];
    const { data: profs } = await client.from("profiles").select("id,display_name").in("id", authorIds);
    const nameById = new Map(
      (profs ?? []).map((p) => [
        p.id as string,
        ((p.display_name as string | null)?.trim() || "ユーザー") as string,
      ]),
    );
    const postIds = rows.map((r) => r.id as string);
    const { data: likesRows } = await client.from("post_likes").select("post_id,user_id").in("post_id", postIds);
    const { data: commentsRows, error: commentsError } = await client
      .from("post_comments")
      .select("id,post_id,author_id,body,created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true });
    if (commentsError && commentsError.code !== "42P01" && commentsError.code !== "PGRST205") {
      setAuthMessage(`コメントの取得に失敗: ${commentsError.message}`);
    }
    const countByPost = new Map<string, number>();
    const likedSet = new Set<string>();
    for (const lr of likesRows ?? []) {
      const pid = lr.post_id as string;
      countByPost.set(pid, (countByPost.get(pid) ?? 0) + 1);
      if (uid && (lr.user_id as string) === uid) likedSet.add(pid);
    }
    const safeCommentsRows = commentsRows ?? [];
    const commentAuthorIds = [...new Set(safeCommentsRows.map((c) => c.author_id as string))];
    const { data: commentProfiles } =
      commentAuthorIds.length > 0
        ? await client.from("profiles").select("id,display_name").in("id", commentAuthorIds)
        : { data: [] as { id: string; display_name: string | null }[] };
    const commentNameById = new Map(
      (commentProfiles ?? []).map((p) => [
        p.id as string,
        ((p.display_name as string | null)?.trim() || "ユーザー") as string,
      ]),
    );
    const commentsByPost = new Map<string, FeedComment[]>();
    for (const c of safeCommentsRows) {
      const postId = c.post_id as string;
      const next: FeedComment = {
        id: c.id as string,
        postId,
        authorId: c.author_id as string,
        authorName: commentNameById.get(c.author_id as string) || "ユーザー",
        body: (c.body as string) ?? "",
        createdAt: c.created_at as string,
      };
      commentsByPost.set(postId, [...(commentsByPost.get(postId) ?? []), next]);
    }
    const mapped: FeedPost[] = rows.map((r) => {
      const path = (r.image_path as string | null) ?? null;
      const { data: pub } = path ? client.storage.from("post-images").getPublicUrl(path) : { data: { publicUrl: null } };
      const postComments = commentsByPost.get(r.id as string) ?? [];
      return {
        id: r.id as string,
        authorId: r.author_id as string,
        authorName: nameById.get(r.author_id as string) || "ユーザー",
        caption: (r.caption as string) || "",
        imageUrl: pub.publicUrl,
        storagePath: path ?? undefined,
        createdAt: r.created_at as string,
        likeCount: countByPost.get(r.id as string) ?? 0,
        likedByMe: likedSet.has(r.id as string),
        commentCount: postComments.length,
        comments: postComments,
      };
    });
    setFeedPosts(mapped);
  }, []);

  const loadSocialGraph = useCallback(async (userId: string) => {
    if (!supabase) {
      setFollowSuggestions(DEMO_FOLLOW_USERS);
      return;
    }
    const client = supabase;

    const [{ count: followers }, { count: following }, { count: myPosts }, followsRes, profileRes] = await Promise.all([
      client.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
      client.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
      client.from("posts").select("*", { count: "exact", head: true }).eq("author_id", userId),
      client.from("follows").select("following_id").eq("follower_id", userId),
      client.from("profiles").select("id,display_name,goal").neq("id", userId).limit(30),
    ]);

    const followsErrorCode = (followsRes as { error?: { code?: string } }).error?.code;
    if (followsErrorCode === "42P01" || followsErrorCode === "PGRST205") {
      // follows テーブル未作成時は空状態にして継続
      setFollowingIds([]);
      setFollowerCount(0);
      setFollowingCount(0);
      setFollowSuggestions(DEMO_FOLLOW_USERS);
      return;
    }

    setFollowerCount(followers ?? 0);
    setFollowingCount(following ?? 0);
    setAccountPostCount(myPosts ?? 0);

    const followsData = (followsRes as { data?: Array<{ following_id: string }> }).data ?? [];
    const ids = followsData.map((r) => r.following_id);
    setFollowingIds(ids);

    const profiles = (profileRes as { data?: Array<{ id: string; display_name: string | null; goal: string | null }> }).data ?? [];
    const suggestions: FollowUser[] = profiles
      .filter((p) => !ids.includes(p.id))
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        name: (p.display_name || "ユーザー").trim() || "ユーザー",
        goal: (p.goal || "目標未設定").trim() || "目標未設定",
      }));
    setFollowSuggestions(suggestions.length > 0 ? suggestions : DEMO_FOLLOW_USERS);
  }, []);

  const loadMessages = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,sender_id,sender_name,body,created_at")
      .eq("room_id", activeRoomId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) {
      setAuthMessage(`チャットの取得に失敗: ${error.message}`);
      return;
    }
    const mapped = (data ?? []).map((row) => ({
      id: row.id as string,
      sender: row.sender_name as string,
      senderId: (row.sender_id as string | null) ?? null,
      body: row.body as string,
      createdAt: new Date(row.created_at as string).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      createdAtIso: row.created_at as string,
    }));
    setMessages(mapped);
  }, [activeRoomId, supabase]);

  const loadIdeaChieBoard = useCallback(async () => {
    if (!supabase) return;
    setIdeaChieLoading(true);
    const { data: qrows, error: qerr } = await supabase
      .from("idea_questions")
      .select("id,author_id,author_display_name,title,body,best_answer_id,created_at")
      .order("created_at", { ascending: false })
      .limit(80);
    if (qerr) {
      if (qerr.code !== "42P01" && qerr.code !== "PGRST205") {
        setAuthMessage(`知恵袋の読み込みに失敗: ${qerr.message}`);
      }
      setIdeaChieQuestions([]);
      setIdeaChieLoading(false);
      return;
    }
    const { data: arows, error: aerr } = await supabase.from("idea_answers").select("question_id");
    const countMap: Record<string, number> = {};
    if (!aerr && arows) {
      for (const row of arows as Array<{ question_id: string }>) {
        const qid = row.question_id;
        countMap[qid] = (countMap[qid] ?? 0) + 1;
      }
    }
    const mapped: IdeaChieQuestion[] = (qrows ?? []).map((row) => ({
      id: row.id as string,
      authorId: row.author_id as string,
      authorName: (row.author_display_name as string) || "ユーザー",
      title: row.title as string,
      body: (row.body as string) ?? "",
      bestAnswerId: (row.best_answer_id as string | null) ?? null,
      createdAtIso: row.created_at as string,
      answerCount: countMap[row.id as string] ?? 0,
    }));
    setIdeaChieQuestions(mapped);
    setIdeaChieLoading(false);
  }, [supabase]);

  const loadIdeaChieAnswers = useCallback(async (questionId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("idea_answers")
      .select("id,question_id,author_id,author_display_name,body,created_at")
      .eq("question_id", questionId)
      .order("created_at", { ascending: true });
    if (error) {
      setAuthMessage(`回答の取得に失敗: ${error.message}`);
      setIdeaChieAnswers([]);
      return;
    }
    setIdeaChieAnswers(
      (data ?? []).map((row) => ({
        id: row.id as string,
        questionId: row.question_id as string,
        authorId: row.author_id as string,
        authorName: (row.author_display_name as string) || "ユーザー",
        body: row.body as string,
        createdAtIso: row.created_at as string,
      })),
    );
  }, [supabase]);

  const loadReadState = useCallback(
    async (userId: string, roomId: string) => {
      if (!supabase) return;
      const { data } = await supabase
        .from("chat_reads")
        .select("last_read_at")
        .eq("user_id", userId)
        .eq("room_id", roomId)
        .maybeSingle();
      setLastReadAt((data?.last_read_at as string | null) ?? null);
    },
    [supabase],
  );

  const refreshTalkListRef = useRef<(() => Promise<void>) | null>(null);

  const refreshTalkList = useCallback(async () => {
    const s = sessionRef.current;
    if (!supabase || !s) {
      setDmPeers([]);
      setGroupRooms([]);
      setTalkMeta({});
      return;
    }

    const { data: rooms, error: roomErr } = await supabase
      .from("chat_dm_rooms")
      .select("room_id, peer_a, peer_b");
    if (roomErr) {
      setAuthMessage(`トーク一覧の取得に失敗: ${roomErr.message}`);
      return;
    }

    const list: DmPeerRow[] = [];
    const peerIds: string[] = [];
    for (const row of rooms ?? []) {
      const pa = row.peer_a as string;
      const pb = row.peer_b as string;
      const peerId = pa === s.user.id ? pb : pa;
      peerIds.push(peerId);
      list.push({ room_id: row.room_id as string, peer_id: peerId, peer_name: "…" });
    }

    const { data: profiles } =
      peerIds.length > 0
        ? await supabase.from("profiles").select("id, display_name").in("id", peerIds)
        : { data: [] as { id: string; display_name: string | null }[] };
    const nameBy = new Map(
      (profiles ?? []).map((p) => [p.id as string, ((p.display_name as string | null) || "ユーザー") as string]),
    );
    const enriched = list.map((r) => ({ ...r, peer_name: nameBy.get(r.peer_id) || "ユーザー" }));
    setDmPeers(enriched);

    const { data: groupRows, error: groupErr } = await supabase
      .from("chat_group_rooms")
      .select("room_id,room_name")
      .order("created_at", { ascending: false });
    if (groupErr && groupErr.code !== "42P01" && groupErr.code !== "PGRST205") {
      setAuthMessage(`グループ一覧の取得に失敗: ${groupErr.message}`);
    }
    const groups = ((groupRows ?? []) as Array<{ room_id: string; room_name: string }>).map((g) => ({
      room_id: g.room_id,
      room_name: g.room_name || "グループ",
    }));
    setGroupRooms(groups);

    const { data: reads } = await supabase
      .from("chat_reads")
      .select("room_id, last_read_at")
      .eq("user_id", s.user.id);
    const readMap = new Map((reads ?? []).map((r) => [r.room_id as string, r.last_read_at as string]));

    const allRooms = ["global", ...groups.map((g) => g.room_id), ...enriched.map((e) => e.room_id)];
    const meta: Record<string, TalkRoomMeta> = {};
    const epoch = "1970-01-01T00:00:00.000Z";

    const formatTimeLabel = (iso: string) => {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      return isToday
        ? d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
        : `${d.getMonth() + 1}/${d.getDate()}`;
    };

    for (const rid of allRooms) {
      const { data: last } = await supabase
        .from("chat_messages")
        .select("body, created_at, sender_id")
        .eq("room_id", rid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lr = readMap.get(rid);
      let unread = 0;
      if (last) {
        const since = lr ?? epoch;
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("room_id", rid)
          .gt("created_at", since)
          .neq("sender_id", s.user.id);
        unread = count ?? 0;
      }

      const body = (last?.body as string)?.replace(/\s+/g, " ").trim() ?? "";
      const previewText = body ? (body.length > 42 ? `${body.slice(0, 42)}…` : body) : "メッセージはまだありません";
      const timeLabel = last?.created_at ? formatTimeLabel(last.created_at as string) : "";

      meta[rid] = { previewText, timeLabel, unread };
    }

    setTalkMeta(meta);
  }, [supabase]);

  refreshTalkListRef.current = refreshTalkList;

  const eventSummary = useMemo(() => {
    const byName: Record<string, number> = {};
    for (const ev of opsEvents) byName[ev.name] = (byName[ev.name] ?? 0) + 1;
    return Object.entries(byName)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [opsEvents]);

  function trackOpsEvent(name: string) {
    const event: OpsEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      at: new Date().toISOString(),
      page: activePage,
      userId: session?.user.id ?? null,
    };
    setOpsEvents((prev) => [event, ...prev].slice(0, 300));
    if (supabase && session) {
      void supabase.from("app_events").insert({
        event_name: name,
        page: activePage,
        user_id: session.user.id,
        created_at: event.at,
      });
    }
  }

  async function submitReport(targetType: ReportEntry["targetType"], targetId: string, excerpt: string) {
    const reasonRaw = typeof window !== "undefined" ? window.prompt("通報理由を入力してください（任意）", "") : "";
    if (reasonRaw == null) return;
    const reason = reasonRaw.trim() || "内容を確認してほしい";
    const entry: ReportEntry = {
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      targetType,
      targetId,
      reason,
      excerpt: excerpt.slice(0, 220),
      createdAt: new Date().toISOString(),
      status: "new",
    };
    setReports((prev) => [entry, ...prev].slice(0, 200));
    if (supabase && session) {
      const { error } = await supabase.from("reports").insert({
        target_type: targetType,
        target_id: targetId,
        reason,
        excerpt: entry.excerpt,
        reporter_id: session.user.id,
      });
      if (error && error.code !== "42P01" && error.code !== "PGRST205") {
        setAuthMessage(`通報の送信に失敗: ${error.message}`);
        return;
      }
    }
    setAuthMessage("通報を受け付けました。内容を確認します。");
    trackOpsEvent(`report_${targetType}`);
  }

  function updateReportStatus(reportId: string, status: "new" | "reviewing" | "resolved") {
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
    trackOpsEvent(`report_status_${status}`);
  }

  function assignReport(reportId: string, assignee: string) {
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, assignee: assignee.trim() || undefined } : r)));
    trackOpsEvent("report_assigned");
  }

  function setReportDeadline(reportId: string, dueAt: string) {
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, dueAt: dueAt || undefined } : r)));
    trackOpsEvent("report_deadline_set");
  }

  function dismissNotification(id: string) {
    setDismissedNotificationIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  const loadRoleRef = useRef(loadRole);
  const loadArticlesRef = useRef(loadArticles);
  const loadPitchesRef = useRef(loadPitches);
  const loadPostsRef = useRef(loadPosts);
  const loadSocialGraphRef = useRef(loadSocialGraph);
  const loadMessagesRef = useRef(loadMessages);
  loadRoleRef.current = loadRole;
  loadArticlesRef.current = loadArticles;
  loadPitchesRef.current = loadPitches;
  loadPostsRef.current = loadPosts;
  loadSocialGraphRef.current = loadSocialGraph;
  loadMessagesRef.current = loadMessages;

  async function markChatAsRead() {
    if (!supabase || !session) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("chat_reads").upsert({
      user_id: session.user.id,
      room_id: activeRoomId,
      last_read_at: now,
    });
    if (error) {
      setAuthMessage(`既読更新に失敗: ${error.message}`);
      return;
    }
    setLastReadAt(now);
    void refreshTalkListRef.current?.();
  }

  function canUseDmWith(peerId?: string): boolean {
    if (contactPermission === "none") return false;
    if (contactPermission === "all" || contactPermission === "message_only") return true;
    if (contactPermission === "followers") {
      if (!peerId) return false;
      return followingIds.includes(peerId);
    }
    return true;
  }

  function canUseCallForCurrentRoom(): boolean {
    if (contactPermission === "none" || contactPermission === "message_only") return false;
    if (contactPermission === "all") return true;
    if (contactPermission === "followers") {
      if (activeRoomId === "global") return false;
      if (groupRooms.some((g) => g.room_id === activeRoomId)) return true;
      const peer = dmPeers.find((p) => p.room_id === activeRoomId);
      if (!peer) return false;
      return followingIds.includes(peer.peer_id);
    }
    return true;
  }

  function currentRoomLabel() {
    if (activeRoomId === "global") return "みんなのルーム";
    const group = groupRooms.find((g) => g.room_id === activeRoomId);
    if (group) return group.room_name;
    return dmPeers.find((p) => p.room_id === activeRoomId)?.peer_name ?? "メッセージ";
  }

  function currentRoomSubLabel() {
    if (activeRoomId === "global") {
      return onlineUsers.length > 0 ? `アクティブ ${onlineUsers.join(" · ")}` : "";
    }
    if (groupRooms.some((g) => g.room_id === activeRoomId)) return "グループトーク";
    return "マッチからつながったトーク";
  }

  async function createGroupRoom() {
    if (!session) {
      setAuthMessage("グループ作成にはログインしてください。");
      return;
    }
    const name = groupRoomDraft.trim();
    if (!name) {
      setAuthMessage("グループ名を入力してください。");
      return;
    }
    const roomId = `group|${Date.now().toString(36)}|${Math.random().toString(36).slice(2, 7)}`;
    if (supabase) {
      const { error } = await supabase
        .from("chat_group_rooms")
        .insert({ room_id: roomId, room_name: name, owner_id: session.user.id });
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          setAuthMessage("グループはこの環境ではDBに保存されません（テーブル未作成）。");
        } else {
          setAuthMessage(`グループ作成に失敗: ${error.message}`);
          return;
        }
      }
    }
    setGroupRooms((prev) => [{ room_id: roomId, room_name: name }, ...prev]);
    setGroupRoomDraft("");
    setActiveRoomId(roomId);
    setChatSubView("room");
    setAuthMessage(`グループ「${name}」を作成しました。`);
  }

  async function openDmFromMatch(peerId: string, peerName: string) {
    if (!supabase || !session) {
      setAuthMessage("つながるにはログインが必要です。");
      return;
    }
    if (!canUseDmWith(peerId)) {
      setAuthMessage("現在のSettingsではこのユーザーへのDMは許可されていません。");
      return;
    }
    if (peerId === session.user.id) return;
    const roomId = makeDmRoomId(session.user.id, peerId);
    const [peer_a, peer_b] = sortPeerIds(session.user.id, peerId);
    const { error } = await supabase.from("chat_dm_rooms").insert({ room_id: roomId, peer_a, peer_b });
    if (error && error.code !== "23505") {
      // デモユーザーなどでFK制約に当たっても、UI上のDM導線は止めない
      if (error.code === "23503") {
        setDmPeers((prev) => {
          if (prev.some((p) => p.room_id === roomId)) return prev;
          return [{ room_id: roomId, peer_id: peerId, peer_name: peerName }, ...prev];
        });
        setActiveRoomId(roomId);
        setActivePage("chat");
        setChatSubView("room");
        setMessages([]);
        setAuthMessage(`${peerName}さんとのトークを開きました。`);
        return;
      }
      setAuthMessage(`トークルームの作成に失敗: ${error.message}`);
      return;
    }
    await refreshTalkList();
    setActiveRoomId(roomId);
    setActivePage("chat");
    setChatSubView("room");
    setAuthMessage(`${peerName}さんとのトークを開きました。`);
  }

  const unreadCount = useMemo(() => {
    if (!session) return 0;
    const readTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
    return messages.filter((msg) => {
      const msgTime = new Date(msg.createdAtIso).getTime();
      return msg.senderId !== session.user.id && msgTime > readTime;
    }).length;
  }, [lastReadAt, messages, session]);

  /** LINE の「ここから未読」用：相手の未読の先頭メッセージのインデックス */
  const firstUnreadMessageIndex = useMemo(() => {
    if (!session) return -1;
    const readTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
    return messages.findIndex((msg) => {
      const msgTime = new Date(msg.createdAtIso).getTime();
      return msg.senderId !== session.user.id && msgTime > readTime;
    });
  }, [lastReadAt, messages, session]);

  const totalTalkUnread = useMemo(
    () => Object.values(talkMeta).reduce((s, m) => s + m.unread, 0),
    [talkMeta],
  );
  const reportNewCount = useMemo(() => reports.filter((r) => (r.status ?? "new") === "new").length, [reports]);
  const notificationItems = useMemo(() => {
    const items: Array<{ id: string; level: "info" | "warn"; text: string }> = [];
    if (totalTalkUnread > 0) items.push({ id: "chat-unread", level: "info", text: `未読メッセージが ${totalTalkUnread} 件あります` });
    if (!ideaSupportChecklist.ready) {
      items.push({
        id: "idea-ready",
        level: "warn",
        text: `アイデア材料が不足気味です（${ideaSupportChecklist.score}/${ideaSupportChecklist.total}）`,
      });
    }
    if (reportNewCount > 0) items.push({ id: "report-new", level: "warn", text: `未対応の通報が ${reportNewCount} 件あります` });
    return items.filter((item) => !dismissedNotificationIds.includes(item.id)).slice(0, 6);
  }, [dismissedNotificationIds, ideaSupportChecklist.ready, ideaSupportChecklist.score, ideaSupportChecklist.total, reportNewCount, totalTalkUnread]);
  const eventDailySummary = useMemo(() => {
    const bucket: Record<string, number> = {};
    for (const ev of opsEvents) {
      const key = new Date(ev.at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
      bucket[key] = (bucket[key] ?? 0) + 1;
    }
    return Object.entries(bucket)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-7);
  }, [opsEvents]);

  const globalTalkPreview = talkMeta.global ?? {
    previewText: "メッセージはまだありません",
    timeLabel: "",
    unread: 0,
  };
  const filteredMessages = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => `${m.sender} ${m.body}`.toLowerCase().includes(q));
  }, [chatSearch, messages]);
  const mentionCandidates = useMemo(() => {
    const names = new Set<string>(["all", ...onlineUsers, ...dmPeers.map((p) => p.peer_name), ...groupRooms.map((g) => g.room_name)]);
    return [...names].filter(Boolean).slice(0, 10);
  }, [dmPeers, groupRooms, onlineUsers]);
  const showMentionHelper = useMemo(() => /(^|\s)@\S*$/.test(chatBody), [chatBody]);

  const autoReadTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("moni-language");
    if (saved === "ja" || saved === "en") setLanguage(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("moni-language", language);
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-ops-events-${session.user.id}` : "moni-ops-events-guest";
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as OpsEvent[];
        if (Array.isArray(parsed)) setOpsEvents(parsed.slice(0, 300));
      }
    } catch {
      // ignore parse errors
    }
    const reportKey = session ? `moni-reports-${session.user.id}` : "moni-reports-guest";
    try {
      const raw = window.localStorage.getItem(reportKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ReportEntry[];
        if (Array.isArray(parsed)) setReports(parsed.slice(0, 200));
      }
    } catch {
      // ignore parse errors
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-ops-events-${session.user.id}` : "moni-ops-events-guest";
    window.localStorage.setItem(key, JSON.stringify(opsEvents.slice(0, 300)));
  }, [opsEvents, session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-reports-${session.user.id}` : "moni-reports-guest";
    window.localStorage.setItem(key, JSON.stringify(reports.slice(0, 200)));
  }, [reports, session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-dismissed-notice-${session.user.id}` : "moni-dismissed-notice-guest";
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) setDismissedNotificationIds(parsed.slice(0, 100));
      }
    } catch {
      // ignore
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-dismissed-notice-${session.user.id}` : "moni-dismissed-notice-guest";
    window.localStorage.setItem(key, JSON.stringify(dismissedNotificationIds.slice(0, 100)));
  }, [dismissedNotificationIds, session]);

  useEffect(() => {
    trackOpsEvent(`open_${activePage}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("about") === "1") {
      setShowLandingPage(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (activePage !== "discovery" || !supabase) return;
    void loadIdeaChieBoard();
  }, [activePage, supabase, loadIdeaChieBoard]);

  useEffect(() => {
    if (!supabase || !ideaChieDetailId) {
      setIdeaChieAnswers([]);
      return;
    }
    void loadIdeaChieAnswers(ideaChieDetailId);
  }, [supabase, ideaChieDetailId, loadIdeaChieAnswers]);

  useEffect(() => {
    if (!supabase || !session) return;
    if (activePage !== "chat" || chatSubView !== "room") return;
    if (unreadCount <= 0) return;

    // トーク画面を開いているときだけ、LINE 同様しばらくしたら自動既読
    if (autoReadTimerRef.current) window.clearTimeout(autoReadTimerRef.current);
    autoReadTimerRef.current = window.setTimeout(() => {
      void markChatAsRead();
    }, 600);

    return () => {
      if (autoReadTimerRef.current) window.clearTimeout(autoReadTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount, session, activePage, chatSubView]);

  useEffect(() => {
    if (typeof window === "undefined" || !supabase || !supabaseEnabled) return;
    const params = new URLSearchParams(window.location.search);
    const oauthErr = params.get("error_description") ?? params.get("error");
    if (oauthErr) {
      setAuthMessage(`ログインエラー: ${decodeURIComponent(oauthErr.replace(/\+/g, " "))}`);
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      const next = data.session ?? null;
      sessionRef.current = next;
      setSession(next);
      setSessionEmail(next?.user.email ?? null);
      if (next) {
        await loadRoleRef.current(next.user.id);
        await loadArticlesRef.current();
        await loadPitchesRef.current();
        await refreshTalkListRef.current?.();
        await loadSocialGraphRef.current(next.user.id);
      } else {
        setFollowSuggestions(DEMO_FOLLOW_USERS);
      }
      await loadPostsRef.current();
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const next = nextSession ?? null;
      sessionRef.current = next;
      setSession(next);
      setSessionEmail(next?.user.email ?? null);
      if (next) {
        void Promise.all([
          loadRoleRef.current(next.user.id),
          loadArticlesRef.current(),
          loadPitchesRef.current(),
          refreshTalkListRef.current?.() ?? Promise.resolve(),
          loadPostsRef.current(),
          loadSocialGraphRef.current(next.user.id),
        ]);
      } else {
        setMessages([]);
        setDmPeers([]);
        setGroupRooms([]);
        setTalkMeta({});
        setActiveRoomId("global");
        setFollowingIds([]);
        setFollowerCount(0);
        setFollowingCount(0);
        setAccountPostCount(0);
        setFollowSuggestions(DEMO_FOLLOW_USERS);
        void loadPostsRef.current();
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
    // 依存は空で1回だけ。supabase / supabaseEnabled はモジュール定数。配列長を変えない（React 19 / Fast Refresh 対策）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 認証リスナーはマウント時のみ
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    void loadMessages();
    void loadReadState(session.user.id, activeRoomId);
  }, [supabase, session, activeRoomId, loadMessages, loadReadState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-profile-type-${session.user.id}` : "moni-profile-type-guest";
    const saved = window.localStorage.getItem(key) as AiMatchType | null;
    if (saved === "engineer" || saved === "marketer" || saved === "idea") {
      setProfileType(saved);
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-profile-type-${session.user.id}` : "moni-profile-type-guest";
    window.localStorage.setItem(key, profileType);
  }, [profileType, session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-profile-avatar-${session.user.id}` : "moni-profile-avatar-guest";
    const saved = window.localStorage.getItem(key);
    setProfileAvatarUrl(saved || null);
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-profile-avatar-${session.user.id}` : "moni-profile-avatar-guest";
    if (profileAvatarUrl) {
      window.localStorage.setItem(key, profileAvatarUrl);
    } else {
      window.localStorage.removeItem(key);
    }
  }, [profileAvatarUrl, session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-contact-permission-${session.user.id}` : "moni-contact-permission-guest";
    const saved = window.localStorage.getItem(key);
    if (saved === "all" || saved === "followers" || saved === "message_only" || saved === "none") {
      setContactPermission(saved);
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-contact-permission-${session.user.id}` : "moni-contact-permission-guest";
    window.localStorage.setItem(key, contactPermission);
  }, [contactPermission, session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const legacyKey = session ? `moni-quick-memo-${session.user.id}` : "moni-quick-memo-guest";
    const key = session ? `moni-quick-memo-log-${session.user.id}` : "moni-quick-memo-log-guest";
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ id: string; text: string; createdAt: string }>;
        setQuickMemoEntries(parsed);
      } else {
        setQuickMemoEntries([]);
      }
    } catch {
      setQuickMemoEntries([]);
    }
    const legacy = (window.localStorage.getItem(legacyKey) ?? "").trim();
    if (legacy) {
      setQuickMemoEntries((prev) => {
        if (prev.some((x) => x.text === legacy)) return prev;
        return [{ id: `qm-${Date.now()}`, text: legacy, createdAt: new Date().toISOString() }, ...prev];
      });
      window.localStorage.removeItem(legacyKey);
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-quick-memo-log-${session.user.id}` : "moni-quick-memo-log-guest";
    window.localStorage.setItem(key, JSON.stringify(quickMemoEntries));
  }, [quickMemoEntries, session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const doneKey = session ? `moni-idea-done-${session.user.id}` : "moni-idea-done-guest";
    const memoKey = session ? `moni-idea-memo-${session.user.id}` : "moni-idea-memo-guest";
    const favoriteKey = session ? `moni-favorite-cards-${session.user.id}` : "moni-favorite-cards-guest";
    const testKey = session ? `moni-test-sheet-${session.user.id}` : "moni-test-sheet-guest";
    const problemKey = session ? `moni-problem-posts-${session.user.id}` : "moni-problem-posts-guest";
    try {
      const rawDone = window.localStorage.getItem(doneKey);
      const rawMemo = window.localStorage.getItem(memoKey);
      const rawFavorite = window.localStorage.getItem(favoriteKey);
      const rawTest = window.localStorage.getItem(testKey);
      const rawProblem = window.localStorage.getItem(problemKey);
      if (rawDone) setIdeaDoneMap(JSON.parse(rawDone) as Record<string, boolean>);
      if (rawMemo) setIdeaMemoMap(JSON.parse(rawMemo) as Record<string, string>);
      if (rawFavorite) setFavoriteCards(JSON.parse(rawFavorite) as string[]);
      if (rawTest) {
        const parsed = JSON.parse(rawTest) as {
          question?: string;
          options?: string[];
          votes?: Record<number, number>;
          thread?: TestSheetThreadPost[];
        };
        if (parsed.question) setTestSheetQuestion(parsed.question);
        if (parsed.options && parsed.options.length >= 2) setTestSheetOptions(parsed.options);
        if (parsed.votes) setTestSheetVotes(parsed.votes);
        if (parsed.thread) setTestSheetThread(parsed.thread);
      }
      if (rawProblem) {
        setProblemPosts(JSON.parse(rawProblem) as ProblemPost[]);
      }
    } catch {
      // no-op
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const doneKey = session ? `moni-idea-done-${session.user.id}` : "moni-idea-done-guest";
    const memoKey = session ? `moni-idea-memo-${session.user.id}` : "moni-idea-memo-guest";
    const favoriteKey = session ? `moni-favorite-cards-${session.user.id}` : "moni-favorite-cards-guest";
    const testKey = session ? `moni-test-sheet-${session.user.id}` : "moni-test-sheet-guest";
    const problemKey = session ? `moni-problem-posts-${session.user.id}` : "moni-problem-posts-guest";
    window.localStorage.setItem(doneKey, JSON.stringify(ideaDoneMap));
    window.localStorage.setItem(memoKey, JSON.stringify(ideaMemoMap));
    window.localStorage.setItem(favoriteKey, JSON.stringify(favoriteCards));
    window.localStorage.setItem(
      testKey,
      JSON.stringify({ question: testSheetQuestion, options: testSheetOptions, votes: testSheetVotes, thread: testSheetThread }),
    );
    window.localStorage.setItem(problemKey, JSON.stringify(problemPosts));
  }, [favoriteCards, ideaDoneMap, ideaMemoMap, problemPosts, session, testSheetOptions, testSheetPostDraft, testSheetQuestion, testSheetThread, testSheetVotes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-discovery-tools-${session.user.id}` : "moni-discovery-tools-guest";
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        strengthEntries?: Array<{ id: string; praise: string; requested: string; easy: string }>;
        problemHunterEntries?: Array<{ id: string; area: string; memo: string; stamp: string }>;
        whyQuestions?: Array<{ id: string; text: string }>;
        weeklyMissionDone?: Record<string, boolean>;
        ideaSquarePosts?: IdeaSquarePost[];
        flashMemos?: Array<{ id: string; mode: string; text: string }>;
        interviewLogs?: Array<{ id: string; who: string; need: string }>;
        townChecks?: Array<{ id: string; place: string; popularReason: string; problem: string }>;
        ideaBlueprint?: Partial<IdeaBlueprint>;
      };
      if (data.strengthEntries) setStrengthEntries(data.strengthEntries);
      if (data.problemHunterEntries) setProblemHunterEntries(data.problemHunterEntries);
      if (data.whyQuestions) setWhyQuestions(data.whyQuestions);
      if (data.weeklyMissionDone) setWeeklyMissionDone(data.weeklyMissionDone);
      if (data.ideaSquarePosts) setIdeaSquarePosts(data.ideaSquarePosts);
      if (data.flashMemos) setFlashMemos(data.flashMemos);
      if (data.interviewLogs) setInterviewLogs(data.interviewLogs);
      if (data.townChecks) setTownChecks(data.townChecks);
      if (data.ideaBlueprint) setIdeaBlueprint({ ...IDEA_BLUEPRINT_INITIAL, ...data.ideaBlueprint });
    } catch {
      // no-op
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = session ? `moni-discovery-tools-${session.user.id}` : "moni-discovery-tools-guest";
    window.localStorage.setItem(
      key,
      JSON.stringify({
        strengthEntries,
        problemHunterEntries,
        whyQuestions,
        weeklyMissionDone,
        ideaSquarePosts,
        flashMemos,
        interviewLogs,
        townChecks,
        ideaBlueprint,
      }),
    );
  }, [flashMemos, ideaBlueprint, ideaSquarePosts, interviewLogs, problemHunterEntries, session, strengthEntries, townChecks, weeklyMissionDone, whyQuestions]);

  useEffect(() => {
    if (session) setHasEnteredApp(true);
  }, [session]);

  useEffect(() => {
    setOnboardingCompleted(true);
  }, [session]);

  useEffect(() => {
    if (!canUseSupabase || !supabase || !session) return;
    const client = supabase;
    const presenceName = displayName.trim() || session.user.email || "user";
    const channel = client
      .channel("chat-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          void loadMessagesRef.current();
          void refreshTalkListRef.current?.();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_dm_rooms" },
        () => {
          void refreshTalkListRef.current?.();
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as PresenceState;
        const names = Object.values(state)
          .flat()
          .map((item) => item.name || "user");
        const unique = Array.from(new Set(names));
        setOnlineUsers(unique);
      })
      .subscribe();

    void channel.track({ name: presenceName });

    return () => {
      void client.removeChannel(channel);
    };
  }, [canUseSupabase, displayName, session, supabase]);

  useEffect(() => {
    if (!canUseSupabase || !supabase) return;
    const client = supabase;
    const channel = client
      .channel("feed-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          void loadPostsRef.current();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => {
          void loadPostsRef.current();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        () => {
          void loadPostsRef.current();
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [canUseSupabase, supabase]);

  useEffect(() => {
    return () => {
      if (postUploadPreview) URL.revokeObjectURL(postUploadPreview);
    };
  }, [postUploadPreview]);

  function authRedirectUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/auth/callback`;
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setLoading(true);
    const redirectTo = authRedirectUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) setAuthMessage(error.message);
    setLoading(false);
  }

  async function signInWithEmail(event?: FormEvent) {
    event?.preventDefault();
    if (!supabase) return;
    setLoading(true);
    const emailRedirectTo = authRedirectUrl();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
    setAuthMessage(error ? error.message : "ログインリンクをメール送信しました。");
    setLoading(false);
  }

  async function signUpWithEmailPassword(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setAuthMessage("メールアドレスを入力してください。");
      return;
    }
    if (authPassword.length < 8) {
      setAuthMessage("パスワードは8文字以上で入力してください。");
      return;
    }
    if (authPassword !== authPasswordConfirm) {
      setAuthMessage("確認用パスワードが一致しません。");
      return;
    }
    setLoading(true);
    const redirectTo = authRedirectUrl();
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: authPassword,
      options: {
        ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
        data: { display_name: displayName.trim() || normalizedEmail.split("@")[0] || "user" },
      },
    });
    if (error) {
      setAuthMessage(error.message);
    } else {
      setAuthMessage("サインアップしました。確認メールを開いて認証を完了してください。");
      setAuthPassword("");
      setAuthPasswordConfirm("");
    }
    setLoading(false);
  }

  async function signInWithEmailPassword() {
    if (!supabase) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !authPassword) {
      setAuthMessage("メールアドレスとパスワードを入力してください。");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: authPassword,
    });
    setAuthMessage(error ? error.message : "ログインしました。");
    setLoading(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setSessionEmail(null);
  }

  useEffect(() => {
    mentorScrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mentorMessages, mentorLoading]);

  useEffect(() => {
    if (activePage !== "chat" || chatSubView !== "room") return;
    chatScrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activePage, chatSubView]);

  async function sendMentorMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = mentorInput.trim();
    if (!text || mentorLoading) return;

    const userMsg: MentorChatMessage = {
      id: `u-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      role: "user",
      content: text,
    };
    const history = [...mentorMessages, userMsg];
    setMentorInput("");
    setMentorMessages(history);
    setMentorLoading(true);
    setMentorError("");

    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const result = (await response.json()) as { reply?: string; error?: string };
      const assistantReply = result.reply;
      if (!response.ok || assistantReply == null || assistantReply === "") {
        setMentorError(result.error ?? "AIメンターの生成に失敗しました。");
        return;
      }
      setMentorMessages((prev) => [
        ...prev,
        {
          id: `a-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
          role: "assistant",
          content: assistantReply,
        },
      ]);
    } catch {
      setMentorError("AIメンターに接続できませんでした。");
    } finally {
      setMentorLoading(false);
    }
  }

  function clearMentorChat() {
    setMentorMessages([createMentorWelcomeMessage()]);
    setMentorError("");
  }

  async function runMatching(event: FormEvent) {
    event.preventDefault();
    const terms = matchingKeywords(matchGoal).map(sanitizeLikeTerm).filter(Boolean);
    if (terms.length === 0 && !selectedAiType) {
      setMatchNotice("条件を入力するか、AIタイプを選んで検索してください。");
      return;
    }

    if (supabase && session) {
      const baseQuery = supabase.from("profiles").select("id,display_name,goal,role").neq("id", session.user.id).limit(30);
      const withTermsQuery =
        terms.length > 0
          ? baseQuery.or(
              terms
                .flatMap((term) => [`goal.ilike.%${term}%`, `display_name.ilike.%${term}%`])
                .join(","),
            )
          : baseQuery;
      const { data, error } = await withTermsQuery;
      if (error) {
        setMatchNotice("");
        setAuthMessage(`マッチング検索に失敗: ${error.message}`);
        return;
      }
      const mapped: MatchMember[] = (data ?? []).map((row) => ({
        id: row.id as string,
        name: (row.display_name as string | null) || "ユーザー",
        goal: (row.goal as string | null) || "目標未設定",
        strength: row.role === "investor" ? "投資/事業経験" : row.role === "parent" ? "保護者視点" : "子ども起業家",
        aiType:
          row.role === "investor" ? "marketer" : row.role === "parent" ? "idea" : inferAiTypeFromMember({
            goal: (row.goal as string | null) || "",
            strength: row.role === "investor" ? "投資/事業経験" : row.role === "parent" ? "保護者視点" : "子ども起業家",
          }),
      }));
      const typed = selectedAiType ? mapped.filter((m) => m.aiType === selectedAiType) : mapped;
      const merged = typed.length > 0 ? typed : DEMO_MEMBERS;
      setMatches(merged);
      trackOpsEvent("matching_search");
      setMatchNotice(
        typed.length === 0
          ? "一致ユーザーが少ないため、デモユーザーも表示しています。"
          : `${typed.length}件見つかりました。`,
      );
      return;
    }

    const ranked = [...DEMO_MEMBERS]
      .map((m) => {
        const haystack = `${m.name}${m.goal}${m.strength}`;
        const termScore = terms.reduce((acc, word) => (haystack.includes(word) ? acc + 1 : acc), 0);
        const typeScore = !selectedAiType || (m.aiType ?? inferAiTypeFromMember(m)) === selectedAiType ? 1 : 0;
        const score = termScore + typeScore;
        return { m, score };
      })
      .filter(({ m, score }) => {
        if (selectedAiType && (m.aiType ?? inferAiTypeFromMember(m)) !== selectedAiType) return false;
        if (terms.length === 0) return true;
        return score > 1;
      })
      .sort((a, b) => b.score - a.score)
      .map(({ m }) => m);
    setMatches(ranked);
    trackOpsEvent("matching_search_demo");
    setMatchNotice(
      ranked.length === 0
        ? "デモ一覧に一致する仲間はいません。「教育」「環境」「学校」など短い言葉で試してください。"
        : `${ranked.length}件ヒット（デモデータ内検索）`,
    );
  }

  async function shareInviteLink() {
    if (typeof window === "undefined") return;
    const base = window.location.origin;
    const inviteUrl = session ? `${base}?invite=${session.user.id}` : base;
    const title = "moni";
    const text = "moniで一緒にアイデアづくりしよう。";
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: inviteUrl });
        setAuthMessage("招待リンクを共有しました。");
        return;
      }
      await navigator.clipboard.writeText(inviteUrl);
      setAuthMessage("招待リンクをコピーしました。");
    } catch {
      setAuthMessage("招待リンクの共有に失敗しました。");
    }
  }

  function shareInviteOnLine() {
    if (typeof window === "undefined") return;
    const base = window.location.origin;
    const inviteUrl = session ? `${base}?invite=${session.user.id}` : base;
    const text = `moniで一緒にアイデアづくりしよう！\n${inviteUrl}`;
    const encoded = encodeURIComponent(text);
    const lineAppUrl = `line://msg/text/${encoded}`;
    const lineWebUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(inviteUrl)}`;

    // LINEアプリを優先して開き、失敗時はWeb共有へフォールバックする。
    const fallbackTimer = window.setTimeout(() => {
      window.open(lineWebUrl, "_blank", "noopener,noreferrer");
    }, 700);
    window.location.href = lineAppUrl;
    window.setTimeout(() => window.clearTimeout(fallbackTimer), 1200);
    setAuthMessage("LINE共有を開きました。開かない場合はWeb共有ページへ移動します。");
  }

  function runAiTypeDiagnosis(event: FormEvent) {
    event.preventDefault();
    const detected = detectAiMatchType(aiTypeInput);
    setSelectedAiType(detected);
    setMatchNotice(`AIタイプ診断: ${AI_MATCH_TYPE_META[detected].label}。このタイプで絞り込みできます。`);
  }

  async function publishArticle(id: string, status: "draft" | "published") {
    if (!supabase || !session) return;
    const target = articles.find((a) => a.id === id);
    if (!target) return;
    const isOwner = Boolean(target.authorId && target.authorId === session.user.id);
    if (role !== "investor" && !isOwner) {
      setAuthMessage("この記事の公開状態を変更する権限がありません。");
      return;
    }
    const next = status === "published" ? "draft" : "published";
    const { error } = await supabase.from("articles").update({ status: next }).eq("id", id);
    if (error) {
      setAuthMessage(`記事公開状態の更新に失敗: ${error.message}`);
      return;
    }
    await loadArticles();
  }

  function runCode() {
    const logs: string[] = [];
    const customConsole = { log: (...args: unknown[]) => logs.push(args.join(" ")) };
    try {
      const fn = new Function("console", code);
      fn(customConsole);
      setCodeOutput(logs.join("\n") || "実行完了（出力なし）");
    } catch (error) {
      setCodeOutput(`エラー: ${(error as Error).message}`);
    }
  }

  function onArticleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (articleImagePreview) URL.revokeObjectURL(articleImagePreview);
    if (!f) {
      setArticleImageFile(null);
      setArticleImagePreview(null);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setAuthMessage("記事画像は5MB以下にしてください。");
      e.target.value = "";
      return;
    }
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(f.type)) {
      setAuthMessage("JPEG / PNG / WebP / GIF の画像を選んでください。");
      e.target.value = "";
      return;
    }
    setArticleImageFile(f);
    setArticleImagePreview(URL.createObjectURL(f));
  }

  async function addArticle(event: FormEvent) {
    event.preventDefault();
    if (!articleTitle.trim() || !articleSummary.trim()) return;
    if (requiresLogin) {
      setAuthMessage("投稿するにはログインしてください。");
      return;
    }
    const newArticle: Article = {
      id: `article-${Date.now()}`,
      title: articleTitle.trim(),
      summary: articleSummary.trim(),
      body: articleBody.trim() || articleSummary.trim(),
      category: articleCategory,
      imageUrl: articleImagePreview,
      authorId: session?.user.id,
      authorName: displayName.trim() || session?.user.email || "あなた",
      createdAt: new Date().toISOString(),
      likeCount: 0,
      likedByMe: false,
      comments: [],
      status: "draft",
    };
    if (supabase && session) {
      setBusy(true);
      try {
        const { error } = await supabase.from("articles").insert({
          title: articleTitle.trim(),
          summary: articleSummary.trim(),
          body: articleBody.trim() || articleSummary.trim(),
          category: articleCategory,
          image_url: articleImagePreview,
          status: "draft",
          author_id: session.user.id,
        });
        if (error) {
          setAuthMessage(`記事投稿に失敗: ${error.message}`);
          return;
        }
        setArticles((prev) => [newArticle, ...prev]);
      } finally {
        setBusy(false);
      }
    } else {
      setArticles((prev) => [newArticle, ...prev]);
    }
    setArticleTitle("");
    setArticleSummary("");
    setArticleBody("");
    setArticleCategory("インタビュー");
    setArticleImageFile(null);
    if (articleImagePreview) URL.revokeObjectURL(articleImagePreview);
    setArticleImagePreview(null);
    setActiveArticleId(newArticle.id);
    trackOpsEvent("article_created");
  }

  function toggleArticleLike(articleId: string) {
    setArticles((prev) =>
      prev.map((a) => {
        if (a.id !== articleId) return a;
        const liked = !(a.likedByMe ?? false);
        const nextLike = Math.max(0, (a.likeCount ?? 0) + (liked ? 1 : -1));
        return { ...a, likedByMe: liked, likeCount: nextLike };
      }),
    );
  }

  function startEditArticle(article: Article) {
    setArticleEditId(article.id);
    setArticleEditTitle(article.title);
    setArticleEditSummary(article.summary);
    setArticleEditBody((article.body ?? article.summary ?? "").trim());
    setArticleEditCategory((article.category ?? "インタビュー").trim() || "インタビュー");
  }

  function cancelEditArticle() {
    setArticleEditId(null);
    setArticleEditTitle("");
    setArticleEditSummary("");
    setArticleEditBody("");
    setArticleEditCategory("インタビュー");
  }

  async function saveArticleEdit(articleId: string) {
    const title = articleEditTitle.trim();
    const summary = articleEditSummary.trim();
    const body = articleEditBody.trim() || summary;
    const category = articleEditCategory.trim() || "インタビュー";
    if (!title || !summary) {
      setAuthMessage("タイトルと概要は必須です。");
      return;
    }
    if (supabase && session) {
      const target = articles.find((a) => a.id === articleId);
      const isOwner = Boolean(target?.authorId && target.authorId === session.user.id);
      if (role !== "investor" && !isOwner) {
        setAuthMessage("この記事を編集する権限がありません。");
        return;
      }
      const { error } = await supabase
        .from("articles")
        .update({ title, summary, body, category })
        .eq("id", articleId);
      if (error) {
        setAuthMessage(`記事の更新に失敗: ${error.message}`);
        return;
      }
    }
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId
          ? { ...a, title, summary, body, category }
          : a,
      ),
    );
    cancelEditArticle();
    setAuthMessage("記事を更新しました。");
  }

  async function deleteArticle(articleId: string) {
    const target = articles.find((a) => a.id === articleId);
    if (!target) return;
    if (supabase && session) {
      const isOwner = Boolean(target.authorId && target.authorId === session.user.id);
      if (role !== "investor" && !isOwner) {
        setAuthMessage("この記事を削除する権限がありません。");
        return;
      }
      const { error } = await supabase.from("articles").delete().eq("id", articleId);
      if (error) {
        setAuthMessage(`記事の削除に失敗: ${error.message}`);
        return;
      }
    }
    setArticles((prev) => prev.filter((a) => a.id !== articleId));
    if (activeArticleId === articleId) setActiveArticleId(null);
    if (articleEditId === articleId) cancelEditArticle();
    setAuthMessage("記事を削除しました。");
  }

  function addArticleComment(articleId: string) {
    const body = (articleCommentDrafts[articleId] ?? "").trim();
    if (!body) return;
    const authorName = displayName.trim() || "あなた";
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId
          ? {
              ...a,
              comments: [
                ...(a.comments ?? []),
                {
                  id: `article-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  authorName,
                  body,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : a,
      ),
    );
    setArticleCommentDrafts((prev) => ({ ...prev, [articleId]: "" }));
  }

  function toggleFavoriteCard(item: string) {
    setFavoriteCards((prev) => (prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item]));
  }

  function voteTestSheet(optionIndex: number) {
    setTestSheetVotes((prev) => ({ ...prev, [optionIndex]: (prev[optionIndex] ?? 0) + 1 }));
  }

  function postToTestSheetThread() {
    const body = testSheetPostDraft.trim();
    if (!body) return;
    const author = displayName.trim() || "名無しさん";
    setTestSheetThread((prev) => [
      ...prev,
      {
        id: `ts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        author,
        body,
        createdAt: new Date().toISOString(),
      },
    ]);
    setTestSheetPostDraft("");
  }

  function addProblemPost(event: FormEvent) {
    event.preventDefault();
    const body = problemDraft.trim();
    if (!body) return;
    const quality = scoreProblemDraft(body);
    if (body.length < 10 || quality.score <= 1) {
      setAuthMessage("困りごとをもう少し具体化してください（いつ・誰が・何に困るか）。");
      return;
    }
    const normalized = normalizeDiscoveryText(body);
    const duplicated = problemPosts.some((post) => normalizeDiscoveryText(post.body).includes(normalized.slice(0, 10)));
    if (duplicated) {
      setAuthMessage("似た投稿があります。違い（誰・いつ・どこ）を足してから共有してください。");
      return;
    }
    const author = displayName.trim() || "名無しさん";
    const newPost: ProblemPost = {
      id: `problem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      author,
      area: problemArea,
      body,
      createdAt: new Date().toISOString(),
      supportCount: 0,
      supportedByMe: false,
    };
    setProblemPosts((prev) => [newPost, ...prev]);
    setProblemDraft("");
    setAuthMessage("共有しました。次は「アイデア化」か「完成室に反映」で深掘りできます。");
  }

  function toggleProblemSupport(postId: string) {
    setProblemPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextSupported = !p.supportedByMe;
        return {
          ...p,
          supportedByMe: nextSupported,
          supportCount: Math.max(0, p.supportCount + (nextSupported ? 1 : -1)),
        };
      }),
    );
  }

  function generateIdeasFromProblem(post: ProblemPost) {
    const text = post.body;
    const suggestions: string[] = [];

    if (text.includes("忘れ物") || text.includes("準備")) {
      suggestions.push("前日の持ち物をゲーム感覚で確認できるチェックリストアプリ");
      suggestions.push("朝に不足アイテムを通知する家族共有リマインダー");
    }
    if (text.includes("順番") || text.includes("もめ") || text.includes("タブレット")) {
      suggestions.push("利用時間を公平に回せるタイマー＆順番くじ機能");
      suggestions.push("兄弟ごとの利用実績を見える化するダッシュボード");
    }
    if (text.includes("宿題") || text.includes("管理")) {
      suggestions.push("宿題を小タスク化して達成でポイントが貯まる仕組み");
    }
    if (text.includes("困る") || text.includes("不便")) {
      suggestions.push("困りごとをその場で記録し、似た悩みを持つ人と共有する掲示板");
    }

    while (suggestions.length < 3) {
      const base = [
        `${post.area}の困りごとを5秒で記録→自動で優先度を提案するツール`,
        `同じ悩みの人の解決事例を短尺で見られる「ヒントカード」機能`,
        `家族/友だちと一緒に改善を試せる1週間チャレンジ機能`,
      ][suggestions.length];
      suggestions.push(base);
    }

    setProblemIdeasMap((prev) => ({ ...prev, [post.id]: suggestions.slice(0, 3) }));
  }

  function applyProblemToBlueprint(post: ProblemPost) {
    const targetByArea: Record<ProblemPost["area"], string> = {
      学校: "学校生活で同じ困りごとを持つ生徒",
      家: "家庭内で同じ悩みを抱える家族",
      友だち: "友だち関係で困る子ども",
      趣味: "趣味を続けたいが困りごとがある人",
      地域: "地域で同じ課題を感じる人",
    };
    setIdeaBlueprint((prev) => ({
      ...prev,
      problem: post.body,
      target: prev.target.trim() || targetByArea[post.area],
      title: prev.title.trim() || `${post.area}の困りごと改善プロジェクト`,
      hypothesis: prev.hypothesis.trim() || `もし「${post.body.slice(0, 48)}${post.body.length > 48 ? "…" : ""}」を軽くできれば、対象ユーザーの負担感は下がるはず。`,
    }));
    setDiscoverySubTab("blueprint");
    setAuthMessage("困りごとを完成室に反映しました。解決方法と指標を埋めて仕上げましょう。");
  }

  function addStrengthEntry() {
    if (!strengthDraft.praise.trim() && !strengthDraft.requested.trim() && !strengthDraft.easy.trim()) return;
    setStrengthEntries((prev) => [
      { id: `strength-${Date.now()}`, praise: strengthDraft.praise, requested: strengthDraft.requested, easy: strengthDraft.easy },
      ...prev,
    ]);
    setStrengthDraft({ praise: "", requested: "", easy: "" });
  }

  function addProblemHunterEntry() {
    if (!problemHunterDraft.memo.trim()) return;
    const normalizedArea: ProblemPost["area"] =
      problemHunterDraft.area === "学校" || problemHunterDraft.area === "家" || problemHunterDraft.area === "友だち" || problemHunterDraft.area === "趣味" || problemHunterDraft.area === "地域"
        ? problemHunterDraft.area
        : "地域";
    setProblemHunterEntries((prev) => [
      { id: `hunter-${Date.now()}`, area: problemHunterDraft.area, memo: problemHunterDraft.memo, stamp: problemHunterDraft.stamp },
      ...prev,
    ]);
    setProblemPosts((prev) => [
      {
        id: `problem-hunter-${Date.now()}`,
        author: displayName.trim() || "あなた",
        area: normalizedArea,
        body: `${problemHunterDraft.stamp} ${problemHunterDraft.memo.trim()}`,
        createdAt: new Date().toISOString(),
        supportCount: 0,
        supportedByMe: false,
      },
      ...prev,
    ]);
    setProblemHunterDraft((prev) => ({ ...prev, memo: "" }));
  }

  function addWhyQuestion() {
    if (!whyDraft.trim()) return;
    const question = whyDraft.trim();
    setWhyQuestions((prev) => [{ id: `why-${Date.now()}`, text: question }, ...prev]);
    setProblemPosts((prev) => [
      {
        id: `problem-why-${Date.now()}`,
        author: displayName.trim() || "あなた",
        area: problemArea,
        body: `【なんで？】${question}`,
        createdAt: new Date().toISOString(),
        supportCount: 0,
        supportedByMe: false,
      },
      ...prev,
    ]);
    setWhyDraft("");
  }

  function addIdeaSquarePost() {
    if (!ideaSquareDraft.trim()) return;
    setIdeaSquarePosts((prev) => [
      {
        id: `square-${Date.now()}`,
        author: displayName.trim() || "名無しさん",
        text: ideaSquareDraft.trim(),
        likes: 0,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setIdeaSquareDraft("");
  }

  function addFlashMemo() {
    if (!flashDraft.trim()) return;
    setFlashMemos((prev) => [{ id: `flash-${Date.now()}`, mode: flashMode, text: flashDraft.trim() }, ...prev]);
    setFlashDraft("");
  }

  function addInterviewLog() {
    if (!interviewDraft.who.trim() || !interviewDraft.need.trim()) return;
    setInterviewLogs((prev) => [{ id: `int-${Date.now()}`, who: interviewDraft.who.trim(), need: interviewDraft.need.trim() }, ...prev]);
    setInterviewDraft({ who: "", need: "" });
  }

  function addTownCheck() {
    if (!townDraft.place.trim() || !townDraft.problem.trim()) return;
    setTownChecks((prev) => [{ id: `town-${Date.now()}`, place: townDraft.place.trim(), popularReason: townDraft.popularReason.trim(), problem: townDraft.problem.trim() }, ...prev]);
    setTownDraft({ place: "", popularReason: "", problem: "" });
  }

  function addQuickMemoEntry() {
    if (!quickMemoDraft.trim()) return;
    setQuickMemoEntries((prev) => [
      { id: `memo-${Date.now()}`, text: quickMemoDraft.trim(), createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setQuickMemoDraft("");
  }

  function deleteQuickMemoEntry(id: string) {
    setQuickMemoEntries((prev) => prev.filter((item) => item.id !== id));
  }

  function toggleDiscoverySelection(value: string, current: string[], setter: (next: string[]) => void, max = 3) {
    if (current.includes(value)) {
      setter(current.filter((v) => v !== value));
      return;
    }
    if (current.length >= max) {
      setAuthMessage(`選択は最大${max}件までです。`);
      return;
    }
    setter([...current, value]);
  }

  function runDiscoveryIdeaGeneration() {
    if (discoveryInterests.length === 0 || discoveryStrengths.length === 0 || (discoveryProblems.length === 0 && !discoveryProblemText.trim())) {
      setAuthMessage("興味・得意・課題を1つずつ選ぶと候補を生成できます。");
      return;
    }
    const candidates = createDiscoveryCandidates({
      interests: discoveryInterests,
      strengths: discoveryStrengths,
      problems: discoveryProblems,
      target: discoveryTarget,
      problemText: discoveryProblemText,
    });
    setDiscoveryCandidates(candidates);
    setDiscoveryComparisonIds(candidates.slice(0, 3).map((c) => c.id));
    setDiscoveryFinalIdeaId(null);
    setDiscoverySubTab("blueprint");
    setAuthMessage("アイデア候補を作成しました。比較シートで絞り込めます。");
  }

  function toggleCandidateForComparison(candidateId: string) {
    setDiscoveryComparisonIds((prev) => {
      if (prev.includes(candidateId)) return prev.filter((id) => id !== candidateId);
      if (prev.length >= 5) return prev;
      return [...prev, candidateId];
    });
  }

  function updateDiscoveryScore(candidateId: string, key: string, value: number) {
    setDiscoveryScores((prev) => ({
      ...prev,
      [candidateId]: { ...(prev[candidateId] ?? {}), [key]: value },
    }));
  }

  function discoveryTotalScore(candidateId: string) {
    const row = discoveryScores[candidateId] ?? {};
    return ["interest", "feasibility", "impact", "sustain", "team"]
      .map((k) => row[k] ?? 0)
      .reduce((acc, n) => acc + n, 0);
  }

  function finishOnboarding() {
    if (!selectedAiType) {
      setAuthMessage("まずAIタイプ診断を完了してください。");
      return;
    }
    if (!discoveryFinalIdeaId) {
      setAuthMessage("比較シートで最終アイデアを1つ決めてください。");
      return;
    }
    const chosen = discoveryCandidates.find((c) => c.id === discoveryFinalIdeaId);
    if (chosen) {
      setIdeaBlueprint((prev) => ({
        ...prev,
        title: chosen.title,
        target: chosen.target,
        problem: chosen.summary,
        solution: prev.solution || chosen.firstStep,
      }));
    }
    if (session && typeof window !== "undefined") {
      window.localStorage.setItem(`moni-onboarding-complete-${session.user.id}`, "1");
    }
    setOnboardingCompleted(true);
    setActivePage("discovery");
    setAuthMessage("オンボーディング完了。ここからはアイデア磨きに進めます。");
  }

  function generateIdeaBlueprint() {
    const weightedProblems: Array<{ text: string; weight: number }> = [
      comboProblem.trim() ? { text: comboProblem.trim(), weight: 5 } : null,
      ...problemHunterEntries.slice(0, 3).map((x, i) => ({ text: x.memo.trim(), weight: 4 - i })),
      ...problemPosts.slice(0, 3).map((x, i) => ({ text: x.body.trim(), weight: 3 - i })),
      ...townChecks.slice(0, 2).map((x, i) => ({ text: x.problem.trim(), weight: 2 - i })),
      ...interviewLogs.slice(0, 2).map((x, i) => ({ text: x.need.trim(), weight: 2 - i })),
    ].filter((x): x is { text: string; weight: number } => Boolean(x?.text));
    const bestProblem =
      [...weightedProblems].sort((a, b) => (b.weight - a.weight) || (b.text.length - a.text.length))[0]?.text ??
      "日常で起きる小さな困りごと";
    const areaSeed = problemHunterEntries[0]?.area || problemPosts[0]?.area || "身近";
    const target =
      interviewLogs[0]?.who?.trim() ||
      (areaSeed ? `${areaSeed}で困っている人` : "") ||
      "身近な子ども・家族";
    const quickHook = flashMemos[0]?.text?.trim().slice(0, 100) ?? "";
    const likeSeed =
      comboLike.trim() ||
      quickHook.slice(0, 24) ||
      flashMemos[0]?.text?.slice(0, 16) ||
      "身近なテーマ";
    const helper = comboBuddy.trim() || interviewLogs[0]?.who?.trim() || "仲間";
    const strengthSeed = flashMemos[0]?.mode ? `${flashMemos[0].mode}で記録しながら改善` : "続けやすい工夫";
    const topType = profileType;
    const typeFlavor =
      topType === "engineer"
        ? "仕組み化して自動で回る"
        : topType === "marketer"
          ? "使う人の声を取り込みながら改善する"
          : "わくわく体験として広げる";
    const solution = `${likeSeed}を使って、${target}の「${bestProblem}」を${patternType}で解決する。${typeFlavor}形で設計する。`;
    const value = `${target}が「時間・手間・不安」を減らせる。${strengthSeed}を活かし、${helper}と一緒に継続しやすい。`;
    const title = `${likeSeed} ${patternType}プロジェクト`;
    const firstStep = `1週目: ${target}へ3人ヒアリング→2日で試作→3日で再テスト（課題: ${bestProblem.slice(0, 24)}）`;
    const problem = bestProblem;
    const probShort = bestProblem.length > 52 ? `${bestProblem.slice(0, 52)}…` : bestProblem;
    const elevatorPitch = `「${title}」は、${target}向けに「${probShort}」を${patternType}で軽くする取り組みです。`;
    const hypothesis = `もし「${solution.slice(0, 72)}${solution.length > 72 ? "…" : ""}」が成立すれば、${target}は週に複数回その恩恵を実感し、負担感が下がるはずです。`;
    const whyLine = whyQuestions[0]?.text?.trim();
    const clusterTitle = problemClusters[0]?.title ?? "";
    const risks = [
      "想定ユーザーが実際には行動を変えない",
      "既存の習慣・無料ツールで代替される",
      quickHook ? `メモのきっかけ「${quickHook.slice(0, 36)}…」が本質課題とずれている` : "課題の優先度が想定と違う",
      whyLine ? `疑問「${whyLine.slice(0, 40)}…」の答えが想定と逆` : "検証サンプルが偏る",
    ].join("\n");
    const metric = `初週: ${target}から有効な反応3件 / 試用（紙・画面どちらでも）2回 / 再訪意向のメモ1件`;
    const mentorSeed =
      `次のアイデアを一緒に磨きたいです。\n\n` +
      `【ワンメッセージ】${elevatorPitch}\n` +
      `【課題】${problem}\n` +
      `【案】${solution}\n` +
      `【価値】${value}\n` +
      `【仮説】${hypothesis}\n` +
      `【リスク】\n${risks}\n\n` +
      `上記を踏まえて、(1) 仮説を1行で言い換えて (2) 次の検証で聞く質問を3つ (3) 最小の試作案 を提案してください。`;
    const alternatives = [
      `${patternType}ではなく「教える」に寄せた版`,
      `${target}ではなく周囲の大人・先生向けにした版`,
      clusterTitle ? `クラスタ「${clusterTitle}」に特化したミニ版` : "紙とペンだけで試せる超ミニ版",
      "ひらめきメモの内容だけを核にした別コンセプト",
    ].join("\n");
    setIdeaBlueprint({
      title,
      target,
      problem,
      solution,
      value,
      firstStep,
      elevatorPitch,
      hypothesis,
      risks,
      metric,
      mentorSeed,
      alternatives,
    });
  }

  function improveIdeaBlueprintDraft() {
    const topProblem = problemPosts[0]?.body?.trim() || problemHunterEntries[0]?.memo?.trim() || "日常で起きる小さな困りごと";
    const topTarget = interviewLogs[0]?.who?.trim() || "同じ困りごとを持つユーザー";
    setIdeaBlueprint((prev) => ({
      ...prev,
      problem: prev.problem.trim() || topProblem,
      target: prev.target.trim() || topTarget,
      solution: prev.solution.trim() || `${topProblem.slice(0, 26)}${topProblem.length > 26 ? "…" : ""}を軽くするためのシンプルな仕組みを作る。`,
      value: prev.value.trim() || `${topTarget}の時間と手間を減らし、続けやすくする。`,
      hypothesis: prev.hypothesis.trim() || `もし解決策を1週間試せば、${topTarget}の困りごとの頻度が下がる。`,
      metric: prev.metric.trim() || "初週でヒアリング3件・試用2回・継続意向1件以上",
    }));
    setAuthMessage("不足しがちな項目を自動補強しました。必要なら手動で言い回しを調整してください。");
  }

  function generateIdeaSprintPlan() {
    const target = ideaBlueprint.target.trim() || "最初のユーザー";
    const problem = ideaBlueprint.problem.trim() || "困りごと";
    const hypothesis = ideaBlueprint.hypothesis.trim() || "この解決策は役立つ";
    const plan: IdeaSprintTask[] = [
      { id: "d1", day: "Day1", task: `課題を1行で確定: ${problem}`, outcome: "課題定義がブレない状態" },
      { id: "d2", day: "Day2", task: `${target}へ3件ヒアリング質問を作成`, outcome: "検証質問3つ" },
      { id: "d3", day: "Day3", task: "紙/ノーコードで最小プロトを作る", outcome: "触れる試作品1つ" },
      { id: "d4", day: "Day4", task: `${target}に試してもらい反応を記録`, outcome: "反応メモ3件" },
      { id: "d5", day: "Day5", task: `仮説検証: ${hypothesis}`, outcome: "当たり/外れの判定" },
      { id: "d6", day: "Day6", task: "改善版を1回だけ作り直す", outcome: "改善点トップ3反映" },
      { id: "d7", day: "Day7", task: "公開or次週継続の判断をする", outcome: "Go/No-Goを決定" },
    ];
    setIdeaSprintPlan(plan);
    setAuthMessage("7日スプリント計画を生成しました。");
    trackOpsEvent("idea_sprint_generated");
  }

  function applyComboToBlueprintDraft() {
    const like = comboLike.trim();
    const prob = comboProblem.trim();
    const buddy = comboBuddy.trim();
    if (!like && !prob && !buddy) {
      setAuthMessage("先に好き・困りごと・仲間のどれかを入力してください。");
      return;
    }
    setIdeaBlueprint((prev) => ({
      ...prev,
      title: like ? `${like} × ${buddy || "仲間"}` : prev.title,
      problem: prob || prev.problem,
      target: buddy ? `${buddy}と周りの人` : prev.target,
      solution:
        like && prob
          ? `${like}を使って「${prob}」を${patternType}で解決する（${buddy || "仲間"}と）。`
          : prev.solution,
    }));
    setAuthMessage("完成室の下書きに反映しました。「自動生成」で全体を再計算できます。");
  }

  function buildPatternOneLinerLine(): string {
    let core = ideaBlueprint.problem.trim();
    if (!core && comboLike.trim() && comboProblem.trim()) {
      core = `${comboLike}で「${comboProblem}」`;
    }
    if (!core) core = problemPosts[0]?.body?.trim() ?? "";
    if (!core) core = problemHunterEntries[0]?.memo?.trim() ?? "";
    if (!core) core = flashMemos[0]?.text?.trim() ?? "";
    if (!core) core = whyQuestions[0]?.text?.trim() ?? "";
    if (!core) core = "（困りごとをボード・メモ・組み合わせから1つ決める）";
    const short = core.length > 56 ? `${core.slice(0, 56)}…` : core;
    return `誰かの「${short}」を、${patternType}で軽くする。`;
  }

  function refreshPatternOneLiner() {
    setPatternOneLiner(buildPatternOneLinerLine());
    setAuthMessage("型に沿った一文を生成しました。必要なら「解決方法へ」を押してください。");
  }

  function applyPatternOneLinerToSolution() {
    const line = buildPatternOneLinerLine();
    setPatternOneLiner(line);
    setIdeaBlueprint((p) => ({ ...p, solution: line }));
    setAuthMessage("完成室の「解決方法」に一文を反映しました。");
  }

  async function copyIdeaBlueprintToClipboard() {
    const text = [
      `【アイデア名】${ideaBlueprint.title}`,
      `【30秒ピッチ】${ideaBlueprint.elevatorPitch}`,
      `【ターゲット】${ideaBlueprint.target}`,
      `【課題】${ideaBlueprint.problem}`,
      `【解決策】${ideaBlueprint.solution}`,
      `【価値】${ideaBlueprint.value}`,
      `【仮説】${ideaBlueprint.hypothesis}`,
      `【成功指標】${ideaBlueprint.metric}`,
      `【1週間】${ideaBlueprint.firstStep}`,
      `【リスク】\n${ideaBlueprint.risks}`,
      `【別角度案】\n${ideaBlueprint.alternatives}`,
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setAuthMessage("アイデアシートをコピーしました。");
    } catch {
      setAuthMessage("コピーに失敗しました。ブラウザの権限を確認してください。");
    }
  }

  function sendBlueprintToValidation() {
    const q =
      ideaBlueprint.hypothesis.trim() ||
      (ideaBlueprint.title.trim() ? `「${ideaBlueprint.title}」は本当に求められていますか？` : "このアイデア、使ってもらえそうですか？");
    setTestSheetQuestion(q.slice(0, 140));
    setActivePage("mentor");
    setMentorSubTab("validation");
    setAuthMessage("検証タブに質問文をセットしました。");
  }

  function sendBlueprintToMentor() {
    const body = ideaBlueprint.mentorSeed.trim() || ideaBlueprint.elevatorPitch;
    setMentorInput(body);
    setActivePage("mentor");
    setMentorSubTab("ai");
    setAuthMessage("相談AIに下書きを入れました。送信して深掘りしてください。");
  }

  async function addPitch(event: FormEvent) {
    event.preventDefault();
    if (!pitchTitle || !pitchBody) return;
    if (requiresLogin) {
      setAuthMessage("投稿するにはログインしてください。");
      return;
    }
    if (supabase && session) {
      setBusy(true);
      try {
        const { error } = await supabase.from("pitches").insert({
          title: pitchTitle,
          body: pitchBody,
          likes: 0,
          author_id: session.user.id,
        });
        if (error) {
          setAuthMessage(`ピッチ投稿に失敗: ${error.message}`);
          return;
        }
        await loadPitches();
      } finally {
        setBusy(false);
      }
    } else {
      setPitches((prev) => [{ id: `pitch-${Date.now()}`, title: pitchTitle, body: pitchBody, likes: 0 }, ...prev]);
    }
    setPitchTitle("");
    setPitchBody("");
  }

  function onPostFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (postUploadPreview) URL.revokeObjectURL(postUploadPreview);
    if (!f) {
      setPostFile(null);
      setPostUploadPreview(null);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setAuthMessage("画像は5MB以下にしてください。");
      e.target.value = "";
      return;
    }
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(f.type)) {
      setAuthMessage("JPEG / PNG / WebP / GIF の画像を選んでください。");
      e.target.value = "";
      return;
    }
    setPostFile(f);
    setPostUploadPreview(URL.createObjectURL(f));
  }

  function resetPostComposer() {
    setPostCaption("");
    setPostFile(null);
    if (postUploadPreview) URL.revokeObjectURL(postUploadPreview);
    setPostUploadPreview(null);
    if (postFileInputRef.current) postFileInputRef.current.value = "";
  }

  async function createFeedPost(event: FormEvent) {
    event.preventDefault();
    const caption = postCaption.trim();
    if (!caption && !postFile) {
      setAuthMessage("テキストか画像のどちらかを入力してください。");
      return;
    }

    if (!supabase || !session) {
      setFeedPosts((prev) => [
        {
          id: `local-post-${Date.now()}`,
          authorId: "local",
          authorName: displayName.trim() || "あなた",
          caption,
          imageUrl: postFile ? URL.createObjectURL(postFile) : null,
          createdAt: new Date().toISOString(),
          likeCount: 0,
          likedByMe: false,
          commentCount: 0,
          comments: [],
        },
        ...prev,
      ]);
      resetPostComposer();
      setAuthMessage("（デモ）端末内にだけ投稿を追加しました。Supabase 接続で共有できます。");
      return;
    }

    setPostPosting(true);
    try {
      let path: string | null = null;
      if (postFile) {
        const extFromType = postFile.type === "image/png" ? "png" : postFile.type === "image/webp" ? "webp" : postFile.type === "image/gif" ? "gif" : "jpg";
        path = `${session.user.id}/${Date.now()}.${extFromType}`;
        const { error: upErr } = await supabase.storage.from("post-images").upload(path, postFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: postFile.type || "image/jpeg",
        });
        if (upErr) {
          setAuthMessage(`画像のアップロードに失敗: ${upErr.message}`);
          return;
        }
      }
      const { error: insErr } = await supabase.from("posts").insert({
        author_id: session.user.id,
        caption,
        image_path: path,
      });
      if (insErr) {
        setAuthMessage(`投稿の保存に失敗: ${insErr.message}`);
        if (path) await supabase.storage.from("post-images").remove([path]);
        return;
      }
      resetPostComposer();
      await loadPosts();
      trackOpsEvent("post_created");
    } finally {
      setPostPosting(false);
    }
  }

  async function toggleFeedPostLike(post: FeedPost) {
    if (!supabase || !session) {
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                likedByMe: !p.likedByMe,
                likeCount: p.likedByMe ? Math.max(0, p.likeCount - 1) : p.likeCount + 1,
              }
            : p,
        ),
      );
      return;
    }
    if (post.likedByMe) {
      const { error } = await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", session.user.id);
      if (error) {
        setAuthMessage(`いいねの解除に失敗: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: session.user.id });
      if (error) {
        setAuthMessage(`いいねに失敗: ${error.message}`);
        return;
      }
    }
    await loadPosts();
  }

  async function deleteFeedPost(post: FeedPost) {
    if (post.authorId === "local") {
      setFeedPosts((prev) => prev.filter((p) => p.id !== post.id));
      if (post.imageUrl?.startsWith("blob:")) URL.revokeObjectURL(post.imageUrl);
      return;
    }
    if (!session || session.user.id !== post.authorId) return;
    if (!supabase || !canUseSupabase) {
      setFeedPosts((prev) => prev.filter((p) => p.id !== post.id));
      if (post.imageUrl?.startsWith("blob:")) URL.revokeObjectURL(post.imageUrl);
      return;
    }
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      setAuthMessage(`投稿の削除に失敗: ${error.message}`);
      return;
    }
    if (post.storagePath) {
      await supabase.storage.from("post-images").remove([post.storagePath]);
    }
    await loadPosts();
  }

  async function addFeedComment(post: FeedPost) {
    const body = (commentDrafts[post.id] ?? "").trim();
    if (!body) return;

    const appendLocalComment = () => {
      const newComment: FeedComment = {
        id: `local-comment-${Date.now()}`,
        postId: post.id,
        authorId: session?.user.id ?? "local",
        authorName: displayName.trim() || "あなた",
        body,
        createdAt: new Date().toISOString(),
      };
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, comments: [...p.comments, newComment], commentCount: p.commentCount + 1 }
            : p,
        ),
      );
      setCommentDrafts((prev) => ({ ...prev, [post.id]: "" }));
    };

    if (!supabase || !session) {
      appendLocalComment();
      return;
    }

    const { error } = await supabase.from("post_comments").insert({
      post_id: post.id,
      author_id: session.user.id,
      body,
    });
    if (error) {
      appendLocalComment();
      setAuthMessage(`コメントの保存でエラーが出たため、この端末では反映しました。(${error.message})`);
      return;
    }
    appendLocalComment();
    await loadPosts();
  }

  async function toggleFollow(targetUserId: string) {
    const isFollowing = followingIds.includes(targetUserId);
    setFollowingIds((prev) => (isFollowing ? prev.filter((id) => id !== targetUserId) : [...prev, targetUserId]));
    setFollowingCount((prev) => Math.max(0, prev + (isFollowing ? -1 : 1)));
    setAuthMessage(isFollowing ? "フォローを解除しました。" : "フォローしました。");
  }

  async function cheerPitch(id: string, likes: number) {
    if (requiresLogin) {
      setAuthMessage("応援するにはログインしてください。");
      return;
    }
    if (supabase && session) {
      const { error } = await supabase.from("pitches").update({ likes: likes + 1 }).eq("id", id);
      if (error) {
        setAuthMessage(`応援の更新に失敗: ${error.message}`);
        return;
      }
      await loadPitches();
      return;
    }
    setPitches((prev) => prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)));
  }

  function effectiveChatSenderName(): string {
    const fromProfile = displayName.trim();
    if (fromProfile) return fromProfile;
    const emailLocal = session?.user?.email?.split("@")[0]?.trim();
    if (emailLocal) return emailLocal;
    return "ユーザー";
  }

  async function submitIdeaChieQuestion(event?: FormEvent) {
    event?.preventDefault();
    if (!supabase || !session) {
      setAuthMessage("質問を投稿するにはログインしてください。");
      return;
    }
    const title = ideaChieNewTitle.trim();
    const body = ideaChieNewBody.trim();
    if (!title) {
      setAuthMessage("タイトルを入力してください。");
      return;
    }
    const { error } = await supabase.from("idea_questions").insert({
      author_id: session.user.id,
      author_display_name: effectiveChatSenderName(),
      title,
      body,
    });
    if (error) {
      setAuthMessage(`質問の投稿に失敗: ${error.message}`);
      return;
    }
    setIdeaChieNewTitle("");
    setIdeaChieNewBody("");
    setAuthMessage("質問を投稿しました。");
    trackOpsEvent("idea_chie_question_posted");
    await loadIdeaChieBoard();
  }

  async function submitIdeaChieAnswer(event?: FormEvent) {
    event?.preventDefault();
    if (!supabase || !session || !ideaChieDetailId) return;
    const q = ideaChieQuestions.find((x) => x.id === ideaChieDetailId);
    if (!q) return;
    if (q.authorId === session.user.id) {
      setAuthMessage("自分の質問には回答できません。");
      return;
    }
    const body = ideaChieAnswerDraft.trim();
    if (!body) return;
    const { error } = await supabase.from("idea_answers").insert({
      question_id: ideaChieDetailId,
      author_id: session.user.id,
      author_display_name: effectiveChatSenderName(),
      body,
    });
    if (error) {
      setAuthMessage(`回答の投稿に失敗: ${error.message}`);
      return;
    }
    setIdeaChieAnswerDraft("");
    setAuthMessage("回答を投稿しました。");
    trackOpsEvent("idea_chie_answer_posted");
    await loadIdeaChieAnswers(ideaChieDetailId);
    await loadIdeaChieBoard();
  }

  async function pickIdeaChieBestAnswer(answerId: string) {
    if (!supabase || !session || !ideaChieDetailId) return;
    const q = ideaChieQuestions.find((x) => x.id === ideaChieDetailId);
    if (!q || q.authorId !== session.user.id) {
      setAuthMessage("ベストアンサーは質問した本人だけが選べます。");
      return;
    }
    const belongs = ideaChieAnswers.some((a) => a.id === answerId && a.questionId === ideaChieDetailId);
    if (!belongs) {
      setAuthMessage("この回答は選べません。");
      return;
    }
    const { error } = await supabase
      .from("idea_questions")
      .update({ best_answer_id: answerId })
      .eq("id", ideaChieDetailId)
      .eq("author_id", session.user.id);
    if (error) {
      setAuthMessage(`ベストアンサーの設定に失敗: ${error.message}`);
      return;
    }
    setAuthMessage("ベストアンサーにしました。");
    trackOpsEvent("idea_chie_best_picked");
    await loadIdeaChieBoard();
    await loadIdeaChieAnswers(ideaChieDetailId);
  }

  async function addMessage(event?: FormEvent) {
    event?.preventDefault();
    const bodyText = chatBody.trim();
    if (!bodyText) return;
    if (requiresLogin) {
      setAuthMessage("チャット送信にはログインしてください。");
      return;
    }
    const senderName = effectiveChatSenderName();
    const outgoingBody = bodyText;
    if (supabase && session) {
      const { error } = await supabase.from("chat_messages").insert({
        sender_id: session.user.id,
        sender_name: senderName,
        body: outgoingBody,
        room_id: activeRoomId,
      });
      if (error) {
        setAuthMessage(`チャット送信に失敗: ${error.message}`);
        return;
      }
      await loadMessages();
      void refreshTalkListRef.current?.();
      trackOpsEvent("chat_message_sent");
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `chat-${Date.now()}`,
          sender: senderName,
          senderId: null,
          body: outgoingBody,
          createdAt: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
          createdAtIso: new Date().toISOString(),
        },
      ]);
    }
    setChatBody("");
    setChatAttachmentName("");
    setChatAttachmentPreview(null);
    if (chatAttachmentInputRef.current) chatAttachmentInputRef.current.value = "";
  }

  function startJitsiCall() {
    if (!canUseCallForCurrentRoom()) {
      setAuthMessage("現在のSettingsでは通話は許可されていません。");
      return;
    }
    const safeRoom = activeRoomId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48) || Math.random().toString(36).slice(2, 10);
    const room = `moni-${safeRoom}`;
    const url = `https://meet.jit.si/${room}`;
    setCallRoom(room.toUpperCase());
    setCallUrl(url);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win == null) {
      setAuthMessage("新しいタブがブロックされました。画面内の通話リンクをタップして開いてください。");
    }
  }

  const storySeed = displayName.trim().charAt(0) || sessionEmail?.trim().charAt(0) || "+";
  const storyInitial = storySeed.toUpperCase();

  function openAvatarPicker() {
    avatarInputRef.current?.click();
  }

  function onAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAuthMessage(language === "ja" ? "画像ファイルを選択してください。" : "Please select an image file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setAuthMessage(language === "ja" ? "画像サイズは3MB以下にしてください。" : "Image size must be 3MB or less.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  if (showLandingPage || (!session && !hasEnteredApp)) {
    return (
      <MoniLanding
        resumeMode={Boolean(session)}
        onMount={() => trackOpsEvent("landing_view")}
        onStart={() => {
          trackOpsEvent(session ? "landing_resume_close" : "landing_cta_register");
          setShowLandingPage(false);
          if (!session) {
            setHasEnteredApp(true);
            setActivePage("account");
            setAuthMessage("Googleでログインして、企画を行動に移しましょう。");
          }
        }}
        onPreview={() => {
          trackOpsEvent(session ? "landing_resume_preview" : "landing_cta_preview");
          setShowLandingPage(false);
          if (!session) {
            setHasEnteredApp(true);
            setAuthMessage("");
          }
        }}
      />
    );
  }

  if (session && !onboardingCompleted) {
    return (
      <div className="min-h-screen bg-zinc-100 px-4 py-8">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-bold text-zinc-900">登録ステップ（必須）</h2>
          <p className="mt-1 text-sm text-zinc-600">AIタイプ診断→アイデア発掘→比較決定を完了するとアプリ本編に進めます。</p>

          <form onSubmit={runAiTypeDiagnosis} className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-sm font-semibold text-zinc-900">1. AIタイプ診断</p>
            <div className="mt-2 flex gap-2">
              <input className={`flex-1 ${inputClass}`} placeholder="やりたいこと・得意を入力" value={aiTypeInput} onChange={(e) => setAiTypeInput(e.target.value)} />
              <button className={primaryButtonClass} type="submit">診断</button>
            </div>
            <p className="mt-1 text-xs text-zinc-600">判定: {selectedAiType ? AI_MATCH_TYPE_META[selectedAiType].label : "未完了"}</p>
          </form>

          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-sm font-semibold text-zinc-900">2. アイデア発掘ナビ</p>
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1.5">{DISCOVERY_NAV_INTERESTS.map((item) => <button key={`ob-int-${item}`} type="button" className={discoveryInterests.includes(item) ? primaryButtonClass : secondaryButtonClass} onClick={() => toggleDiscoverySelection(item, discoveryInterests, setDiscoveryInterests)}>{item}</button>)}</div>
              <div className="flex flex-wrap gap-1.5">{DISCOVERY_NAV_STRENGTHS.map((item) => <button key={`ob-str-${item}`} type="button" className={discoveryStrengths.includes(item) ? primaryButtonClass : secondaryButtonClass} onClick={() => toggleDiscoverySelection(item, discoveryStrengths, setDiscoveryStrengths)}>{item}</button>)}</div>
              <div className="flex flex-wrap gap-1.5">{DISCOVERY_NAV_PROBLEMS.map((item) => <button key={`ob-prob-${item}`} type="button" className={discoveryProblems.includes(item) ? primaryButtonClass : secondaryButtonClass} onClick={() => toggleDiscoverySelection(item, discoveryProblems, setDiscoveryProblems, 4)}>{item}</button>)}</div>
              <div className="flex flex-wrap gap-1.5">{DISCOVERY_NAV_TARGETS.map((item) => <button key={`ob-target-${item}`} type="button" className={discoveryTarget === item ? primaryButtonClass : secondaryButtonClass} onClick={() => setDiscoveryTarget(item)}>{item}</button>)}</div>
              <input className={inputClass} placeholder="課題の補足（任意）" value={discoveryProblemText} onChange={(e) => setDiscoveryProblemText(e.target.value)} />
              <button type="button" className={primaryButtonClass} onClick={runDiscoveryIdeaGeneration}>候補を生成</button>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-sm font-semibold text-zinc-900">3. アイデア比較・決定</p>
            <div className="mt-2 space-y-2">
              {discoveryCandidates.length === 0 ? (
                <p className="text-xs text-zinc-600">候補を生成するとここに表示されます。</p>
              ) : (
                discoveryCandidates.map((candidate) => (
                  <div key={`ob-cand-${candidate.id}`} className="rounded-lg border border-zinc-200 bg-white p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-zinc-900">{candidate.title}</p>
                      <button type="button" className={discoveryFinalIdeaId === candidate.id ? secondaryButtonClass : primaryButtonClass} onClick={() => setDiscoveryFinalIdeaId(candidate.id)}>
                        {discoveryFinalIdeaId === candidate.id ? "選択中" : "この案にする"}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-600">{candidate.summary}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={primaryButtonClass} onClick={finishOnboarding}>完了してアプリを開始</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="moni-app" className="relative min-h-[100dvh] min-h-screen bg-zinc-100 pt-[env(safe-area-inset-top,0px)] text-zinc-900 antialiased">
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onAvatarFileChange}
      />
      <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-sky-300/[0.07] blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-1/3 h-72 w-72 rounded-full bg-sky-400/[0.05] blur-3xl" />
      <div className="pointer-events-none absolute bottom-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-zinc-400/[0.05] blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 px-2 py-2 sm:gap-5 sm:px-4 sm:py-4 lg:grid-cols-[260px_1fr] lg:px-6">
        <aside className="hidden border border-zinc-200 bg-white sm:mb-0 sm:block sm:rounded-2xl lg:sticky lg:top-4 lg:h-fit lg:self-start">
          <div className="flex items-center gap-3 border-b border-zinc-100 p-4">
            <button
              type="button"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-500 p-[2.5px]"
              onClick={openAvatarPicker}
              title={language === "ja" ? "プロフィール画像を変更" : "Change profile image"}
              aria-label={language === "ja" ? "プロフィール画像を変更" : "Change profile image"}
            >
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-[2px]">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-zinc-300 text-lg font-bold text-white">
                  {profileAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- user-selected local avatar preview
                    <img src={profileAvatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    storyInitial
                  )}
                </div>
              </div>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName.trim() || "名前未設定"}</p>
              <p className="truncate text-xs text-zinc-500">{sessionEmail ?? "未ログイン"}</p>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">アカウントの種類</p>
            <p className="mt-1 text-sm font-medium">
              {role === "child" ? "子ども" : role === "parent" ? "保護者" : "投資家/起業家"}
            </p>
          </div>
        </aside>

        <div className="space-y-3 sm:space-y-4">
          <header className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5">
            <div className="min-w-0">
              <h1 className="font-sans text-2xl font-bold tracking-tight text-zinc-900">
                moni
              </h1>
              <p className="mt-0.5 text-[11px] font-medium tracking-wide text-zinc-500">
                {language === "ja" ? "For you timeline · 子ども/保護者/起業家" : "For you timeline · kids/parents/builders"}
              </p>
            </div>
            <div className="flex max-w-[60%] shrink-0 items-center gap-2">
              <div className="truncate text-right text-xs text-zinc-500">
                {sessionEmail ? sessionEmail : accountText.loginStatus}
              </div>
            </div>
          </header>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 sm:mx-0 sm:border">
            <p className="text-center text-[12px] font-medium leading-relaxed tracking-tight text-zinc-600">
              {pageTaglines[language][activePage]}
            </p>
            {notificationItems.length > 0 ? (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {notificationItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      item.level === "warn" ? "border border-amber-200 bg-amber-50 text-amber-800" : "border border-sky-200 bg-sky-50 text-sky-700"
                    }`}
                    onClick={() => dismissNotification(item.id)}
                    title="クリックで非表示"
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <main className="grid gap-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:grid-cols-1">
        <section className={`${cardClass} ${activePage === "account" ? "" : "hidden"}`}>
            {accountSubTab === "profile" ? (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{accountText.title}</h2>
                  <p className="mt-1 text-xs text-[#8e8e8e]">{accountText.subtitle}</p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-[#d1d5db] bg-white px-2.5 py-1.5 text-sm transition hover:bg-[#f9fafb]"
                  title="Settings"
                  aria-label="Settings"
                  onClick={() => setAccountSubTab("settings")}
                >
                  ⚙️
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => setAccountSubTab("profile")}
                  >
                    ◀️
                  </button>
                  <h2 className="text-base font-semibold">Settings</h2>
                </div>
                <span />
              </div>
            )}

            <div className={`mt-3 rounded-xl border border-zinc-200 bg-white p-4 ${accountSubTab === "profile" ? "" : "hidden"}`}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 p-[2px]"
                  onClick={openAvatarPicker}
                  title={language === "ja" ? "プロフィール画像を変更" : "Change profile image"}
                  aria-label={language === "ja" ? "プロフィール画像を変更" : "Change profile image"}
                >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-[1px]">
                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-base font-bold text-white">
                      {profileAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- user-selected local avatar preview
                        <img src={profileAvatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        storyInitial
                      )}
                    </div>
                  </div>
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">{displayName.trim() || accountText.unnamed}</p>
                  <p className="truncate text-xs text-zinc-500">{sessionEmail ?? accountText.notLoggedIn}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 py-2">
                  <p className="text-sm font-semibold">{accountPostCount}</p>
                  <p className="text-[11px] text-zinc-500">{accountText.posts}</p>
                </div>
                <button type="button" className="rounded-lg border border-zinc-200 bg-zinc-50 py-2" onClick={() => setFollowListModal("followers")}>
                  <p className="text-sm font-semibold">{followerCount}</p>
                  <p className="text-[11px] text-zinc-500">{accountText.followers}</p>
                </button>
                <button type="button" className="rounded-lg border border-zinc-200 bg-zinc-50 py-2" onClick={() => setFollowListModal("following")}>
                  <p className="text-sm font-semibold">{followingCount}</p>
                  <p className="text-[11px] text-zinc-500">{accountText.following}</p>
                </button>
              </div>
            </div>
            {!canUseSupabase ? (
              <p className="mt-2 text-sm text-[#ed4956]">
                Supabase未接続です。`.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と
                `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定すると本番認証が有効になります。
              </p>
            ) : !session ? (
              <div className={`mt-3 space-y-2 ${accountSubTab === "profile" ? "" : "hidden"}`}>
                <p className="text-xs text-[#8e8e8e]">ログインまたは登録して続けてください。</p>
                <form className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3" onSubmit={(e) => void signUpWithEmailPassword(e)}>
                  <p className="text-xs font-semibold text-zinc-700">Eメールでサインアップ</p>
                  <div className="mt-2 grid gap-2">
                    <input
                      type="email"
                      autoComplete="email"
                      className={inputClass}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                      type="password"
                      autoComplete="new-password"
                      className={inputClass}
                      placeholder="パスワード（8文字以上）"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                    />
                    <input
                      type="password"
                      autoComplete="new-password"
                      className={inputClass}
                      placeholder="確認用パスワード"
                      value={authPasswordConfirm}
                      onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                    />
                  </div>
                  <div className="mt-2 grid gap-2">
                    <button disabled={loading || busy} className={primaryButtonClass} type="submit">
                      Eメールで登録
                    </button>
                    <button
                      type="button"
                      disabled={loading || busy}
                      className={secondaryButtonClass}
                      onClick={() => void signInWithEmailPassword()}
                    >
                      Eメールでログイン
                    </button>
                    <button
                      type="button"
                      disabled={loading || busy}
                      className={secondaryButtonClass}
                      onClick={() => void signInWithEmail()}
                    >
                      ログインリンク送信
                    </button>
                  </div>
                </form>
                <div className="grid gap-2">
                  <button
                    onClick={signInWithGoogle}
                    disabled={loading || busy}
                    className={primaryButtonClass}
                    type="button"
                  >
                    {accountText.googleLogin}
                  </button>
                </div>
              </div>
            ) : null}
            <div className={`mt-3 ${accountSubTab === "profile" ? "" : "hidden"}`}>
              <label className="text-xs font-semibold text-[#374151]">誰のために何をしたいか</label>
              <p className="mt-1 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm leading-relaxed text-[#262626]">
                {profileGoal.trim() || (language === "ja" ? "未設定です。Settingsで設定できます。" : "Not set yet. You can edit it in Settings.")}
              </p>
            </div>
            <div className={`mt-4 rounded-xl border border-[#efefef] bg-white p-4 ${accountSubTab === "profile" ? "" : "hidden"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#262626]">{accountText.myPosts}</h3>
                <span className="text-[11px] text-[#8e8e8e]">{myFeedPosts.length}件</span>
              </div>
              {session ? (
                myFeedPosts.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {myFeedPosts.slice(0, 10).map((post) => (
                      <li key={`my-post-${post.id}`} className="rounded-lg border border-[#f1f1f1] bg-[#fafafa] px-3 py-2">
                        <p className="text-xs text-[#8e8e8e]">{formatFeedTime(post.createdAt)}</p>
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-[#262626]">
                          {post.caption || accountText.imageOnlyPost}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-[#8e8e8e]">{accountText.noPosts}</p>
                )
              ) : (
                <p className="mt-2 text-xs text-[#8e8e8e]">{accountText.loginForPosts}</p>
              )}
            </div>
            <div className={`mt-4 rounded-xl border border-[#efefef] bg-white p-4 ${accountSubTab === "profile" ? "" : "hidden"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#262626]">{accountText.suggestedUsers}</h3>
                <span className="text-[11px] text-[#8e8e8e]">{accountText.typeRecommend}</span>
              </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DEMO_FOLLOW_USERS.slice(0, 5).map((u) => (
                    <button
                      key={`chip-${u.id}`}
                      type="button"
                      className={`rounded-full px-2 py-0.5 text-[11px] transition ${
                        followingIds.includes(u.id)
                          ? "bg-[#dcfce7] text-[#166534]"
                          : "bg-[#f2f7ff] text-[#1d4ed8] hover:bg-[#e3efff]"
                      }`}
                      onClick={() => void toggleFollow(u.id)}
                    >
                      {followingIds.includes(u.id) ? `${u.name} ✓` : u.name}
                    </button>
                  ))}
                </div>
                <ul className="mt-2 space-y-2">
                  {visibleFollowSuggestions.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#f2f2f2] px-3 py-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="truncate text-sm font-medium text-[#262626] hover:underline"
                          onClick={() =>
                            setActiveProfileMember({
                              id: u.id,
                              name: u.name,
                              goal: u.goal,
                              strength: language === "ja" ? "プロフィールから確認" : "View profile details",
                              aiType: inferAiTypeFromMember({ goal: u.goal, strength: "" }),
                            })
                          }
                        >
                          {u.name}
                        </button>
                        <p className="truncate text-xs text-[#8e8e8e]">{u.goal}</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full bg-[#0095f6] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        onClick={() => void toggleFollow(u.id)}
                      >
                        {followingIds.includes(u.id) ? accountText.followed : accountText.follow}
                      </button>
                    </li>
                  ))}
                </ul>
            </div>
            <div className={`${accountSubTab === "settings" ? "" : "hidden"} mt-3 space-y-3`}>
              <div className="rounded-xl border border-sky-200/80 bg-sky-50/90 p-4">
                <p className="text-xs font-semibold text-sky-950">
                  {language === "ja" ? "サービスについて" : "About this service"}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-sky-900/85">
                  {language === "ja"
                    ? "企画・仲間・実行の説明（トップのランディング）をいつでも開けます。"
                    : "Open the marketing overview (value prop) again."}
                </p>
                <button
                  type="button"
                  className={`${secondaryButtonClass} mt-3 w-full text-center`}
                  onClick={() => {
                    trackOpsEvent("landing_open_from_settings");
                    setShowLandingPage(true);
                  }}
                >
                  {language === "ja" ? "ランディングを見る" : "View landing page"}
                </button>
              </div>
              <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                <p className="text-xs font-semibold text-[#374151]">{accountText.username}</p>
                <input
                  className={`mt-2 w-full ${inputClass}`}
                  placeholder="例: taro_dev"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-[#8e8e8e]">{accountText.usernameHint}</p>
              </div>
              <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                <p className="text-xs font-semibold text-[#374151]">{accountText.language}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      language === "ja"
                        ? "border-[#0095f6] bg-[#e8f4ff] text-[#0f4c81]"
                        : "border-[#d1d5db] bg-white text-[#4b5563] hover:bg-[#f9fafb]"
                    }`}
                    onClick={() => setLanguage("ja")}
                  >
                    日本語
                  </button>
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      language === "en"
                        ? "border-[#0095f6] bg-[#e8f4ff] text-[#0f4c81]"
                        : "border-[#d1d5db] bg-white text-[#4b5563] hover:bg-[#f9fafb]"
                    }`}
                    onClick={() => setLanguage("en")}
                  >
                    English
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                <p className="text-xs font-semibold text-[#374151]">
                  {language === "ja" ? "通話・DMの許可設定" : "Call/DM permission"}
                </p>
                <div className="mt-2 grid gap-2">
                  {([
                    { id: "followers", labelJa: "① フォロー承認後のみDM許可", labelEn: "① DM after follow approval" },
                    { id: "all", labelJa: "② 全員にDM許可", labelEn: "② Allow all DMs" },
                    { id: "message_only", labelJa: "③ DMのみ許可（通話OFF）", labelEn: "③ DM only (calls off)" },
                    { id: "none", labelJa: "④ 全て拒否", labelEn: "④ Reject all" },
                  ] as Array<{ id: ContactPermission; labelJa: string; labelEn: string }>).map((opt) => (
                    <button
                      key={`contact-permission-${opt.id}`}
                      type="button"
                      className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                        contactPermission === opt.id
                          ? "border-[#0095f6] bg-[#e8f4ff] text-[#0f4c81]"
                          : "border-[#d1d5db] bg-white text-[#4b5563] hover:bg-[#f9fafb]"
                      }`}
                      onClick={() => setContactPermission(opt.id)}
                    >
                      {language === "ja" ? opt.labelJa : opt.labelEn}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                <p className="text-xs font-semibold text-[#374151]">誰のために何をしたいか</p>
                <textarea
                  className={`mt-2 min-h-24 w-full ${inputClass}`}
                  placeholder="例: 中学生の勉強習慣を良くするために、使いやすい学習サポートを作りたい"
                  value={profileGoal}
                  onChange={(e) => setProfileGoal(e.target.value)}
                  maxLength={240}
                />
                <p className="mt-1 text-right text-[11px] text-[#8e8e8e]">{profileGoal.length}/240</p>
              </div>
              {session ? (
                <button onClick={signOut} className={secondaryButtonClass} type="button" disabled={loading || busy}>
                  {accountText.logout}
                </button>
              ) : null}
              <button className={`${primaryButtonClass}`} type="button" onClick={() => void saveProfile()} disabled={requiresLogin}>
                {accountText.settingsSave}
              </button>
              {role === "investor" ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <p className="text-xs font-semibold text-zinc-700">運用ダッシュボード（管理者）</p>
                  <p className="mt-1 text-[11px] text-zinc-500">ユーザー行動ログと通報件数を確認できます。</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-zinc-200 bg-white p-2">
                      <p className="text-[11px] font-semibold text-zinc-700">最新イベント</p>
                      <ul className="mt-1 space-y-1 text-[11px] text-zinc-600">
                        {eventSummary.length === 0 ? <li>まだイベントがありません</li> : eventSummary.map(([name, count]) => <li key={`ev-${name}`}>{name}: {count}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-2">
                      <p className="text-[11px] font-semibold text-zinc-700">日別イベント（直近7日）</p>
                      <ul className="mt-1 space-y-1 text-[11px] text-zinc-600">
                        {eventDailySummary.length === 0 ? (
                          <li>まだデータがありません</li>
                        ) : (
                          eventDailySummary.map((row) => (
                            <li key={`day-${row.day}`} className="flex items-center gap-2">
                              <span className="w-12 tabular-nums">{row.day}</span>
                              <span className="h-2 rounded bg-sky-500/20" style={{ width: `${Math.min(120, row.count * 8)}px` }} />
                              <span className="tabular-nums">{row.count}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-2">
                      <p className="text-[11px] font-semibold text-zinc-700">通報</p>
                      <p className="mt-1 text-xs text-zinc-600">合計 {reports.length} 件</p>
                      <ul className="mt-1 space-y-1 text-[11px] text-zinc-600">
                        {reports.slice(0, 6).map((r) => (
                          <li key={r.id} className="rounded border border-zinc-200 px-1.5 py-1">
                            <p>[{r.targetType}] {r.reason}</p>
                            <p className="text-[10px] text-zinc-500">状態: {r.status ?? "new"}</p>
                            <p className="text-[10px] text-zinc-500">担当: {r.assignee ?? "未設定"} / 期限: {r.dueAt ?? "未設定"}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <button className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px]" type="button" onClick={() => updateReportStatus(r.id, "reviewing")}>確認中</button>
                              <button className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px]" type="button" onClick={() => updateReportStatus(r.id, "resolved")}>解決済み</button>
                              <button className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px]" type="button" onClick={() => {
                                const assignee = typeof window !== "undefined" ? window.prompt("担当者名", r.assignee ?? "") : "";
                                if (assignee != null) assignReport(r.id, assignee);
                              }}>担当設定</button>
                              <button className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px]" type="button" onClick={() => {
                                const due = typeof window !== "undefined" ? window.prompt("期限 (YYYY-MM-DD)", r.dueAt ?? "") : "";
                                if (due != null) setReportDeadline(r.id, due);
                              }}>期限設定</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-zinc-700">通知センター</p>
                      <button
                        type="button"
                        className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-600"
                        onClick={() => setDismissedNotificationIds([])}
                      >
                        リセット
                      </button>
                    </div>
                    <ul className="mt-1 space-y-1 text-[11px] text-zinc-600">
                      {notificationItems.length === 0 ? (
                        <li>未処理通知はありません</li>
                      ) : (
                        notificationItems.map((n) => <li key={`center-${n.id}`}>{n.text}</li>)
                      )}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
            {authMessage ? <p className="mt-2 text-sm text-[#262626]">{authMessage}</p> : null}
            {requiresLogin ? (
              <p className="mt-2 text-sm text-[#ed4956]">
                投稿系機能を使うにはログインが必要です。Googleログイン後、ヘッダー右にメールが表示されているか確認してください。
              </p>
            ) : null}
        </section>

        <section className={`${cardClass} overflow-hidden p-0 ${activePage === "posts" ? "" : "hidden"}`}>
          <div className="border-b border-zinc-200 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold">投稿</h3>
              <button type="button" className={secondaryButtonClass} onClick={() => setActivePage("articles")}>記事へ</button>
            </div>
          </div>

          <form className="space-y-3 border-b border-zinc-200 px-5 py-4" onSubmit={(e) => void createFeedPost(e)}>
            <p className="text-xs font-semibold text-zinc-800">いまどうしてる？</p>
            <textarea
              className={`min-h-[5.5rem] w-full ${inputClass}`}
              placeholder="いまどうしてる？"
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              maxLength={280}
            />
            <div className="flex items-end justify-between gap-2">
              <input
                ref={postFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onPostFileChange}
              />
              <span className="text-xs text-zinc-500">{postCaption.length}/280</span>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-900 bg-zinc-900 text-xl font-semibold text-white transition hover:bg-zinc-800"
                onClick={() => postFileInputRef.current?.click()}
                aria-label="画像を選択"
                title="画像を選択"
              >
                ＋
              </button>
            </div>
            {postUploadPreview ? (
              <div className="overflow-hidden rounded-lg border border-[#dbdbdb] bg-[#fafafa]">
                {/* eslint-disable-next-line @next/next/no-img-element -- ユーザー選択ファイルのプレビュー */}
                <img src={postUploadPreview} alt="" className="max-h-72 w-full object-cover" />
              </div>
            ) : null}
            <button className={primaryButtonClass} type="submit" disabled={postPosting || (!postFile && !postCaption.trim())}>
              {postPosting ? "投稿中…" : "ポスト"}
            </button>
          </form>

          <ul className="divide-y divide-zinc-200">
            {feedPosts.map((post) => (
              <li key={post.id} className="px-0 py-0 transition hover:bg-zinc-50/70">
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                      {(post.authorName.trim().charAt(0) || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">{post.authorName}</p>
                      <p className="text-[11px] text-zinc-500">{formatFeedTime(post.createdAt)}</p>
                    </div>
                  </div>
                  {session && session.user.id === post.authorId && post.authorId !== "demo" ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-rose-500 hover:underline"
                      onClick={() => void deleteFeedPost(post)}
                    >
                      削除
                    </button>
                  ) : null}
                </div>
                <div className="space-y-2 px-4 pb-3">
                  {post.caption ? (
                    <p className="text-sm leading-relaxed text-[#262626] whitespace-pre-wrap break-words">{post.caption}</p>
                  ) : null}
                  {post.imageUrl ? (
                    <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-[#fafafa]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- 外部URL・data URL・blob */}
                      <img src={post.imageUrl} alt="" className="max-h-[28rem] w-full object-cover" loading="lazy" />
                    </div>
                  ) : null}
                  <div className="flex items-center gap-4 text-sm">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-zinc-500 transition hover:text-sky-600 active:scale-95"
                      onClick={() => void toggleFeedPostLike(post)}
                      aria-label={post.likedByMe ? "いいねを取り消す" : "いいねする"}
                    >
                      <span className={post.likedByMe ? "text-rose-500" : "text-zinc-500"}>{post.likedByMe ? "♥" : "♡"}</span>
                      <span className={post.likedByMe ? "font-semibold text-rose-500" : ""}>{post.likeCount.toLocaleString("ja-JP")}</span>
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-zinc-500 transition hover:text-zinc-900"
                      onClick={() => {
                        const el = document.getElementById(`comment-input-${post.id}`);
                        el?.focus();
                      }}
                    >
                      <span>💬</span>
                      <span>{post.commentCount.toLocaleString("ja-JP")}</span>
                    </button>
                  </div>
                  <div className="mt-1 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
                    {post.comments.length > 0 ? (
                      <ul className="space-y-2">
                        {post.comments.slice(-3).map((c) => (
                          <li key={c.id} className="text-sm text-[#262626]">
                            <span className="font-semibold">{c.authorName}</span>{" "}
                            <span className="whitespace-pre-wrap break-words">{c.body}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-zinc-500">まだコメントはありません</p>
                    )}
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void addFeedComment(post);
                      }}
                    >
                      <input
                        id={`comment-input-${post.id}`}
                        className="flex-1 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-500"
                        placeholder="コメントを書く"
                        value={commentDrafts[post.id] ?? ""}
                        onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        maxLength={280}
                      />
                      <button
                        type="submit"
                        className={primaryButtonClass}
                        disabled={!(commentDrafts[post.id] ?? "").trim()}
                      >
                        コメント
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {feedPosts.length === 0 && canUseSupabase ? (
            <p className="px-5 py-6 text-center text-sm text-zinc-500">まだ投稿がありません。最初のポストを投稿してみよう。</p>
          ) : null}
        </section>

        <section className={`${cardClass} ${activePage === "articles" ? "" : "hidden"}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">記事</h3>
            <button type="button" className={secondaryButtonClass} onClick={() => setActivePage("posts")}>投稿へ</button>
          </div>
          {role === "investor" ? (
            <form className="mt-3 grid gap-2" onSubmit={addArticle}>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className={inputClass}
                  placeholder="カテゴリ（例: インタビュー / ノウハウ / お知らせ）"
                  value={articleCategory}
                  onChange={(e) => setArticleCategory(e.target.value)}
                  required
                />
                <input
                  className={inputClass}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={onArticleImageChange}
                />
              </div>
              <input
                className={inputClass}
                placeholder="記事タイトル"
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                required
              />
              <textarea
                className={inputClass}
                placeholder="概要"
                value={articleSummary}
                onChange={(e) => setArticleSummary(e.target.value)}
                required
              />
              <textarea
                className="min-h-32 rounded-md border border-[#dbdbdb] bg-[#fafafa] px-3 py-2 text-base text-[#262626] outline-none transition focus:border-[#a8a8a8] focus:bg-white"
                placeholder="本文（詳細画面で全文表示されます）"
                value={articleBody}
                onChange={(e) => setArticleBody(e.target.value)}
                required
              />
              {articleImagePreview ? (
                <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#fafafa]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local article image preview */}
                  <img src={articleImagePreview} alt="" className="max-h-64 w-full object-cover" />
                </div>
              ) : null}
              {articleImageFile ? <p className="text-xs text-[#8e8e8e]">選択中: {articleImageFile.name}</p> : null}
              <button className={primaryButtonClass} type="submit" disabled={busy || requiresLogin}>
                掲載枠に追加
              </button>
            </form>
          ) : null}
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px]">
            <input
              className={inputClass}
              placeholder="記事を検索（タイトル・概要・本文）"
              value={articleQuery}
              onChange={(e) => setArticleQuery(e.target.value)}
            />
            <select
              className={inputClass}
              value={articleFilterCategory}
              onChange={(e) => setArticleFilterCategory(e.target.value)}
            >
              {articleCategories.map((cat) => (
                <option key={`article-cat-${cat}`} value={cat}>
                  {cat === "all" ? "全カテゴリ" : cat}
                </option>
              ))}
            </select>
          </div>

          {activeArticle ? (
            <article className="mt-3 rounded-xl border border-[#e5e7eb] bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs font-semibold text-[#0095f6] hover:text-[#1877f2]"
                  onClick={() => setActiveArticleId(null)}
                >
                  ◀️
                </button>
                <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-semibold text-[#4b5563]">
                  {activeArticle.category ?? "未分類"}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                投稿者: {activeArticle.authorName ?? "ユーザー"} {activeArticle.createdAt ? `・${formatFeedTime(activeArticle.createdAt)}` : ""}
              </p>
              <h4 className="text-xl font-bold tracking-tight text-[#262626]">{activeArticle.title}</h4>
              <p className="mt-1 text-sm text-[#6b7280]">{activeArticle.summary}</p>
              {activeArticle.imageUrl ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#fafafa]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- article detail image */}
                  <img src={activeArticle.imageUrl} alt="" className="max-h-[26rem] w-full object-cover" />
                </div>
              ) : null}
              <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#262626]">
                {activeArticle.body ?? activeArticle.summary}
              </div>
              <div className="mt-4 flex items-center gap-3 text-sm">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[#8e8e8e]"
                  onClick={() => toggleArticleLike(activeArticle.id)}
                >
                  <span className={activeArticle.likedByMe ? "text-[#ed4956]" : "text-[#8e8e8e]"}>{activeArticle.likedByMe ? "♥" : "♡"}</span>
                  <span>{(activeArticle.likeCount ?? 0).toLocaleString("ja-JP")}</span>
                </button>
                <span className="text-[#8e8e8e]">💬 {(activeArticle.comments ?? []).length}</span>
                {activeArticle.authorId ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => void submitReport("profile", activeArticle.authorId as string, activeArticle.authorName ?? activeArticle.title)}
                  >
                    ユーザー報告
                  </button>
                ) : null}
                {session && (role === "investor" || activeArticle.authorId === session.user.id) ? (
                  <>
                    <button
                      type="button"
                      className="ml-auto text-xs font-semibold text-sky-600 hover:text-sky-700"
                      onClick={() => startEditArticle(activeArticle)}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                      onClick={() => void deleteArticle(activeArticle.id)}
                    >
                      削除
                    </button>
                  </>
                ) : null}
              </div>
              {articleEditId === activeArticle.id ? (
                <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
                  <p className="text-xs font-semibold text-zinc-700">記事を編集</p>
                  <div className="mt-2 grid gap-2">
                    <input className={inputClass} value={articleEditTitle} onChange={(e) => setArticleEditTitle(e.target.value)} placeholder="タイトル" />
                    <input className={inputClass} value={articleEditSummary} onChange={(e) => setArticleEditSummary(e.target.value)} placeholder="概要" />
                    <input className={inputClass} value={articleEditCategory} onChange={(e) => setArticleEditCategory(e.target.value)} placeholder="カテゴリ" />
                    <textarea
                      className="min-h-28 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
                      value={articleEditBody}
                      onChange={(e) => setArticleEditBody(e.target.value)}
                      placeholder="本文"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={primaryButtonClass} onClick={() => void saveArticleEdit(activeArticle.id)}>
                      変更を保存
                    </button>
                    <button type="button" className={secondaryButtonClass} onClick={cancelEditArticle}>
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 rounded-xl border border-[#f0f0f0] bg-[#fcfcfd] p-3">
                {(activeArticle.comments ?? []).length > 0 ? (
                  <ul className="space-y-2">
                    {(activeArticle.comments ?? []).slice(-5).map((c) => (
                      <li key={c.id} className="text-sm text-[#262626]">
                        <span className="font-semibold">{c.authorName}</span>{" "}
                        <span className="whitespace-pre-wrap break-words">{c.body}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#8e8e8e]">まだコメントはありません</p>
                )}
                <form
                  className="mt-2 flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addArticleComment(activeArticle.id);
                  }}
                >
                  <input
                    className="flex-1 rounded-full border border-[#dbdbdb] bg-white px-3 py-2 text-sm text-[#262626] outline-none focus:border-[#a8a8a8]"
                    placeholder="コメントを書く"
                    value={articleCommentDrafts[activeArticle.id] ?? ""}
                    onChange={(e) => setArticleCommentDrafts((prev) => ({ ...prev, [activeArticle.id]: e.target.value }))}
                    maxLength={280}
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-[#0095f6] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    disabled={!(articleCommentDrafts[activeArticle.id] ?? "").trim()}
                  >
                    投稿
                  </button>
                </form>
              </div>
            </article>
          ) : null}

          <ul className="mt-3 space-y-2">
            {filteredArticles.map((a) => (
              <li key={a.id} className="rounded-lg border border-[#efefef] p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => setActiveArticleId(a.id)}
                  >
                    <p className="font-semibold text-[#262626] hover:underline">{a.title}</p>
                    <p className="mt-1 line-clamp-2 text-[#262626]">{a.summary}</p>
                  </button>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      a.status === "published" ? "bg-[#e7f6ef] text-[#18794e]" : "bg-[#efefef] text-[#8e8e8e]"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  投稿者: {a.authorName ?? "ユーザー"} {a.createdAt ? `・${formatFeedTime(a.createdAt)}` : ""}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-[#8e8e8e]"
                    onClick={() => toggleArticleLike(a.id)}
                  >
                    <span className={a.likedByMe ? "text-[#ed4956]" : "text-[#8e8e8e]"}>{a.likedByMe ? "♥" : "♡"}</span>
                    <span>{(a.likeCount ?? 0).toLocaleString("ja-JP")}</span>
                  </button>
                  <span className="text-xs text-[#8e8e8e]">💬 {(a.comments ?? []).length}</span>
                  <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-semibold text-[#4b5563]">
                    {a.category ?? "未分類"}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#0095f6] hover:text-[#1877f2]"
                    onClick={() => setActiveArticleId(a.id)}
                  >
                    記事を読む
                  </button>
                  {a.authorId ? (
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => void submitReport("profile", a.authorId as string, a.authorName ?? a.title)}
                    >
                      ユーザー報告
                    </button>
                  ) : null}
                  {role === "investor" ? (
                    <button
                      className="ml-auto rounded-md border border-[#dbdbdb] bg-white px-3 py-1 text-xs font-semibold text-[#0095f6]"
                      type="button"
                      onClick={() => void publishArticle(a.id, a.status)}
                      disabled={requiresLogin}
                    >
                      {a.status === "published" ? "下書きに戻す" : "公開する"}
                    </button>
                  ) : null}
                  {session && (role === "investor" || a.authorId === session.user.id) ? (
                    <>
                      <button
                        type="button"
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700"
                        onClick={() => startEditArticle(a)}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-500"
                        onClick={() => void deleteArticle(a.id)}
                      >
                        削除
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {filteredArticles.length === 0 ? (
            <p className="mt-3 text-center text-sm text-[#8e8e8e]">条件に一致する記事がありません。</p>
          ) : null}
        </section>

        <section
          className={`${cardClass} overflow-hidden p-0 ${activePage === "mentor" && mentorSubTab === "menu" ? "" : "hidden"} min-h-[min(72vh,640px)]`}
        >
          <div className="flex h-full min-h-[min(72vh,640px)] flex-col">
            <button
              type="button"
              className="group relative flex flex-1 flex-col items-center justify-center gap-2 overflow-hidden border-b border-[#e5e7eb] px-6 text-center transition hover:brightness-[0.99] active:brightness-95"
              onClick={() => setMentorSubTab("ai")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative menu background */}
              <img
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80"
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/25 to-black/20" />
              <div className="relative z-10">
                <p className="text-3xl font-bold tracking-tight text-white drop-shadow">AI</p>
                <p className="mt-1 text-sm text-white/90">ChatGPT風で相談する</p>
              </div>
            </button>
            <button
              type="button"
              className="group relative flex flex-1 flex-col items-center justify-center gap-2 overflow-hidden px-6 text-center transition hover:brightness-[0.99] active:brightness-95"
              onClick={() => setMentorSubTab("validation")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative menu background */}
              <img
                src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80"
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/25 to-black/20" />
              <div className="relative z-10">
                <p className="text-3xl font-bold tracking-tight text-white drop-shadow">検証</p>
                <p className="mt-1 text-sm text-white/90">2ch風スレで仮説を試す</p>
              </div>
            </button>
          </div>
        </section>

        <section
          className={`overflow-hidden rounded-none border border-[#dbdbdb] bg-[#f7f7f8] sm:rounded-lg ${activePage === "mentor" && mentorSubTab === "ai" ? "" : "hidden"} flex min-h-[min(72vh,620px)] flex-col p-0`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e5e7eb] bg-white px-4 py-3">
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight text-[#202123]">相談AI</h3>
              <p className="text-[11px] text-[#6b7280]">ChatGPT風チャット</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-[#d1d5db] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] transition hover:bg-[#f9fafb]"
                onClick={() => setMentorSubTab("menu")}
              >
                ◀️
              </button>
              <button
                type="button"
                className="rounded-md border border-[#d1d5db] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] transition hover:bg-[#f9fafb]"
                onClick={clearMentorChat}
              >
                新しい相談
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-5">
              <div className="space-y-3">
                {mentorMessages.map((m) => (
                  <div key={m.id} className="rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 sm:px-4">
                    <div className="mb-1.5 flex items-center gap-2">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                          m.role === "user" ? "bg-[#dbeafe] text-[#1d4ed8]" : "bg-[#dcfce7] text-[#166534]"
                        }`}
                        aria-hidden
                      >
                        {m.role === "user" ? "You" : "AI"}
                      </div>
                      <p className="text-xs font-semibold text-[#4b5563]">{m.role === "user" ? "あなた" : "相談AI"}</p>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#202123]">{m.content}</p>
                  </div>
                ))}

                {mentorLoading ? (
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 sm:px-4">
                    <div className="mb-1.5 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#dcfce7] text-[10px] font-bold text-[#166534]">
                        AI
                      </div>
                      <p className="text-xs font-semibold text-[#4b5563]">相談AI</p>
                    </div>
                    <p className="text-sm text-[#6b7280]">考え中…</p>
                  </div>
                ) : null}
              </div>
              <div ref={mentorScrollAnchorRef} className="h-px w-full shrink-0" aria-hidden />
            </div>
          </div>

          {mentorError ? (
            <p className="mx-3 mb-2 rounded-md border border-[#fecaca] bg-[#fff5f5] px-3 py-2 text-xs text-[#b91c1c]">{mentorError}</p>
          ) : null}

          <div className="shrink-0 border-t border-[#e5e7eb] bg-[#f7f7f8] p-3 sm:p-4">
            <form className="mx-auto flex w-full max-w-3xl gap-2 rounded-2xl border border-[#d1d5db] bg-white p-2 shadow-sm" onSubmit={(e) => void sendMentorMessage(e)}>
              <textarea
                className="min-h-[46px] max-h-40 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-[#202123] outline-none"
                placeholder="相談内容を入力…（Enter で送信 / Shift+Enter で改行）"
                value={mentorInput}
                onChange={(e) => setMentorInput(e.target.value)}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMentorMessage();
                  }
                }}
              />
              <button
                className="shrink-0 self-end rounded-xl bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-40"
                type="submit"
                disabled={mentorLoading || !mentorInput.trim()}
              >
                {mentorLoading ? "…" : "送信"}
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-[#6b7280]">AIの回答は参考情報です。必要に応じて大人と一緒に確認してください。</p>
          </div>
        </section>

        <section className={`${cardClass} ${activePage === "discovery" ? "" : "hidden"}`}>
          <div className="mb-4 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">7日チャレンジ</p>
            <h3 className="mt-1 text-base font-bold text-zinc-900">まず一歩目が分からない人向け</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              興味を入れるだけで、AIが5つだけ具体的に聞きます。最後に7日分の「今日やること」が出ます（行動させる設計）。
            </p>
            <Link
              href="/business-seed"
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              7日でビジネスの種をつくる
            </Link>
          </div>
          <h3 className="text-base font-semibold">アイデア知恵袋</h3>
          <p className="mt-1 text-xs text-zinc-600">
            このアイデアどうすればいい？などを質問し、みんなが回答。質問した人だけがベストアンサーを1つ選べます。
          </p>

          {ideaChieDetailId && !ideaChieDetailQuestion ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
              <p>この質問は一覧にありません。DBの反映待ちか、削除された可能性があります。</p>
              <button
                type="button"
                className={`${secondaryButtonClass} mt-3`}
                onClick={() => {
                  setIdeaChieDetailId(null);
                  void loadIdeaChieBoard();
                }}
              >
                一覧へ戻る
              </button>
            </div>
          ) : null}
          {ideaChieDetailId && ideaChieDetailQuestion ? (
            (() => {
              const q = ideaChieDetailQuestion;
              const sortedAnswers = [...ideaChieAnswers].sort((a, b) => {
                if (a.id === q.bestAnswerId) return -1;
                if (b.id === q.bestAnswerId) return 1;
                return new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime();
              });
              const isQuestionAuthor = Boolean(session?.user?.id && q.authorId === session.user.id);
              const canAnswer = Boolean(session?.user?.id && q.authorId !== session.user.id);
              return (
                <div className="mt-4 space-y-4">
                  <button
                    type="button"
                    className={`${secondaryButtonClass} text-sm`}
                    onClick={() => {
                      setIdeaChieDetailId(null);
                      setIdeaChieAnswerDraft("");
                    }}
                  >
                    ← 一覧に戻る
                  </button>
                  <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-zinc-900">{q.title}</h4>
                      {q.bestAnswerId ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          解決（ベストアンサーあり）
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                      {q.body.trim() ? q.body : "（補足なし）"}
                    </p>
                    <p className="mt-3 text-[11px] text-zinc-500">
                      {q.authorName} · {formatFeedTime(q.createdAtIso)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">回答 {q.answerCount} 件</p>
                    <ul className="mt-2 space-y-3">
                      {sortedAnswers.length === 0 ? (
                        <li className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                          まだ回答がありません。最初の回答を書いてみよう。
                        </li>
                      ) : (
                        sortedAnswers.map((a) => {
                          const isBest = q.bestAnswerId === a.id;
                          return (
                            <li
                              key={a.id}
                              className={`rounded-xl border p-3 ${
                                isBest ? "border-emerald-300 bg-emerald-50/80" : "border-zinc-200 bg-white"
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-zinc-600">{a.authorName}</p>
                                {isBest ? (
                                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                    ベストアンサー
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{a.body}</p>
                              <p className="mt-2 text-[11px] text-zinc-400">{formatFeedTime(a.createdAtIso)}</p>
                              {isQuestionAuthor && !isBest ? (
                                <button
                                  type="button"
                                  className="mt-2 rounded-lg border border-emerald-600 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                                  onClick={() => void pickIdeaChieBestAnswer(a.id)}
                                >
                                  ベストアンサーにする
                                </button>
                              ) : null}
                              {isQuestionAuthor && isBest ? (
                                <p className="mt-2 text-[11px] font-medium text-emerald-800">選んだベストアンサーです</p>
                              ) : null}
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                  {session ? (
                    canAnswer ? (
                      <form className="rounded-xl border border-zinc-200 bg-zinc-50 p-3" onSubmit={(e) => void submitIdeaChieAnswer(e)}>
                        <label className="text-xs font-semibold text-zinc-700">回答を書く</label>
                        <textarea
                          className={`mt-2 min-h-[5rem] w-full ${inputClass}`}
                          placeholder="アドバイスやアイデアのヒントを書いてあげよう"
                          value={ideaChieAnswerDraft}
                          onChange={(e) => setIdeaChieAnswerDraft(e.target.value)}
                          rows={3}
                        />
                        <button type="submit" className={`${primaryButtonClass} mt-2`} disabled={!ideaChieAnswerDraft.trim()}>
                          回答を投稿
                        </button>
                      </form>
                    ) : (
                      <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        自分の質問には回答できません。他の人の質問から回答してみよう。
                      </p>
                    )
                  ) : (
                    <p className="text-xs text-zinc-500">回答するにはログインしてください。</p>
                  )}
                </div>
              );
            })()
          ) : null}
          {!ideaChieDetailId ? (
            <div className="mt-4 space-y-4">
              {session ? (
                <form className="rounded-xl border border-zinc-200 bg-zinc-50 p-4" onSubmit={(e) => void submitIdeaChieQuestion(e)}>
                  <p className="text-sm font-semibold text-zinc-800">新しい質問</p>
                  <input
                    className={`mt-2 w-full ${inputClass}`}
                    placeholder="例: このアイデア、学校で試すにはどうすればいい？"
                    value={ideaChieNewTitle}
                    onChange={(e) => setIdeaChieNewTitle(e.target.value)}
                  />
                  <textarea
                    className={`mt-2 min-h-[6rem] w-full ${inputClass}`}
                    placeholder="状況やアイデアの内容を書く（任意）"
                    value={ideaChieNewBody}
                    onChange={(e) => setIdeaChieNewBody(e.target.value)}
                    rows={4}
                  />
                  <button type="submit" className={`${primaryButtonClass} mt-2`} disabled={!ideaChieNewTitle.trim()}>
                    質問を投稿
                  </button>
                </form>
              ) : (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  質問や回答にはログインが必要です。
                </p>
              )}
              <div>
                <p className="text-sm font-semibold text-zinc-800">みんなの質問</p>
                {ideaChieLoading ? (
                  <p className="mt-3 text-sm text-zinc-500">読み込み中…</p>
                ) : ideaChieQuestions.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-dashed border-zinc-200 bg-white px-3 py-8 text-center text-sm text-zinc-500">
                    まだ質問がありません。最初の質問を投稿してみよう。
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {ideaChieQuestions.map((q) => (
                      <li key={q.id}>
                        <button
                          type="button"
                          className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-sky-300 hover:bg-sky-50/40"
                          onClick={() => {
                            setIdeaChieDetailId(q.id);
                            setIdeaChieAnswerDraft("");
                          }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="font-medium text-zinc-900">{q.title}</p>
                            {q.bestAnswerId ? (
                              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                解決
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{q.body.trim() || "（補足なし）"}</p>
                          <p className="mt-2 text-[11px] text-zinc-400">
                            {q.authorName} · 回答 {q.answerCount} · {formatFeedTime(q.createdAtIso)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className={`${cardClass} ${activePage === "chat" && chatSubView === "list" ? "" : "hidden"}`}>
          <h3 className="text-base font-semibold">検索</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => void shareInviteLink()}>
              友達を招待する
            </button>
            <button type="button" className={secondaryButtonClass} onClick={shareInviteOnLine}>
              LINEで共有
            </button>
            
          </div>
          <div className="mt-3 grid gap-3">
            <form onSubmit={runMatching} className="rounded-xl border border-[#e5e7eb] bg-white p-3">
              <p className="text-sm font-semibold text-[#262626]">検索</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(AI_MATCH_TYPE_META) as AiMatchType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      selectedAiType === type
                        ? "border-[#0095f6] bg-[#e8f4ff] text-[#0f4c81]"
                        : "border-[#d1d5db] bg-white text-[#4b5563] hover:bg-[#f9fafb]"
                    }`}
                    onClick={() => setSelectedAiType((prev) => (prev === type ? null : type))}
                  >
                    {AI_MATCH_TYPE_META[type].label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className={`flex-1 ${inputClass}`}
                  placeholder="例: 教育 アプリ 発表 が得意な人"
                  value={matchGoal}
                  onChange={(e) => setMatchGoal(e.target.value)}
                />
                <button className={primaryButtonClass} type="submit">
                  絞り込む
                </button>
              </div>
            </form>
          </div>
          {matchNotice ? <p className="mt-2 text-sm text-[#8e8e8e]">{matchNotice}</p> : null}
          <ul className="mt-3 space-y-2 text-sm">
            {matches.map((m) => (
              <li key={m.id ?? `${m.name}-${m.goal}`} className="rounded-md border border-[#dbdbdb] bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="font-medium text-[#262626] hover:underline"
                    onClick={() => setActiveProfileMember(m)}
                  >
                    {m.name}
                  </button>
                  <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-semibold text-[#3730a3]">
                    {AI_MATCH_TYPE_META[m.aiType ?? inferAiTypeFromMember(m)].label}
                  </span>
                </div>
                <p className="text-sm text-zinc-700">{m.goal}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" className={secondaryButtonClass} onClick={() => setActiveProfileMember(m)}>
                    プロフィール
                  </button>
                  {m.id ? (
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      disabled={!canUseDmWith(m.id)}
                      onClick={() => void openDmFromMatch(m.id as string, m.name)}
                    >
                      DM
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${cardClass} ${activePage === "mentor" && mentorSubTab === "validation" ? "" : "hidden"}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">おためし検証シート</h3>
              <p className="mt-1 text-xs text-[#6b7280]">2ch風スレUIで、仮説への反応を集めて検証する</p>
            </div>
            <button
              type="button"
              className="rounded-md border border-[#d1d5db] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] transition hover:bg-[#f9fafb]"
              onClick={() => setMentorSubTab("menu")}
            >
              ◀️
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-[#d1d5db] bg-[#f8fafc] p-3">
            <div className="rounded-md border border-[#cbd5e1] bg-[#0f172a] px-3 py-2 text-[12px] leading-relaxed text-[#e2e8f0]">
              <p className="font-semibold text-[#93c5fd]">【おためし検証シート - 2ch風スレ】</p>
              <p className="mt-1 text-[#cbd5e1]">仮説を投下して反応を見るスレ。数字とコメントで検証。</p>
            </div>
            <input
              className="mt-2 w-full rounded-md border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#7c93ff]"
              value={testSheetQuestion}
              onChange={(e) => setTestSheetQuestion(e.target.value)}
              placeholder="検証したい問いを書く"
            />
            <div className="mt-2 grid gap-2">
              {testSheetOptions.map((opt, idx) => {
                const votes = testSheetVotes[idx] ?? 0;
                const total = Object.values(testSheetVotes).reduce((a, b) => a + b, 0);
                const ratio = total > 0 ? Math.round((votes / total) * 100) : 0;
                return (
                  <div key={`test-opt-${idx}`} className="rounded-md border border-[#e2e8f0] bg-white p-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 rounded-md border border-[#d1d5db] bg-white px-2 py-1 text-xs text-[#334155] outline-none"
                        value={opt}
                        onChange={(e) =>
                          setTestSheetOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                        }
                      />
                      <button
                        type="button"
                        className="rounded-md bg-[#1d4ed8] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1e40af]"
                        onClick={() => voteTestSheet(idx)}
                      >
                        投票
                      </button>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                      <div className="h-full rounded-full bg-[#60a5fa]" style={{ width: `${ratio}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-[#64748b]">
                      {votes}票 / {ratio}%
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 rounded-md border border-[#cbd5e1] bg-white p-2">
              <p className="text-xs font-semibold text-[#334155]">スレッド反応</p>
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded bg-[#f8fafc] p-2 font-mono text-[12px]">
                {testSheetThread.length === 0 ? (
                  <p className="text-[#64748b]">1 : 名無しさん : まだ反応はありません</p>
                ) : (
                  testSheetThread.slice(-20).map((post, i) => (
                    <p key={post.id} className="text-[#0f172a]">
                      {i + 1} : {post.author} : {post.body}
                    </p>
                  ))
                )}
              </div>
              <form
                className="mt-2 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  postToTestSheetThread();
                }}
              >
                <input
                  className="flex-1 rounded-md border border-[#cbd5e1] bg-white px-2 py-1.5 text-xs text-[#0f172a] outline-none"
                  placeholder="反応コメントを書く"
                  value={testSheetPostDraft}
                  onChange={(e) => setTestSheetPostDraft(e.target.value)}
                />
                <button
                  type="submit"
                  className="rounded-md bg-[#111827] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1f2937]"
                >
                  投下
                </button>
              </form>
            </div>
            <div className="mt-3 rounded-md border border-[#bfdbfe] bg-[#eff6ff] p-3">
              <p className="text-xs font-semibold text-[#1e3a8a]">検証結果サマリー（自動）</p>
              <ul className="mt-1 space-y-1 text-xs text-[#1e3a8a]">
                <li>結論: {validationSummary.decision}</li>
                <li>
                  投票: {validationSummary.total}票
                  {validationSummary.top ? ` / 最多「${validationSummary.top.option}」(${validationSummary.top.count}票)` : ""}
                </li>
                <li>
                  コメント傾向: {validationSummary.sentiment}（ポジ {validationSummary.pos} / ネガ {validationSummary.neg}）
                </li>
                <li>次アクション: {validationSummary.nextAction}</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={`${cardClass} hidden`}>
          <h3 className="text-base font-semibold">コード</h3>
          <textarea
            className="mt-3 min-h-28 w-full rounded-md border border-[#dbdbdb] bg-[#fafafa] p-3 font-mono text-base text-[#262626] outline-none transition focus:border-[#a8a8a8] focus:bg-white"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className={`mt-2 ${primaryButtonClass}`} type="button" onClick={runCode}>
            実行
          </button>
          <pre className="mt-3 rounded-md border border-[#262626] bg-[#262626] p-3 text-sm text-[#fafafa]">{codeOutput}</pre>
        </section>

        <section className={`${cardClass} hidden`}>
          <h3 className="text-base font-semibold">ピッチ</h3>
          <form className="mt-3 grid gap-2" onSubmit={addPitch}>
            <input
              className={inputClass}
              placeholder="ピッチタイトル"
              value={pitchTitle}
              onChange={(e) => setPitchTitle(e.target.value)}
              required
            />
            <textarea
              className={inputClass}
              placeholder="内容"
              value={pitchBody}
              onChange={(e) => setPitchBody(e.target.value)}
              required
            />
            <button className={primaryButtonClass} type="submit" disabled={busy || requiresLogin}>
              投稿
            </button>
          </form>
          <ul className="mt-3 space-y-2">
            {pitches.map((p) => (
              <li key={p.id} className="rounded-md border border-[#dbdbdb] bg-white p-3">
                <p className="font-semibold text-[#262626]">{p.title}</p>
                <p className="text-sm text-[#262626]">{p.body}</p>
                <button
                  className="mt-2 rounded-md border border-[#dbdbdb] bg-white px-3 py-1 text-sm font-semibold text-[#262626]"
                  type="button"
                  onClick={() => void cheerPitch(p.id, p.likes)}
                  disabled={busy || requiresLogin}
                >
                  応援 {p.likes}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section
          className={`overflow-hidden rounded-none border border-[#dbdbdb] bg-white sm:rounded-lg ${activePage === "chat" ? "" : "hidden"} flex min-h-[min(72vh,580px)] flex-col p-0`}
        >
          {authMessage ? (
            <div
              className={`shrink-0 border-b px-3 py-2 text-center text-[12px] leading-snug ${
                authMessage.includes("失敗") || authMessage.toLowerCase().includes("failed")
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
              role="status"
            >
              {authMessage}
            </div>
          ) : null}
          {chatSubView === "list" ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#dbdbdb] bg-white px-4 py-3">
                <h3 className="text-[17px] font-semibold tracking-tight text-[#262626]">メッセージ</h3>
                <span className="text-xs font-semibold text-[#0095f6]"> </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-white">
                <div className="border-b border-[#efefef] bg-[#fafafa] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">グループを作成</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="flex-1 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-500"
                      placeholder="例: 企画チームA"
                      value={groupRoomDraft}
                      onChange={(e) => setGroupRoomDraft(e.target.value)}
                    />
                    <button type="button" className={secondaryButtonClass} onClick={() => void createGroupRoom()}>
                      グループ作成
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-[#efefef] bg-white px-4 py-3 text-left transition hover:bg-[#fafafa] active:bg-[#efefef]"
                  onClick={() => {
                    setActiveRoomId("global");
                    setChatSubView("room");
                  }}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] p-[2px]"
                    aria-hidden
                  >
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-sm font-bold text-[#262626]">
                      #
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[15px] font-semibold text-[#262626]">みんなのルーム</p>
                      {globalTalkPreview.timeLabel ? (
                        <span className="shrink-0 text-[11px] tabular-nums text-[#8e8e8e]">
                          {globalTalkPreview.timeLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] leading-snug text-[#8e8e8e]">{globalTalkPreview.previewText}</p>
                      {globalTalkPreview.unread > 0 ? (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[11px] font-bold text-white">
                          {globalTalkPreview.unread > 99 ? "99" : globalTalkPreview.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
                {groupRooms.map((row) => {
                  const meta = talkMeta[row.room_id] ?? {
                    previewText: "メッセージはまだありません",
                    timeLabel: "",
                    unread: 0,
                  };
                  const initial = (row.room_name?.trim()?.charAt(0) || "G").toUpperCase();
                  return (
                    <button
                      key={row.room_id}
                      type="button"
                      className="flex w-full items-center gap-3 border-b border-[#efefef] bg-white px-4 py-3 text-left transition hover:bg-[#fafafa] active:bg-[#efefef]"
                      onClick={() => {
                        setActiveRoomId(row.room_id);
                        setChatSubView("room");
                      }}
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-500 text-lg font-bold text-white" aria-hidden>
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[15px] font-semibold text-[#262626]">{row.room_name}</p>
                          {meta.timeLabel ? (
                            <span className="shrink-0 text-[11px] tabular-nums text-[#8e8e8e]">{meta.timeLabel}</span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] leading-snug text-[#8e8e8e]">{meta.previewText}</p>
                          {meta.unread > 0 ? (
                            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[11px] font-bold text-white">
                              {meta.unread > 99 ? "99" : meta.unread}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {dmPeers.map((row) => {
                  const meta = talkMeta[row.room_id] ?? {
                    previewText: "メッセージはまだありません",
                    timeLabel: "",
                    unread: 0,
                  };
                  const initial = (row.peer_name?.trim()?.charAt(0) || "?").toUpperCase();
                  return (
                    <button
                      key={row.room_id}
                      type="button"
                      className="flex w-full items-center gap-3 border-b border-[#efefef] bg-white px-4 py-3 text-left transition hover:bg-[#fafafa] active:bg-[#efefef]"
                      onClick={() => {
                        setActiveRoomId(row.room_id);
                        setChatSubView("room");
                      }}
                    >
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#262626] text-lg font-bold text-white"
                        aria-hidden
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[15px] font-semibold text-[#262626]">{row.peer_name}</p>
                          {meta.timeLabel ? (
                            <span className="shrink-0 text-[11px] tabular-nums text-[#8e8e8e]">{meta.timeLabel}</span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] leading-snug text-[#8e8e8e]">{meta.previewText}</p>
                          {meta.unread > 0 ? (
                            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[11px] font-bold text-white">
                              {meta.unread > 99 ? "99" : meta.unread}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <p className="px-4 py-6 text-center text-[12px] leading-relaxed text-[#8e8e8e]">検索から相手を選ぶと1対1トークが増えます。</p>
              </div>
            </>
          ) : (
            <>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#dbdbdb] bg-white px-1 py-2 pr-2">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl font-light text-[#262626] transition hover:bg-[#fafafa]"
              aria-label="一覧に戻る"
              onClick={() => setChatSubView("list")}
            >
              ‹
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[15px] font-semibold tracking-tight text-[#262626]">
                {currentRoomLabel()}
              </p>
              <p className="truncate text-[11px] text-[#8e8e8e]">
                {currentRoomSubLabel()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-[#262626] transition hover:bg-[#fafafa]"
                title="通話（Jitsi）"
                aria-label="通話を開始"
                onClick={startJitsiCall}
                disabled={!canUseCallForCurrentRoom()}
              >
                📞
              </button>
              {callUrl ? (
                <a
                  className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-[#262626] transition hover:bg-[#fafafa]"
                  href={callUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="通話を再度開く"
                  aria-label="通話を再度開く"
                >
                  📹
                </a>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white px-2 py-3">
            <div className="px-1">
              <input
                className="w-full rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-sky-500"
                placeholder="このトーク内を検索"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
              />
            </div>
            {messages.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#8e8e8e]">まだメッセージがありません。</p>
            ) : null}
            {filteredMessages.map((m, i) => {
              const isMine = Boolean(session?.user?.id && m.senderId === session.user.id);
              const initial = (m.sender?.trim()?.charAt(0) || "?").toUpperCase();
              const showUnreadLine = !chatSearch.trim() && firstUnreadMessageIndex === i;
              return (
                <div key={m.id} className="space-y-3">
                  {showUnreadLine ? (
                    <div
                      className="flex items-center gap-2 px-1 py-1"
                      role="status"
                      aria-label="ここから未読のメッセージ"
                    >
                      <div className="h-px min-w-[1rem] flex-1 bg-[#dbdbdb]" />
                      <span className="shrink-0 text-[11px] font-semibold tracking-wide text-[#8e8e8e]">
                        新しいメッセージ
                      </span>
                      <div className="h-px min-w-[1rem] flex-1 bg-[#dbdbdb]" />
                    </div>
                  ) : null}
                  <div className={`flex w-full gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                    {!isMine ? (
                      <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c7c7c7] text-xs font-bold text-white"
                        aria-hidden
                      >
                        {initial}
                      </div>
                    ) : (
                      <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#262626] text-xs font-bold text-white"
                        aria-hidden
                      >
                        {initial}
                      </div>
                    )}
                    <div
                      className={`max-w-[min(100%,20rem)] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}
                    >
                      {!isMine ? (
                        <span className="pl-1 text-[11px] font-semibold text-[#8e8e8e]">{m.sender}</span>
                      ) : null}
                      <div
                        className={`rounded-[22px] px-3 py-2 text-sm leading-relaxed ${
                          isMine
                            ? "rounded-tr-sm bg-[#efefef] text-[#262626]"
                            : "rounded-tl-sm border border-[#dbdbdb] bg-white text-[#262626]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                      <div
                        className={`flex items-center gap-1 ${isMine ? "flex-row-reverse justify-end pr-0.5" : "pl-1"}`}
                      >
                        <span className="text-[11px] tabular-nums text-[#8e8e8e]">{m.createdAt}</span>
                        <button
                          type="button"
                          className="text-[10px] text-zinc-400 hover:text-rose-500"
                          onClick={() => void submitReport("message", m.id, m.body)}
                        >
                          通報
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatScrollAnchorRef} className="h-px w-full shrink-0" aria-hidden />
          </div>

          <form
            className="flex shrink-0 items-end gap-2 border-t border-[#dbdbdb] bg-[#fafafa] p-2"
            onSubmit={(e) => void addMessage(e)}
          >
            <input
              ref={chatAttachmentInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setChatAttachmentName(f.name);
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === "string") setChatAttachmentPreview(reader.result);
                };
                reader.readAsDataURL(f);
                trackOpsEvent("chat_attachment_selected");
              }}
            />
            <textarea
              className="max-h-32 min-h-[44px] flex-1 resize-y rounded-3xl border border-[#dbdbdb] bg-white px-3 py-2.5 text-base text-[#262626] outline-none focus:border-[#a8a8a8]"
              placeholder="メッセージ…"
              value={chatBody}
              onChange={(e) => setChatBody(e.target.value)}
              required
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!chatBody.trim() || busy || requiresLogin) return;
                  void addMessage();
                }
              }}
            />
            <button
              type="button"
              className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-base text-zinc-700 transition hover:bg-zinc-50"
              onClick={() => chatAttachmentInputRef.current?.click()}
              title="添付"
              aria-label="添付ファイルを選択"
            >
              ＋
            </button>
            <button
              type="submit"
              disabled={busy || requiresLogin || !chatBody.trim()}
              className="mb-0.5 flex h-11 min-w-[4.5rem] shrink-0 items-center justify-center rounded-lg bg-[#0095f6] text-sm font-semibold text-white transition hover:bg-[#1877f2] disabled:cursor-not-allowed disabled:opacity-50"
            >
              送信
            </button>
          </form>
          {showMentionHelper ? (
            <div className="shrink-0 border-t border-zinc-200 bg-white px-3 py-1.5">
              <p className="text-[10px] font-semibold text-zinc-500">メンション候補</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {mentionCandidates.map((name) => (
                  <button
                    key={`mention-${name}`}
                    type="button"
                    className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-700"
                    onClick={() => setChatBody((prev) => prev.replace(/(^|\s)@\S*$/, `$1@${name} `))}
                  >
                    @{name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {chatAttachmentPreview ? (
            <div className="shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- local attachment preview */}
                <img src={chatAttachmentPreview} alt="" className="h-10 w-10 rounded object-cover" />
                <span className="max-w-[14rem] truncate text-xs text-zinc-600">{chatAttachmentName}</span>
              </div>
            </div>
          ) : null}
          {callRoom ? (
            <p className="shrink-0 border-t border-[#efefef] bg-white px-3 py-2 text-center text-[11px] text-[#8e8e8e]">
              通話ルーム:{" "}
              <code className="rounded bg-[#efefef] px-1 py-0.5 font-mono text-[10px] text-[#262626]">{callRoom}</code>
              {callUrl ? (
                <>
                  {" · "}
                  <a className="font-semibold text-[#0095f6] underline underline-offset-2" href={callUrl} target="_blank" rel="noreferrer">
                    開く
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
            </>
          )}
        </section>
      </main>
      {activeProfileMember ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onClick={() => setActiveProfileMember(null)}>
          <div
            className="w-full max-w-md rounded-t-2xl border border-[#e5e7eb] bg-white p-4 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-[#262626]">{activeProfileMember.name}</p>
                <p className="mt-1 text-sm text-[#4b5563]">{activeProfileMember.goal}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-[#d1d5db] px-2.5 py-1 text-xs text-[#4b5563] hover:bg-[#f9fafb]"
                onClick={() => setActiveProfileMember(null)}
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-semibold text-[#3730a3]">
                {AI_MATCH_TYPE_META[activeProfileMember.aiType ?? inferAiTypeFromMember(activeProfileMember)].label}
              </span>
              <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[11px] text-[#4b5563]">
                {activeProfileMember.strength}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeProfileMember.id && followingIds.includes(activeProfileMember.id)
                    ? "border border-[#bbf7d0] bg-[#dcfce7] text-[#166534]"
                    : "border border-[#dbeafe] bg-[#eff6ff] text-[#1d4ed8] hover:bg-[#dbeafe]"
                }`}
                disabled={!activeProfileMember.id}
                onClick={() => {
                  if (!activeProfileMember.id) return;
                  void toggleFollow(activeProfileMember.id);
                }}
              >
                {!activeProfileMember.id
                  ? "フォロー不可"
                  : followingIds.includes(activeProfileMember.id)
                    ? "フォロー中"
                    : "フォロー"}
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#111827] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!activeProfileMember.id || !canUseDmWith(activeProfileMember.id)}
                onClick={() => {
                  if (!activeProfileMember.id) return;
                  void openDmFromMatch(activeProfileMember.id, activeProfileMember.name);
                  setActiveProfileMember(null);
                }}
              >
                DMする
              </button>
            </div>
            {!activeProfileMember.id ? (
              <p className="mt-2 text-xs text-[#8e8e8e]">このユーザーはデモ表示のみです。</p>
            ) : null}
          </div>
        </div>
      ) : null}
      {followListModal ? (
        <div className="fixed inset-0 z-[72] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onClick={() => setFollowListModal(null)}>
          <div className="w-full max-w-md rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-zinc-900">{followListModal === "followers" ? "フォロワー" : "フォロー中"}</h4>
              <button type="button" className={secondaryButtonClass} onClick={() => setFollowListModal(null)}>閉じる</button>
            </div>
            <ul className="mt-3 space-y-2">
              {(followListModal === "followers"
                ? visibleFollowSuggestions.slice(0, Math.max(3, followerCount || 3))
                : visibleFollowSuggestions.filter((u) => followingIds.includes(u.id))).map((u) => (
                <li key={`follow-modal-${followListModal}-${u.id}`} className="rounded-lg border border-zinc-200 px-3 py-2">
                  <p className="text-sm font-semibold text-zinc-900">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.goal}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
        </div>
      </div>

      <nav
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/90 bg-white/95 shadow-[0_-8px_24px_-20px_rgba(15,23,42,0.5)] backdrop-blur pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1"
        aria-label="メイン機能の切り替え"
      >
        <div className="mx-auto flex w-full max-w-full flex-nowrap justify-between gap-0 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-2 [&::-webkit-scrollbar]:hidden">
          {featureItems.map((item) => (
            <button
              key={item.key}
              className={`keep-bottom-nav relative min-w-[3.5rem] shrink-0 sm:min-w-0 sm:flex-1 ${bottomNavButtonClass(item.key)} ${
                activePage === item.key
                  ? "after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:h-0.5 after:w-7 after:-translate-x-1/2 after:rounded-full after:bg-sky-500"
                  : ""
              }`}
              type="button"
              onClick={() => {
                if (item.key === "chat") setChatSubView("list");
                setActivePage(item.key);
              }}
              aria-label={
                item.key === "chat" && totalTalkUnread > 0
                  ? `${featureLabels[language][item.key]}${
                      language === "ja" ? `、未読${totalTalkUnread}件` : `, ${totalTalkUnread} unread`
                    }`
                  : featureLabels[language][item.key]
              }
              title={featureLabels[language][item.key]}
            >
              <span className="text-[1.35rem] leading-none">{item.icon}</span>
              <span className="max-w-[4.75rem] truncate leading-tight">{featureLabels[language][item.key]}</span>
              {item.key === "chat" && totalTalkUnread > 0 && activePage !== "chat" ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                  {totalTalkUnread > 99 ? "99+" : totalTalkUnread}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>
      <style jsx global>{`
        button:not(.keep-bottom-nav) {
          border-color: #111827;
        }
      `}</style>
    </div>
  );
}
