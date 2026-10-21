"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { RoadmapPath, RoadmapPathItem } from "@/components/projects/workspace/roadmap/RoadmapPath";
import { RoadmapPathNode } from "@/components/projects/workspace/roadmap/RoadmapPathNode";

const DEMO_STEPS = [
  { id: "1", title: "ヒアリング", tone: "done" as const },
  { id: "2", title: "仮説づくり", tone: "active" as const },
  { id: "3", title: "試作", tone: "upcoming" as const },
  { id: "4", title: "検証", tone: "upcoming" as const },
  { id: "5", title: "発表", tone: "upcoming" as const },
];

/** Duolingo 風ロードマップマスの見た目確認用 */
export function RoadmapPathPreviewClient() {
  return (
    <main className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto max-w-lg space-y-10">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">dev preview</p>
          <h1 className="mt-1 text-xl font-bold text-zinc-950">Roadmap path</h1>
          <p className="mt-1 text-sm text-zinc-500">Duolingo 風の立体円マスと蛇行パス</p>
        </header>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">ステップあり</h2>
          <RoadmapPath>
            {DEMO_STEPS.map((step, index) => (
              <RoadmapPathItem key={step.id} index={index}>
                <RoadmapPathNode tone={step.tone} label={step.title} onClick={() => undefined} />
              </RoadmapPathItem>
            ))}
            <RoadmapPathItem index={DEMO_STEPS.length}>
              <RoadmapPathNode tone="create" label="次を追加" onClick={() => undefined}>
                <Plus className="h-8 w-8" strokeWidth={2.75} aria-hidden />
              </RoadmapPathNode>
            </RoadmapPathItem>
          </RoadmapPath>
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
                <RoadmapPathNode tone="create" label="作成する" className="pointer-events-none w-full">
                  <Plus className="h-8 w-8" strokeWidth={2.75} aria-hidden />
                </RoadmapPathNode>
              </Link>
            </RoadmapPathItem>
          </RoadmapPath>
        </section>
      </div>
    </main>
  );
}
