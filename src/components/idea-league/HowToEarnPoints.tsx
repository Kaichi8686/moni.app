"use client";

import { DuoButton } from "@/components/idea-garden/DuoButton";
import { AI_PROMOTION_LINE } from "@/lib/idea-league/aiReview";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  onStart?: () => void;
  compact?: boolean;
};

export function HowToEarnPoints({ onStart, compact }: Props) {
  const { tx } = useI18n();

  const steps = [
    {
      n: "1",
      title: tx("アイデアを提出", "Submit an idea"),
      body: tx("今週のお題に答える", "Answer this week's prompt"),
    },
    {
      n: "2",
      title: tx("AIが勝ち点を採点", "AI awards points"),
      body: tx("判定でフィードバック付き", "Score + short feedback"),
    },
    {
      n: "3",
      title: tx(`${AI_PROMOTION_LINE}ptで昇格`, `Hit ${AI_PROMOTION_LINE}pt to promote`),
      body: tx("ラインを超えて次のリーグへ", "Cross the line, climb tiers"),
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-orange-200/80 bg-gradient-to-br from-[#FF9600] via-[#FF7A1A] to-[#F97316] p-[1px] shadow-[0_10px_30px_rgba(255,150,0,0.22)]">
      <div className="rounded-[15px] bg-[#1C1410]/95 px-4 py-4 text-white sm:px-5">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-orange-200/90 uppercase">
          {tx("勝ち点の稼ぎ方", "How to earn points")}
        </p>
        <h2 className="mt-1 text-lg font-bold tracking-tight sm:text-xl">
          {tx("提出 → AI判定 → 昇格", "Submit → AI review → Promote")}
        </h2>
        {!compact ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-orange-50/80">
            {tx(
              "ユーザー投票はまだ使いません。アイデアを出すほど勝ち点が入ります。",
              "No peer votes yet — submitting ideas is how you score.",
            )}
          </p>
        ) : null}

        <ol className={`mt-4 grid gap-2 ${compact ? "" : "sm:grid-cols-3"}`}>
          {steps.map((s) => (
            <li
              key={s.n}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm"
            >
              <p className="text-[11px] font-bold text-orange-300">STEP {s.n}</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{s.title}</p>
              <p className="mt-0.5 text-[11px] text-orange-50/70">{s.body}</p>
            </li>
          ))}
        </ol>

        {onStart ? (
          <div className="mt-4">
            <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={onStart}>
              {tx("今すぐアイデアを出す", "Submit an idea now")}
            </DuoButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}
