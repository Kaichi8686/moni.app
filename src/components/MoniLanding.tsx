"use client";

import { useCallback, useEffect, useState } from "react";

type MoniLandingProps = {
  onStart: () => void;
  onPreview: () => void;
  /** ログイン済みで「サービス説明」を見ているとき。CTAを「アプリに戻る」に切り替え */
  resumeMode?: boolean;
  onMount?: () => void;
};

const navLinkClass =
  "shrink-0 rounded-full border border-zinc-200/90 bg-white/90 px-3.5 py-1.5 text-[12px] font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/15 focus-visible:ring-offset-2";

const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 focus-visible:ring-offset-2 sm:text-sm";
const btnSecondary =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2";

function SectionTitle({
  id,
  headingId,
  eyebrow,
  title,
  lead,
}: {
  id?: string;
  headingId?: string;
  eyebrow: string;
  title: string;
  lead: string;
}) {
  return (
    <header id={id} className="mx-auto max-w-3xl text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-600">{eyebrow}</p>
      <h2 id={headingId} className="mt-2 text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">{lead}</p>
    </header>
  );
}

const SECTION_SCROLL =
  "scroll-mt-28 sm:scroll-mt-32";

export function MoniLanding({ onStart, onPreview, resumeMode = false, onMount }: MoniLandingProps) {
  const [navSolid, setNavSolid] = useState(false);

  const onScroll = useCallback(() => {
    setNavSolid(window.scrollY > 24);
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
    onMount?.();
  }, [onMount]);

  const primaryLabel = resumeMode ? "アプリに戻る" : "無料で始める";
  const heroPrimaryLabel = resumeMode ? "アプリに戻る" : "Googleで無料登録";
  const heroSecondaryLabel = resumeMode ? "このページを閉じる" : "ログインせずに画面を見る";
  const finalPrimaryLabel = resumeMode ? "アプリに戻る" : "無料で登録して始める";
  const finalSecondaryLabel = resumeMode ? "閉じる" : "先にアプリの画面だけ見る";

  const handleResumeSecondary = () => {
    if (resumeMode) onStart();
    else onPreview();
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-zinc-50 via-white to-zinc-100 text-zinc-900 antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-lg focus:ring-2 focus:ring-zinc-900/20"
      >
        メインへスキップ
      </a>

      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background,box-shadow,border-color] duration-200 ${
          navSolid ? "border-zinc-200/90 bg-white/95 shadow-sm backdrop-blur-md" : "border-transparent bg-white/70 backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="#main" className="text-sm font-bold tracking-tight text-zinc-900 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20">
            moni
          </a>
          <nav className="hidden items-center gap-6 text-[13px] font-medium text-zinc-600 md:flex" aria-label="ページ内">
            <a href="#empathy" className="transition hover:text-zinc-900">
              はじめに
            </a>
            <a href="#features" className="transition hover:text-zinc-900">
              できること
            </a>
            <a href="#flow" className="transition hover:text-zinc-900">
              流れ
            </a>
            <a href="#cases" className="transition hover:text-zinc-900">
              活用例
            </a>
            <a href="#outputs" className="transition hover:text-zinc-900">
              成果例
            </a>
            <a href="#faq" className="transition hover:text-zinc-900">
              FAQ
            </a>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {!resumeMode ? (
              <>
                <button type="button" className={`${btnSecondary} hidden px-3 py-2 text-xs sm:inline-flex`} onClick={onPreview}>
                  中身を見る
                </button>
                <button type="button" className={`${btnPrimary} px-4 py-2 text-xs sm:text-sm`} onClick={onStart}>
                  {primaryLabel}
                </button>
              </>
            ) : (
              <button type="button" className={`${btnPrimary} px-4 py-2 text-xs sm:text-sm`} onClick={onStart}>
                アプリに戻る
              </button>
            )}
          </div>
        </div>
        {/* モバイル: 横スクロールのクイックナビ */}
        <nav
          className="flex border-t border-zinc-100/80 bg-zinc-50/90 px-3 py-2.5 md:hidden"
          aria-label="セクションへ移動"
        >
          <div className="flex w-full gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              ["#empathy", "はじめに"],
              ["#features", "できること"],
              ["#flow", "流れ"],
              ["#cases", "活用例"],
              ["#outputs", "成果例"],
              ["#trust", "安心"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a key={href} href={href} className={navLinkClass}>
                {label}
              </a>
            ))}
          </div>
        </nav>
      </header>

      <main id="main">
        {/* 1. ファーストビュー */}
        <section className={`relative px-4 pb-20 pt-[7.25rem] sm:px-6 sm:pb-28 sm:pt-36 ${SECTION_SCROLL}`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(56,189,248,0.18),transparent_65%)]" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] sm:opacity-40"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(24,24,27,0.06) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(24,24,27,0.06) 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
            }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-800">高校生・大学生のビジネス・探究チーム向け</p>
            <h1 className="mt-5 text-[1.7rem] font-bold leading-snug tracking-tight text-zinc-950 sm:text-4xl md:text-[2.75rem] md:leading-[1.12]">
              アイデアで終わらせない。
              <br className="hidden sm:inline" />
              <span className="text-zinc-800">企画を「実行」と「記録」に変える。</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-zinc-600 sm:text-lg">
              moniは、AIとの壁打ちだけではありません。タイムラインで発信し、検索から仲間を見つけ、チャットで動線を決め、ピッチや知恵袋で検証します。
              <span className="font-medium text-zinc-700">「やってみた」を残せる</span>
              のが強みです。
            </p>
            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
              <button type="button" className={btnPrimary} onClick={onStart}>
                {heroPrimaryLabel}
              </button>
              <button type="button" className={btnSecondary} onClick={handleResumeSecondary}>
                {heroSecondaryLabel}
              </button>
            </div>
            {!resumeMode ? (
              <p className="mt-5 text-xs leading-relaxed text-zinc-500">
                登録後はプロフィールから、ユーザーネーム・探究テーマ・DMの許可範囲を設定できます。
              </p>
            ) : (
              <p className="mt-5 text-xs text-zinc-500">サービス概要を確認したら「アプリに戻る」で作業を再開できます。</p>
            )}
          </div>
        </section>

        {/* 2. 共感 */}
        <section
          id="empathy"
          className={`border-y border-zinc-200/80 bg-white px-4 py-16 sm:px-6 sm:py-24 ${SECTION_SCROLL}`}
          aria-labelledby="empathy-title"
        >
          <div className="mx-auto max-w-5xl">
            <SectionTitle
              headingId="empathy-title"
              eyebrow="共感"
              title="こんなモヤモヤ、ありませんか？"
              lead="抽象語ではなく、文化祭・部活・探究・チャレンジの現場でよく聞く声です。"
            />
            <ul className="mx-auto mt-12 grid max-w-3xl gap-4 sm:gap-5">
              {[
                "企画書は書いたのに「誰に何を頼むか」まで落とし込めない",
                "起業やビジネスに興味はあるが、一人だと続かない",
                "探究のテーマは決まったが、検証の進め方があいまい",
                "同じ熱量で壁打ちしてくれる仲間が欲しい（クラスチャットでは言いにくい）",
                "発表前一週だけ頑張るのではなく、過程も振り返りたい",
              ].map((text) => (
                <li
                  key={text}
                  className="flex gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/90 px-4 py-3.5 text-left text-sm leading-relaxed text-zinc-800 sm:text-[15px]"
                >
                  <span className="mt-0.5 shrink-0 text-sky-600" aria-hidden>
                    ●
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3. サービスでできること */}
        <section id="features" className={`px-4 py-16 sm:px-6 sm:py-24 ${SECTION_SCROLL}`}>
          <div className="mx-auto max-w-6xl">
            <SectionTitle
              eyebrow="機能"
              title="moniでできること（つながりの中で使う）"
              lead="単体ツールではなく、発信→出会い→対話→検証→記録までを想定した流れです。"
            />
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  k: "AIメンター",
                  t: "壁打ちと宿題の整理",
                  d: "「誰のどんな課題を」「どんな順で」「何をもって成功とするか」をチャットで整理。レポート直前だけでなく、平日の隙間にも。",
                },
                {
                  k: "投稿タイムライン",
                  t: "進捗を短く発信する",
                  d: "画像付き投稿で試行錯誤を記録。いいね・コメントでフィードバックを集められます。",
                },
                {
                  k: "記事・ピッチ",
                  t: "思想と根拠を長文でまとめる",
                  d: "先生・メンター・仲間に渡すインタビュー記事やピッチのたたき台に。",
                },
                {
                  k: "アイデア知恵袋",
                  t: "「どう進める？」をみんなに聞く",
                  d: "質問と回答に、質問者本人がベストアンサーを決定。納得した一手を記録に残せます。",
                },
                {
                  k: "検索・チャット",
                  t: "タイプやキーワードで仲間を探す",
                  d: "プロフィールからDM・グループ・通話へ。マッチングは学校外の協業向けに。",
                },
                {
                  k: "アカウント・フォロー",
                  t: "続きの関係のためのプロフィール",
                  d: "ユーザーネーム・探究の関心・DM許可など、協業に必要な情報だけ。",
                },
              ].map((item) => (
                <article
                  key={item.k}
                  className="flex flex-col rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm ring-1 ring-black/[0.03] transition hover:border-zinc-300 hover:shadow-md"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600">{item.k}</p>
                  <h3 className="mt-2 text-base font-bold text-zinc-900">{item.t}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">{item.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4. 利用の流れ */}
        <section id="flow" className={`border-y border-zinc-200/80 bg-zinc-50/90 px-4 py-16 sm:px-6 sm:py-24 ${SECTION_SCROLL}`}>
          <div className="mx-auto max-w-5xl">
            <SectionTitle
              eyebrow="流れ"
              title="利用の流れ（初日から意味のある一歩）"
              lead="長い研修のあとで使うアプリではなく、今日の小さな行動から入れます。"
            />
            <ol className="mx-auto mt-14 grid max-w-3xl gap-7 sm:gap-9">
              {[
                { step: "01", title: "Googleで登録", body: "学校・個人のメールどちらでも可。ユーザーネームと、探究・ビジネスの関心を書きます。" },
                { step: "02", title: "進捗を1つ投稿 or 知恵袋で質問", body: "困っていることを一文にすると、返ってきやすいです。" },
                { step: "03", title: "検索で仲間をフォローし、DMで具体化", body: "誰に何を依頼するか、期限はいつか。議題まで落とします。" },
                { step: "04", title: "AIと整理し、ピッチや記事に落とす", body: "壁打ちの内容をピッチ・記事・発表資料の骨子に。" },
                { step: "05", title: "知恵袋・投稿で振り返り", body: "いいね数より「次の行動が決まったか」で振り返ると成長が見えます。" },
              ].map((row) => (
                <li key={row.step} className="flex gap-4 sm:gap-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 font-mono text-sm font-bold text-white shadow-sm">
                    {row.step}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">{row.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{row.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. ユースケース */}
        <section id="cases" className={`px-4 py-16 sm:px-6 sm:py-24 ${SECTION_SCROLL}`}>
          <div className="mx-auto max-w-6xl">
            <SectionTitle
              eyebrow="活用例"
              title="こんな場面で使われています"
              lead="部活・探究・有志のプロジェクトに合わせて、機能の組み合わせを変えられます。"
            />
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {[
                {
                  title: "文化祭・学園祭の模擬店・ステージ企画",
                  body: "タイムラインで準備ログ → 検索でデザインや音響に強いメンバーへDM → AIで当日の動線とリスク整理 → ピッチで教員に予算説明。",
                },
                {
                  title: "探究・総合的な探究の時間",
                  body: "知恵袋で検証デザインを公募 → ベストアンサーを記録に残す → メンターAIでスライド構成を詰める。",
                },
                {
                  title: "ビジコン・ハッカソン前のチーム編成",
                  body: "キーワード検索で補助金・開発・訴求が得意なメンバーをフォロー → グループチャットで仕様すり合わせ。",
                },
                {
                  title: "アルバイト先・地域イベントの改善提案",
                  body: "投稿で現場メモを蓄積 → 記事にまとめて店長や地域に共有 → コメントで改善案を募る。",
                },
              ].map((c) => (
                <article key={c.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/[0.03]">
                  <h3 className="text-base font-bold text-zinc-900">{c.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">{c.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 6. アウトプット例 */}
        <section id="outputs" className={`border-y border-zinc-200/80 bg-white px-4 py-16 sm:px-6 sm:py-24 ${SECTION_SCROLL}`}>
          <div className="mx-auto max-w-5xl">
            <SectionTitle
              eyebrow="成果の形"
              title="アウトプットの例（イメージ）"
              lead="サービス内で残せる「形」の例です。提出形式は学校の指示に合わせて転記してください。"
            />
            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <figure className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 text-left shadow-xl ring-1 ring-white/10">
                <figcaption className="border-b border-zinc-800 px-4 py-2.5 text-[11px] font-medium text-zinc-400">
                  30秒ピッチ草稿
                </figcaption>
                <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed text-emerald-100 sm:text-[13px]">
                  {`【誰向け】昼休みに昼寝したいが席がない高校生
【課題】体育マットは奪い合い、図書室は静粛
【解決】空教室を15分単位で予約できる枕＋マットの貸出
【今週やること】生徒会に空教室リストの掲載を依頼する`}
                </pre>
              </figure>
              <figure className="overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm ring-1 ring-black/[0.03]">
                <figcaption className="border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 text-[11px] font-medium text-zinc-500">
                  知恵袋まとめ（質問者メモ）
                </figcaption>
                <div className="space-y-2 p-4 text-sm leading-relaxed text-zinc-700">
                  <p>
                    <span className="font-semibold text-zinc-900">質問：</span>
                    商品写真を撮る予算が5000円しかない。スマホだけで十分そう？
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-800">ベストアンサー：</span>
                    まず自然光＋白い紙の反射で十分。予算は三脚代に回してブレ対策。
                  </p>
                  <p className="text-xs text-zinc-500">→ 次の行動：明日放課後、窓際で10枚試し撮り。</p>
                </div>
              </figure>
            </div>
          </div>
        </section>

        {/* 7. 安心・信頼 */}
        <section id="trust" className={`px-4 py-16 sm:px-6 sm:py-24 ${SECTION_SCROLL}`}>
          <div className="mx-auto max-w-5xl">
            <SectionTitle
              eyebrow="安心して使うために"
              title="安全・データ・AIの位置づけ"
              lead="公開範囲と相手を選べる設計です。未成年の利用は保護者の同意のもとを推奨します。"
            />
            <div className="mx-auto mt-12 max-w-3xl space-y-5 text-sm leading-relaxed text-zinc-700">
              <p>
                <span className="font-semibold text-zinc-900">ログイン：</span>
                Googleアカウントによる認証（Supabase Auth）。
              </p>
              <p>
                <span className="font-semibold text-zinc-900">つながり方：</span>
                プロフィールでDMの許可範囲を選べます。
              </p>
              <p>
                <span className="font-semibold text-zinc-900">不快な内容：</span>
                投稿・メッセージ・プロフィールから通報可能です。
              </p>
              <p>
                <span className="font-semibold text-zinc-900">AIの回答：</span>
                参考用の整理支援です。提出物・契約・投資の最終判断は必ず人が行ってください。
              </p>
            </div>
          </div>
        </section>

        {/* 8. おすすめユーザー像 */}
        <section id="personas" className={`border-y border-zinc-200/80 bg-zinc-50/80 px-4 py-16 sm:px-6 sm:py-24 ${SECTION_SCROLL}`}>
          <div className="mx-auto max-w-6xl">
            <SectionTitle
              eyebrow="こんな人におすすめ"
              title="刺さりやすいユーザー像"
              lead="すべて当てはまる必要はありません。「1つでも心当たりがあれば」試す価値があります。"
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "文化祭・有志で売上と分担をリアルに考えたい高校生",
                "ビジコン・スタートアップイベントに出る大学・高専のチーム",
                "探究テーマはあるが検証設計とパートナー探しが課題の学生",
                "SNSに書ききれない思考ログを残したい起業志向の若者",
              ].map((t) => (
                <div
                  key={t}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-800 shadow-sm ring-1 ring-black/[0.03]"
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. FAQ */}
        <section id="faq" className={`px-4 py-16 sm:px-6 sm:py-24 ${SECTION_SCROLL}`}>
          <div className="mx-auto max-w-3xl">
            <SectionTitle eyebrow="FAQ" title="よくある質問" lead="利用前の疑問にお答えします。" />
            <div className="mt-12 space-y-3">
              {[
                {
                  q: "無料ですか？",
                  a: "現状の機能は無料で利用できる想定です。将来的に有料エリアがあればアプリ内で案内します。",
                },
                {
                  q: "学校の課題にそのまま使えますか？",
                  a: "探究ノートの代替ではなく、仲間探し・検証・発信の行動の場です。提出形式は学校の指示に合わせてコピーしてください。",
                },
                {
                  q: "誰でも私の投稿が見えますか？",
                  a: "タイムラインは多くのユーザーが閲覧できる公開エリアです。個別の相談はDMや知恵袋の使い分けがおすすめです。",
                },
                {
                  q: "部活動の顧問や先生にも見せていい？",
                  a: "構いません。進捗共有として記事やピッチを渡す想定です。",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm open:border-zinc-300 open:shadow-md"
                >
                  <summary className="cursor-pointer list-none font-semibold text-zinc-900 outline-none marker:content-none [&::-webkit-details-marker]:hidden focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-zinc-900/15">
                    <span className="inline-flex w-full items-center justify-between gap-2 pr-1">
                      {item.q}
                      <span className="text-zinc-400 transition duration-200 group-open:rotate-180" aria-hidden>
                        ▼
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 border-t border-zinc-100 pt-3 text-sm leading-relaxed text-zinc-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 10. 最終CTA */}
        <section className="border-t border-zinc-200 bg-gradient-to-b from-white to-zinc-100 px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">今日の一行を、行動に変えよう。</h2>
            <p className="mt-5 text-sm leading-relaxed text-zinc-600 sm:text-base">
              {resumeMode
                ? "概要の確認は以上です。アプリに戻って、投稿・検索・知恵袋から続きを。"
                : "登録は1分ほど。Googleアカウントで入り、プロフィールに「いま挑戦していること」を一行書いてみてください。"}
            </p>
            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
              <button type="button" className={btnPrimary} onClick={onStart}>
                {finalPrimaryLabel}
              </button>
              <button type="button" className={btnSecondary} onClick={handleResumeSecondary}>
                {finalSecondaryLabel}
              </button>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-200 bg-zinc-50 px-4 py-10 text-center sm:px-6">
          <p className="text-xs leading-relaxed text-zinc-500">
            © {new Date().getFullYear()} moni · 挑戦する学生のための実行と記録のプラットフォーム
          </p>
          <p className="mx-auto mt-3 max-w-md text-[11px] leading-relaxed text-zinc-400">
            本ページの内容はサービス概要です。機能はアップデートにより変わる場合があります。
          </p>
        </footer>
      </main>
    </div>
  );
}
