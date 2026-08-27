"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FolderKanban,
  Lightbulb,
  MessageCircleQuestion,
  Mic2,
  Rocket,
  Users,
} from "lucide-react";
import { LandingFlowTimeline, type FlowStep } from "@/components/landing/LandingFlowTimeline";
import { useI18n } from "@/lib/i18n/I18nProvider";

type MoniLandingProps = {
  onStart: () => void;
  onPreview: () => void;
  resumeMode?: boolean;
  onMount?: () => void;
};

const SIGNUP_HREF_PLACEHOLDER = "/login"; // TODO: 本番の新規登録URLに差し替え

const ctaPrimaryClass =
  "group inline-flex min-h-[40px] touch-manipulation items-center justify-center gap-1.5 rounded-md bg-sky-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-sky-500 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/35 focus-visible:ring-offset-2 sm:px-5 sm:text-sm";
const ctaSecondaryClass =
  "inline-flex min-h-[40px] touch-manipulation items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-[13px] font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300/60 focus-visible:ring-offset-2 sm:text-sm";
const ctaHeroPrimaryClass =
  "group inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2 rounded-md bg-sky-600 px-6 text-[15px] font-semibold text-white shadow-sm transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/35 focus-visible:ring-offset-2 sm:w-auto sm:min-w-[200px]";

function SectionHeader({
  eyebrow,
  title,
  body,
  id,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  id?: string;
}) {
  return (
    <header className="max-w-3xl">
      <p className="text-[13px] font-medium tracking-[-0.01em] text-sky-700">{eyebrow}</p>
      <h2
        id={id}
        className="mt-3 text-[1.85rem] font-semibold leading-[1.12] tracking-[-0.035em] text-zinc-950 sm:text-[2.35rem]"
      >
        {title}
      </h2>
      {body ? (
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-500 sm:text-base">{body}</p>
      ) : null}
    </header>
  );
}

function AppShot({
  locale,
  variant = "feed",
}: {
  locale: "ja" | "en";
  variant?: "feed" | "chat" | "qna";
}) {
  const labels =
    locale === "ja"
      ? {
          post: "投稿",
          home: "ホーム",
          projects: "プロジェクト",
          search: "検索",
          profile: "プロフィール",
          progress: "進捗共有",
          qna: "質問・相談",
        }
      : {
          post: "Post",
          home: "Home",
          projects: "Projects",
          search: "Search",
          profile: "Profile",
          progress: "Progress",
          qna: "Q&A",
        };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/8">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <span className="moni-wordmark text-lg">moni</span>
        <span className="rounded-md bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white">
          {labels.post}
        </span>
      </div>
      <div className="flex gap-5 border-b border-zinc-100 px-4 pt-2 text-[12px] font-medium">
        <span className="relative pb-2 text-zinc-900">
          {labels.progress}
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-600" />
        </span>
        <span className="pb-2 text-zinc-400">{labels.qna}</span>
      </div>
      {variant === "feed" ? (
        <div className="space-y-2.5 bg-zinc-50 p-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-[11px] font-semibold text-sky-700">
              {locale === "ja" ? "ビジネスアイデア" : "Business idea"}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
              {locale === "ja"
                ? "初回ユーザー5人にヒアリング。次は価値提案を1文に絞る。"
                : "Interviewed 5 first users. Next: sharpen one value proposition."}
            </p>
            <div className="mt-2 h-14 rounded-md border border-zinc-100 bg-zinc-50" />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-[11px] font-semibold text-sky-700">
              {locale === "ja" ? "検証メモ" : "Validation note"}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
              {locale === "ja"
                ? "インタビュー10件、仮説2つに絞る。"
                : "10 interviews, narrowed to 2 hypotheses."}
            </p>
          </div>
        </div>
      ) : null}
      {variant === "chat" ? (
        <div className="space-y-2 bg-zinc-50 p-3">
          <div className="max-w-[80%] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-700">
            {locale === "ja"
              ? "このアイデア、本当に課題解決になってる？"
              : "Does this idea really solve a problem?"}
          </div>
          <div className="ml-auto max-w-[82%] rounded-lg bg-sky-600 px-3 py-2 text-[13px] text-white">
            {locale === "ja"
              ? "客単価と回転数を分けて見よう。まずは客単価。"
              : "Split by average spend and turnover. Start with avg spend."}
          </div>
          <div className="max-w-[78%] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-700">
            {locale === "ja"
              ? "明日アンケート5件追加で取ってみる。"
              : "Let's collect 5 more surveys tomorrow."}
          </div>
        </div>
      ) : null}
      {variant === "qna" ? (
        <div className="bg-zinc-50 p-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-[11px] font-semibold text-sky-700">
              {locale === "ja" ? "知恵袋メモ" : "Q&A Note"}
            </p>
            <ul className="mt-2 space-y-1.5 text-[12px] text-zinc-600">
              <li>{locale === "ja" ? "1) 質問文を1行で具体化" : "1) Make your question concrete"}</li>
              <li>{locale === "ja" ? "2) ベストアンサーを採用" : "2) Pick a best answer"}</li>
              <li>{locale === "ja" ? "3) 次の検証タスクに変換" : "3) Turn it into next tasks"}</li>
            </ul>
          </div>
        </div>
      ) : null}
      <div className="flex justify-around border-t border-zinc-100 bg-white px-2 py-2.5 text-[10px] font-medium text-zinc-400">
        {[labels.home, labels.projects, labels.search, labels.profile].map((x, i) => (
          <span key={x} className={i === 0 ? "font-semibold text-zinc-800" : ""}>
            {x}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MoniLanding({ onStart, onPreview, resumeMode = false, onMount }: MoniLandingProps) {
  const { t, locale, setLocale } = useI18n();
  const [navSolid, setNavSolid] = useState(false);
  const onMountRef = useRef(onMount);
  onMountRef.current = onMount;

  const onScroll = useCallback(() => {
    setNavSolid(window.scrollY > 18);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("moni-landing-active");
    const raf = requestAnimationFrame(() => onScroll());
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("moni-landing-active");
      window.removeEventListener("scroll", onScroll);
    };
  }, [onScroll]);

  useEffect(() => {
    onMountRef.current?.();
  }, []);

  const ja = locale === "ja";
  const heroAudience = ja
    ? "高校生・大学生のビジネスアイデア実現チーム向け"
    : "For student teams turning business ideas into reality";
  const heroHook = ja ? "アイデアに舞台を" : "Give ideas a stage";
  const primary = ja ? "無料で始める" : "Start free";
  const secondary = ja ? "中身を先に見る" : "Preview the app";

  const stats = ja
    ? [
        { value: "—", label: "利用中の学校", note: "TODO: 実データ" },
        { value: "—", label: "登録ユーザー", note: "TODO: 実データ" },
        { value: "—", label: "投稿された企画", note: "TODO: 実データ" },
      ]
    : [
        { value: "—", label: "Schools", note: "TODO: live data" },
        { value: "—", label: "Users", note: "TODO: live data" },
        { value: "—", label: "Projects posted", note: "TODO: live data" },
      ];

  const pains = ja
    ? [
        {
          before: "ビジネスアイデアはあるのに、誰が何をやるか曖昧で前に進まない。",
          after: "moniで「誰が・いつまでに・何をやるか」を投稿に固定し、流れを止めない。",
        },
        {
          before: "思いついた案を説明するとき、価値と優先順位が散らかって伝わらない。",
          after: "知恵袋で他校の視点を集め、論点を3つに絞って先生向け説明にまとめられる。",
        },
        {
          before: "『次に何を検証するの？』と聞かれても具体的な一手が出ない。",
          after: "知恵袋で質問し、ベストアンサーを採用して次の検証計画に直結させる。",
        },
      ]
    : [
        {
          before: "You have a business idea, but roles are vague and execution stalls.",
          after: "Use moni posts to lock who does what by when.",
        },
        {
          before: "You can explain the idea, but priorities and value proposition are still messy.",
          after: "Gather perspectives in Q&A and narrow it down to three clear points for teachers.",
        },
        {
          before: "When asked what to validate next, you cannot answer concretely.",
          after: "Ask in Q&A, pick a best answer, and convert it to a next test.",
        },
      ];

  const features = ja
    ? [
        {
          marker: "01",
          title: "アイデア知恵袋",
          subtitle: "悩みを投げると、実行に使える答えが返ってくる",
          body: "アイデア段階の悩みを具体的な質問にして、ベストアンサーを次のタスクに変換する。",
          shot: "qna" as const,
        },
        {
          marker: "02",
          title: "タイムライン発信",
          subtitle: "進捗の見える化で、協力が集まりやすくなる",
          body: "作業ログが残るので「何をしている人か」が伝わる。初対面でも話が早い。",
          shot: "feed" as const,
        },
        {
          marker: "03",
          title: "検索・チャット",
          subtitle: "同じ熱量の仲間と、学校の外でもつながれる",
          body: "キーワードや関心で探して、そのままDM。企画の相談が日常の会話になる。",
          shot: "chat" as const,
        },
      ]
    : [
        {
          marker: "01",
          title: "Idea Q&A",
          subtitle: "Get practical answers you can execute",
          body: "Turn early-stage confusion into clear questions, pick best answers, and convert them into next tasks.",
          shot: "qna" as const,
        },
        {
          marker: "02",
          title: "Timeline",
          subtitle: "Visible progress attracts collaborators",
          body: "Your logs show what you are actually building, so conversations start faster.",
          shot: "feed" as const,
        },
        {
          marker: "03",
          title: "Search and chat",
          subtitle: "Connect beyond your school",
          body: "Find by keyword and interest, then jump into DMs to shape the plan together.",
          shot: "chat" as const,
        },
      ];

  const steps: FlowStep[] = ja
    ? [
        {
          n: 1,
          title: "アイデアを見つける",
          body: "モヤモヤから、ビジネスの種を掘り起こす。AI発掘インタビューが伴走します。",
          icon: Lightbulb,
          visualLabel: "アイデア · 発掘",
        },
        {
          n: 2,
          title: "プロジェクトにする",
          body: "種を深めて計画に落とし込む。ロードマップとタスクで形にします。",
          icon: FolderKanban,
          visualLabel: "プロジェクト",
        },
        {
          n: 3,
          title: "仲間と組む",
          body: "得意分野を持つ仲間とマッチングしてつながる。探すタブから見つけられます。",
          icon: Users,
          visualLabel: "探す · マッチング",
        },
        {
          n: 4,
          title: "実行する",
          body: "プロジェクト内の機能で、実現に向けて一歩ずつ進める。",
          icon: Rocket,
          visualLabel: "実行サポート",
        },
        {
          n: 5,
          title: "相談する",
          body: "迷ったらコミュニティで質問・相談。知恵袋が次の一手をくれます。",
          icon: MessageCircleQuestion,
          visualLabel: "ホーム · 質問相談",
        },
        {
          n: 6,
          title: "発表する",
          body: "望めば、アイデアを発表する場も用意。積み上げた記録がそのまま材料に。",
          icon: Mic2,
          visualLabel: "発表の場",
        },
      ]
    : [
        {
          n: 1,
          title: "Find an idea",
          body: "Dig business seeds from everyday friction with the AI idea interview.",
          icon: Lightbulb,
          visualLabel: "Ideas · Discover",
        },
        {
          n: 2,
          title: "Turn it into a project",
          body: "Deepen the seed into a plan with roadmaps and tasks.",
          icon: FolderKanban,
          visualLabel: "Projects",
        },
        {
          n: 3,
          title: "Build a team",
          body: "Match with peers who bring complementary skills from Search.",
          icon: Users,
          visualLabel: "Search · Match",
        },
        {
          n: 4,
          title: "Execute",
          body: "Use in-project tools to keep moving toward a real outcome.",
          icon: Rocket,
          visualLabel: "Execution",
        },
        {
          n: 5,
          title: "Ask for help",
          body: "When stuck, ask the community in Q&A and turn answers into next steps.",
          icon: MessageCircleQuestion,
          visualLabel: "Home · Q&A",
        },
        {
          n: 6,
          title: "Present",
          body: "When you want, present your idea — your records become the material.",
          icon: Mic2,
          visualLabel: "Showcase",
        },
      ];

  const voices = ja
    ? [
        {
          quote: "思いつきで終わっていた案が、1週間で検証タスクまで進んだ。",
          who: "高校2年・起業チーム",
          note: "TODO: 実名許諾後に差し替え",
        },
        {
          quote: "投稿と知恵袋を使うと、次にやることが毎回具体化できる。",
          who: "高校3年・ビジネス探究",
          note: "TODO: 実名許諾後に差し替え",
        },
        {
          quote: "大学のアイデア検証で、初対面メンバーとも役割分担が早く決まった。",
          who: "大学1年・起業サークル",
          note: "TODO: 実名許諾後に差し替え",
        },
      ]
    : [
        {
          quote: "Our idea moved from random notes to concrete validation tasks in a week.",
          who: "HS junior · startup team",
          note: "TODO: replace with approved quote",
        },
        {
          quote: "Posting plus Q&A makes our next action explicit every time.",
          who: "HS senior · business inquiry",
          note: "TODO: replace with approved quote",
        },
        {
          quote: "For idea validation, assigning roles with new teammates became much faster.",
          who: "College freshman · startup club",
          note: "TODO: replace with approved quote",
        },
      ];

  return (
    <div className="min-h-[100dvh] bg-white text-zinc-900 antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:px-3 focus:py-2 focus:shadow-lg"
      >
        {ja ? "メインへスキップ" : "Skip to main"}
      </a>

      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background,box-shadow,border-color] duration-300 ${
          navSolid
            ? "border-b border-zinc-200/80 bg-white shadow-sm md:bg-white/90 md:backdrop-blur-md"
            : "border-b border-transparent bg-white md:bg-white/70 md:backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3.5 sm:px-6">
          <a href="#main" className="moni-wordmark shrink-0 text-[18px]">
            {t("landingBrand")}
          </a>

          <nav
            className="ml-auto hidden items-center gap-5 text-[13px] font-medium text-zinc-500 lg:flex"
            aria-label={ja ? "ページ内リンク" : "Section links"}
          >
            <a href="#pain" className="transition hover:text-zinc-900">
              {ja ? "モヤモヤ" : "Pain"}
            </a>
            <a href="#features" className="transition hover:text-zinc-900">
              {ja ? "機能" : "Features"}
            </a>
            <a href="#flow" className="transition hover:text-zinc-900">
              {ja ? "流れ" : "Flow"}
            </a>
            <a href="#voices" className="transition hover:text-zinc-900">
              {ja ? "声" : "Voices"}
            </a>
            <a href="#faq" className="transition hover:text-zinc-900">
              FAQ
            </a>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3 lg:ml-0">
            <div
              className="flex items-center gap-1 text-[12px] font-medium text-zinc-400"
              role="group"
              aria-label={ja ? "言語" : "Language"}
            >
              <button
                type="button"
                className={`px-1.5 py-1 transition ${
                  locale === "ja" ? "font-semibold text-zinc-900" : "hover:text-zinc-700"
                }`}
                onClick={() => setLocale("ja")}
                aria-pressed={locale === "ja"}
              >
                JA
              </button>
              <span className="text-zinc-300" aria-hidden>
                /
              </span>
              <button
                type="button"
                className={`px-1.5 py-1 transition ${
                  locale === "en" ? "font-semibold text-zinc-900" : "hover:text-zinc-700"
                }`}
                onClick={() => setLocale("en")}
                aria-pressed={locale === "en"}
              >
                EN
              </button>
            </div>

            <button type="button" className={ctaPrimaryClass} onClick={onStart}>
              {resumeMode ? t("landingCtaResume") : primary}
              {!resumeMode ? (
                <span className="transition group-hover:translate-x-0.5" aria-hidden>
                  →
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-16 pt-[6.25rem] sm:px-6 sm:pb-24 sm:pt-32">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(14,165,233,0.08),transparent_55%)]"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16">
            <div className="text-left">
              <p className="moni-wordmark mb-5 text-[1.35rem] sm:text-[1.5rem]">{t("landingBrand")}</p>
              <p className="text-[14px] font-medium leading-snug tracking-[-0.01em] text-zinc-500 sm:text-[15px]">
                {heroAudience}
              </p>
              <h1 className="mt-4 max-w-full text-balance font-[family-name:var(--font-instrument-serif)] text-[clamp(2rem,9vw,2.4rem)] font-normal leading-[1.08] tracking-[-0.03em] text-zinc-950 sm:whitespace-nowrap sm:text-[4.25rem] sm:leading-[1.02]">
                {heroHook}
              </h1>
              {!resumeMode ? (
                <>
                  <div className="mt-9 flex max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:items-center">
                    <button
                      type="button"
                      className={ctaHeroPrimaryClass}
                      onClick={onStart}
                      data-signup-href={SIGNUP_HREF_PLACEHOLDER}
                    >
                      {primary}
                      <span className="transition group-hover:translate-x-0.5" aria-hidden>
                        →
                      </span>
                    </button>
                    <button type="button" className={ctaSecondaryClass} onClick={onPreview}>
                      {secondary}
                    </button>
                  </div>
                  <p className="mt-4 text-[12px] text-zinc-400">
                    {ja
                      ? "無料 · Googleアカウントで1分 · いつでも退会可"
                      : "Free · Google · ~1 min · Leave anytime"}
                  </p>
                </>
              ) : null}
            </div>

            <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
              <div className="moni-hero-rise">
                <AppShot locale={locale} variant="feed" />
              </div>
            </div>
          </div>
        </section>

        {/* Trust / stats */}
        <section
          className="border-y border-zinc-100 bg-zinc-50/80 px-4 py-10 sm:px-6 sm:py-12"
          aria-label={ja ? "利用状況" : "Traction"}
        >
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {stats.map((s) => (
              <article
                key={s.label}
                className="rounded-xl border border-zinc-200 bg-white px-5 py-5 shadow-sm shadow-zinc-900/[0.03] sm:px-6 sm:py-6"
                title={s.note}
              >
                <p className="font-[family-name:var(--font-geist-mono)] text-3xl font-medium tracking-[-0.04em] text-zinc-950 sm:text-4xl">
                  {s.value}
                </p>
                <p className="mt-2 text-[13px] font-medium text-zinc-500">{s.label}</p>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-5xl text-[11px] leading-relaxed text-zinc-400">
            {ja
              ? "※ 数値はプレースホルダーです。公開可能な実データ取得後に差し替えてください。"
              : "※ Metrics are placeholders. Replace with approved live data."}
          </p>
        </section>

        {/* Pain */}
        <section id="pain" className="bg-white px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              id="pain-title"
              eyebrow={ja ? "現場で起きること" : "What actually happens"}
              title={
                ja
                  ? "モヤモヤは、ビジネスアイデア実現の現場で起きている。"
                  : "The friction happens while turning ideas into real execution."
              }
              body={
                ja
                  ? "抽象的な課題ではなく、学校生活の具体シーンで起きる詰まりを解く。"
                  : "Not abstract productivity tips. Concrete situations in student life."
              }
            />

            <ul className="mt-12 space-y-3">
              {pains.map((row, idx) => (
                <li
                  key={row.before}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm shadow-zinc-900/[0.02]"
                >
                  <div className="grid sm:grid-cols-[1fr_auto_1fr]">
                    <div className="p-5 sm:p-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                        Before
                      </p>
                      <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">{row.before}</p>
                    </div>
                    <div className="flex items-center justify-center border-y border-zinc-100 bg-zinc-50 px-4 py-2 text-[11px] font-semibold tracking-wide text-zinc-500 sm:border-x sm:border-y-0">
                      {`CASE 0${idx + 1}`}
                    </div>
                    <div className="border-t border-zinc-100 bg-zinc-50/80 p-5 sm:border-t-0 sm:p-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-700">
                        With moni
                      </p>
                      <p className="mt-2 text-[14px] font-medium leading-relaxed text-zinc-900">
                        {row.after}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-y border-zinc-100 bg-zinc-50/60 px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              eyebrow={ja ? "できること" : "Features"}
              title={ja ? "機能は、単体ではなく連携して効く。" : "Features work best as a connected flow."}
              body={
                ja
                  ? "知恵袋→投稿→検索→チャットの往復で、アイデアが実行に変わる。"
                  : "Q&A, posting, search, and chat reinforce each other."
              }
            />

            <div className="mt-14 space-y-10 sm:space-y-14">
              {features.map((item, idx) => (
                <article
                  key={item.title}
                  className={`grid items-center gap-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-900/[0.03] sm:p-8 lg:grid-cols-2 lg:gap-12 ${
                    idx % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div>
                    <p className="font-[family-name:var(--font-geist-mono)] text-[12px] font-medium tracking-wide text-sky-700">
                      {item.marker}
                    </p>
                    <h3 className="mt-3 text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.03em] text-zinc-950 sm:text-[1.85rem]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-[15px] font-medium text-zinc-800">{item.subtitle}</p>
                    <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-zinc-500">
                      {item.body}
                    </p>
                  </div>

                  <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                    <AppShot locale={locale} variant={item.shot} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Flow */}
        <section id="flow" className="scroll-mt-24 bg-white px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              eyebrow={ja ? "流れ" : "Flow"}
              title={
                ja
                  ? "アイデアから発表まで、ひとつのアプリで"
                  : "From first spark to a stage-ready idea — in one app"
              }
              body={
                ja
                  ? "思いつきを、仲間と実行し、発表できる形にするまでの道筋です。"
                  : "A clear path from a rough idea to something you can ship and share."
              }
            />

            <LandingFlowTimeline steps={steps} locale={locale} />

            {!resumeMode ? (
              <div className="mt-10 flex justify-start">
                <button type="button" className={ctaHeroPrimaryClass} onClick={onStart}>
                  {primary}
                  <span className="transition group-hover:translate-x-0.5" aria-hidden>
                    →
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {/* Voices */}
        <section id="voices" className="border-y border-zinc-100 bg-zinc-50/60 px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionHeader
              eyebrow={ja ? "利用者の声" : "Voices"}
              title={
                ja
                  ? "使った学生の声（公開前プレースホルダー）"
                  : "Student voices (placeholder before publishing)"
              }
              body={
                ja
                  ? "公開可能なコメントに差し替える想定で、構造だけ先に作成。"
                  : "Structure is ready for approved real testimonials."
              }
            />

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {voices.map((v) => (
                <blockquote
                  key={v.quote}
                  className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-900/[0.02]"
                  title={v.note}
                >
                  <p className="text-[15px] font-medium leading-relaxed tracking-[-0.01em] text-zinc-800">
                    &ldquo;{v.quote}&rdquo;
                  </p>
                  <footer className="mt-5 border-t border-zinc-100 pt-4 text-[12px] font-medium text-zinc-500">
                    {v.who}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-white px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <SectionHeader eyebrow="FAQ" title={ja ? "よくある質問" : "FAQ"} />
            <div className="mt-10 space-y-2">
              {(ja
                ? [
                    {
                      q: "本当に無料ですか？",
                      a: "現状の機能は無料で使えます。将来有料エリアができる場合はアプリ内で案内します。",
                    },
                    {
                      q: "学校課題にそのまま使えますか？",
                      a: "探究ノートの代替ではなく、仲間探し・検証・発信の場です。提出形式は学校指定に合わせて転記してください。",
                    },
                    {
                      q: "投稿は誰でも見られますか？",
                      a: "タイムラインは多くのユーザーが見られる公開エリアです。個別相談はDMや知恵袋の使い分けを推奨します。",
                    },
                  ]
                : [
                    {
                      q: "Is it free?",
                      a: "Current features are free. Any paid areas will be announced in-app.",
                    },
                    {
                      q: "Can I submit this for school?",
                      a: "moni supports validation and teamwork. Copy outputs into your required format.",
                    },
                    {
                      q: "Are posts public?",
                      a: "Timeline posts are broadly visible. Use DMs and Q&A for sensitive topics.",
                    },
                  ]
              ).map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-zinc-200 bg-white p-4 open:border-zinc-300 open:shadow-sm"
                >
                  <summary className="cursor-pointer list-none text-[15px] font-semibold tracking-[-0.01em] text-zinc-900 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-2">
                      {item.q}
                      <span
                        className="text-zinc-300 transition group-open:rotate-180 group-open:text-zinc-500"
                        aria-hidden
                      >
                        ▼
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 border-t border-zinc-100 pt-3 text-[14px] leading-relaxed text-zinc-500">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-zinc-200 bg-zinc-950 px-4 py-20 text-white sm:px-6 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="moni-wordmark text-3xl text-white sm:text-4xl">{t("landingBrand")}</p>
              <h2 className="mt-5 max-w-full text-balance font-[family-name:var(--font-instrument-serif)] text-[clamp(1.75rem,8vw,2.1rem)] font-normal leading-[1.12] tracking-[-0.03em] sm:whitespace-nowrap sm:text-[3.25rem] sm:leading-[1.08]">
                {ja ? "アイデアに舞台を。" : "Give ideas a stage."}
              </h2>
              <p className="mt-5 max-w-[40ch] text-[15px] leading-relaxed text-zinc-400">
                {resumeMode
                  ? ja
                    ? "概要は以上です。アプリに戻って、続きの行動を進めてください。"
                    : "That's the overview. Return to the app and continue your work."
                  : ja
                    ? "最初の一行を投稿しよう。そこから仲間と実行が始まる。"
                    : "Post your first line. Execution with teammates starts there."}
              </p>
            </div>

            <div className="flex flex-col justify-center gap-3">
              {resumeMode ? (
                <button
                  type="button"
                  className="inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-md bg-white px-8 text-[15px] font-semibold text-zinc-900 transition hover:bg-zinc-100"
                  onClick={onStart}
                >
                  {t("landingCtaResume")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="group inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2 rounded-md bg-sky-500 px-8 text-[15px] font-semibold text-white transition hover:bg-sky-400"
                    onClick={onStart}
                  >
                    {primary}
                    <span className="transition group-hover:translate-x-0.5" aria-hidden>
                      →
                    </span>
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-zinc-400 underline-offset-4 transition hover:text-white hover:underline"
                    onClick={onPreview}
                  >
                    {secondary}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-100 bg-white px-4 py-10 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="moni-wordmark text-base">moni</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                © {new Date().getFullYear()} moni ·{" "}
                {ja
                  ? "挑戦する学生のための実行と記録のプラットフォーム"
                  : "Execution and record platform for student builders"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-zinc-400">
              {resumeMode ? (
                <button
                  type="button"
                  className="transition hover:text-zinc-700 hover:underline"
                  onClick={onStart}
                >
                  {t("landingCtaResume")}
                </button>
              ) : (
                <>
                  <Link href="/login" className="transition hover:text-zinc-700 hover:underline">
                    {ja ? "ログイン" : "Log in"}
                  </Link>
                  <button
                    type="button"
                    className="transition hover:text-zinc-700 hover:underline"
                    onClick={onPreview}
                  >
                    {ja ? "アプリを先に見る" : "Preview app"}
                  </button>
                </>
              )}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
