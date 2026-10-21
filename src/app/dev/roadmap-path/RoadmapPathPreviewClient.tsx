"use client";

import Link from "next/link";
import { useState } from "react";
import { RoadmapPath, RoadmapPathItem } from "@/components/projects/workspace/roadmap/RoadmapPath";
import { RoadmapPathNode } from "@/components/projects/workspace/roadmap/RoadmapPathNode";
import {
  RoadmapMarkPicker,
  RoadmapStepMark,
  type RoadmapMarkId,
} from "@/components/projects/workspace/roadmap/roadmapPathMarks";

const DEMO_STEPS = [
  { id: "1", title: "ヒアリング", goal: "10人に話を聞く", tone: "done" as const, icon: "star" as RoadmapMarkId },
  { id: "2", title: "仮説づくり", goal: "仮説を1つ決める", tone: "active" as const, icon: "book" as RoadmapMarkId },
  { id: "3", title: "試作", goal: "たたき台を作る", tone: "upcoming" as const, icon: "flag" as RoadmapMarkId },
  { id: "4", title: "検証", goal: "フィードバックをもらう", tone: "upcoming" as const, icon: "target" as RoadmapMarkId },
  { id: "5", title: "発表", goal: "人前で話す", tone: "upcoming" as const, icon: "rocket" as RoadmapMarkId },
];

/** オレンジ道＋ユーザー選択マークの見た目確認用 */
export function RoadmapPathPreviewClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picked, setPicked] = useState<RoadmapMarkId>("lightbulb");
  const selected = DEMO_STEPS.find((step) => step.id === selectedId) ?? null;

  return (
    <main className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto max-w-lg space-y-10">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">dev preview</p>
          <h1 className="mt-1 text-xl font-bold text-zinc-950">Roadmap path</h1>
          <p className="mt-1 text-sm text-zinc-500">オレンジの直線・選べる絵・タップで詳細</p>
        </header>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">絵を選ぶ（作成時）</h2>
          <RoadmapMarkPicker value={picked} onChange={setPicked} label="マスの絵" />
          <div className="mt-4 flex justify-center">
            <RoadmapPathNode tone="active" aria-label="preview">
              <RoadmapStepMark markId={picked} tone="active" />
            </RoadmapPathNode>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">ステップあり（マスをタップ）</h2>
          <RoadmapPath segmentCleared={[true, true, false, false, false]}>
            {DEMO_STEPS.map((step, index) => (
              <RoadmapPathItem key={step.id} index={index}>
                <RoadmapPathNode
                  tone={step.tone}
                  sparkle={step.tone === "active"}
                  selected={selectedId === step.id}
                  onClick={() => setSelectedId((current) => (current === step.id ? null : step.id))}
                  aria-label={step.title}
                >
                  <RoadmapStepMark markId={step.icon} index={index} tone={step.tone} />
                </RoadmapPathNode>
              </RoadmapPathItem>
            ))}
            <RoadmapPathItem index={DEMO_STEPS.length}>
              <RoadmapPathNode tone="create" onClick={() => undefined} aria-label="次を追加">
                <RoadmapStepMark index={DEMO_STEPS.length} tone="create" />
              </RoadmapPathNode>
            </RoadmapPathItem>
          </RoadmapPath>

          {selected ? (
            <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-3">
              <p className="text-[10px] font-bold tracking-[0.12em] text-zinc-400">
                STEP {DEMO_STEPS.findIndex((step) => step.id === selected.id) + 1}
              </p>
              <p className="mt-1 text-base font-bold text-zinc-900">{selected.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{selected.goal}</p>
            </div>
          ) : (
            <p className="mt-4 text-center text-sm text-zinc-400">マスを押すと名前と詳細が出ます</p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">初回作成</h2>
          <RoadmapPath>
            <RoadmapPathItem index={0}>
              <Link
                href="#"
                className="group relative flex w-[7.5rem] flex-col items-center sm:w-[8.5rem]"
                aria-label="ロードマップを作成する"
              >
                <RoadmapPathNode tone="create" className="pointer-events-none w-full">
                  <RoadmapStepMark index={0} tone="create" />
                </RoadmapPathNode>
              </Link>
            </RoadmapPathItem>
          </RoadmapPath>
        </section>
      </div>
    </main>
  );
}
