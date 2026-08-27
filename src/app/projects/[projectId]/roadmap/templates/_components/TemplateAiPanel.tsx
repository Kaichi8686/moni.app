"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { GeminiAgentPanel } from "@/components/projects/workspace/gemini/GeminiAgentPanel";

type Props = {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  phases: Array<{ title: string }>;
  phasesCount: number;
  canEdit: boolean;
  onReload: () => Promise<void>;
};

export function TemplateAiPanel({
  projectId,
  projectName,
  projectDescription,
  phases,
  phasesCount,
  canEdit,
  onReload,
}: Props) {
  const phaseSummary = useMemo(
    () =>
      phases
        .slice(0, 8)
        .map((p) => `- ${p.title}`)
        .join("\n"),
    [phases],
  );

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-bold text-gray-900">AIでオリジナルプランを作る</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              用意された型に合わないときは、プロジェクトの内容を伝えるだけで段階とやることを提案します。下の定型テンプレートと同じようにロードマップへ反映できます。
            </p>
          </div>
        </div>
      </div>

      <GeminiAgentPanel
        mode="roadmap"
        projectId={projectId}
        projectName={projectName}
        projectDescription={projectDescription}
        phaseSummary={phaseSummary}
        phasesCount={phasesCount}
        canEdit={canEdit}
        onReload={onReload}
      />
    </section>
  );
}
