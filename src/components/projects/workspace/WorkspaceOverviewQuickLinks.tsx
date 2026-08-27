"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  Calendar,
  CircleDot,
  GanttChartSquare,
  Lightbulb,
  MessageSquare,
  PenSquare,
  Radio,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

const LINKS = [
  { id: "coach", label: "相談AI", labelEn: "Ask AI", desc: "困ったときにすぐ相談", descEn: "Ask when you get stuck", icon: Sparkles, featured: true },
  { id: "roadmap", label: "ロードマップ", labelEn: "Roadmap", desc: "フェーズと完成日", descEn: "Phases and due date", icon: GanttChartSquare },
  { id: "issues", label: "課題", labelEn: "Issues", desc: "タスク一覧・カンバン", descEn: "List and board", icon: CircleDot },
  { id: "business-idea", label: "ビジネスアイデア", labelEn: "Business idea", desc: "最初の種をインタビューで探す", descEn: "Find a starting seed", icon: Search },
  { id: "schedule", label: "予定", labelEn: "Schedule", desc: "カレンダー", descEn: "Calendar", icon: Calendar },
  { id: "whiteboard", label: "ホワイトボード", labelEn: "Whiteboard", desc: "無限キャンバスで描く", descEn: "Infinite canvas", icon: PenSquare },
  { id: "ideas", label: "投票", labelEn: "Vote", desc: "テーマごとに選択肢へ投票する", descEn: "Vote on options", icon: Lightbulb },
  { id: "chat", label: "チャット", labelEn: "Chat", desc: "チームの会話", descEn: "Team chat", icon: MessageSquare },
  { id: "members", label: "メンバー", labelEn: "Members", desc: "参加メンバー", descEn: "People in this project", icon: Users },
  { id: "activity", label: "活動", labelEn: "Activity", desc: "最近の更新", descEn: "Recent updates", icon: Radio },
] as const;

export function WorkspaceOverviewQuickLinks({ projectId }: { projectId: string }) {
  const { locale } = useI18n();
  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {LINKS.map((item) => {
        const Icon = item.icon;
        const href = `/projects/${projectId}/${item.id}`;
        const label = locale === "en" ? item.labelEn : item.label;
        const desc = locale === "en" ? item.descEn : item.desc;
        return (
          <Link
            key={item.id}
            href={href}
            className={`flex items-start gap-3 rounded-lg border px-3 py-3 transition ${
              "featured" in item && item.featured
                ? "border-violet-200 bg-violet-50/70 hover:border-violet-300 hover:bg-violet-50"
                : "border-[#E5E7EB] bg-white hover:border-violet-200 hover:bg-violet-50/40"
            }`}
          >
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                "featured" in item && item.featured ? "bg-violet-100 text-violet-700" : "bg-[#F7F8F8] text-[#5E6AD2]"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-[#1A1A1A]">{label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-[#6B7280]">{desc}</span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}
