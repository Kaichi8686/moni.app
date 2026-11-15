"use client";

import { useState } from "react";
import { ProjectGoalBanner } from "@/components/projects/workspace/ProjectGoalBanner";
import { ProjectGoalDetailSheet } from "@/components/projects/workspace/ProjectGoalDetailSheet";
import { RoadmapStepList, type RoadmapStepListItem } from "@/components/projects/workspace/roadmap/RoadmapStepList";

const DEMO_STEPS: RoadmapStepListItem[] = [
  {
    id: "1",
    title: "Idea & Validation",
    goal: "Teenagers and parents both feel the idea is safe and worth building.",
    description: "Clarify the problem and safety rules before building.",
    status: "in_progress",
    stepNumber: 1,
    tasks: [
      {
        id: "t1",
        title: "Define the problem your prototype should solve",
        description: "Write one sentence the team can share.",
        status: "done",
      },
      {
        id: "t2",
        title: "Set safety rules before involving teenagers",
        description: "List what adults must approve first.",
        status: "active",
        badge: "Next move",
      },
      {
        id: "t3",
        title: "Check what teenagers need and parents would support",
        status: "todo",
      },
    ],
  },
  {
    id: "2",
    title: "Planning",
    goal: "A simple plan the team can follow for two weeks.",
    status: "planned",
    stepNumber: 2,
    tasks: [
      { id: "t4", title: "Break the idea into weekly milestones", status: "todo" },
      { id: "t5", title: "Assign owners for each milestone", status: "todo" },
    ],
  },
  {
    id: "3",
    title: "Building",
    goal: "Ship a tiny prototype teens can try.",
    status: "planned",
    stepNumber: 3,
  },
  {
    id: "4",
    title: "Testing",
    goal: "Learn from real feedback.",
    status: "planned",
    stepNumber: 4,
  },
  {
    id: "5",
    title: "Launch",
    goal: "Share a safe first version.",
    status: "planned",
    stepNumber: 5,
  },
];

/** 縦リスト＋アコーディオンの見た目確認用 */
export function RoadmapPathPreviewClient() {
  const [expandedId, setExpandedId] = useState<string | null>("1");
  const [goalOpen, setGoalOpen] = useState(false);

  return (
    <main className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">dev preview</p>
          <h1 className="mt-1 text-xl font-bold text-zinc-950">Roadmap step list</h1>
          <p className="mt-1 text-sm text-zinc-500">縦リスト＋タップで詳細（ヘッダーは本番どおり変更なし）</p>
        </header>

        <ProjectGoalBanner
          projectName="moni"
          goal="文化祭までに、クラス全員が見られる告知アプリを公開する"
          onClick={() => setGoalOpen(true)}
        />
        <ProjectGoalDetailSheet
          open={goalOpen}
          onClose={() => setGoalOpen(false)}
          projectName="moni"
          goal="文化祭までに、クラス全員が見られる告知アプリを公開する"
          problemMotivation="学校の行事告知がバラバラで、みんな見逃しがちだった"
        />

        <RoadmapStepList
          steps={DEMO_STEPS}
          currentIndex={0}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
        />
      </div>
    </main>
  );
}
