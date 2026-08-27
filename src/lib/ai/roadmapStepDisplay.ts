import type { RoadmapStepFull } from "@/components/projects/ProjectRoadmapPanel";

export type ParsedRoadmapStepNotes = {
  how: string | null;
  fallback: string | null;
};

export function parseRoadmapStepNotes(notes: string | null | undefined): ParsedRoadmapStepNotes {
  const raw = notes?.trim() ?? "";
  if (!raw) return { how: null, fallback: null };

  const howMatch = raw.match(/(?:^|\n)どうやって[:：]\s*([\s\S]*?)(?=\nうまくいかなかったら[:：]|$)/);
  const fallbackMatch = raw.match(/(?:^|\n)うまくいかなかったら[:：]\s*([\s\S]*?)$/);

  if (howMatch || fallbackMatch) {
    return {
      how: howMatch?.[1]?.trim() || null,
      fallback: fallbackMatch?.[1]?.trim() || null,
    };
  }

  return { how: raw, fallback: null };
}

export function formatRoadmapStepNotes(how: string, fallback: string): string {
  const parts: string[] = [];
  if (how.trim()) parts.push(`どうやって: ${how.trim()}`);
  if (fallback.trim()) parts.push(`うまくいかなかったら: ${fallback.trim()}`);
  return parts.join("\n");
}

export type RoadmapStepDisplay = {
  timelineLabel: string;
  action: string;
  why: string | null;
  how: string | null;
  fallback: string | null;
  hasStructuredContent: boolean;
};

const TIMELINE_FROM_TITLE = /^(今日|今週中|来週までに|今月中)/;

export function roadmapStepDisplay(step: RoadmapStepFull, index: number): RoadmapStepDisplay {
  const parsedNotes = parseRoadmapStepNotes(step.notes);
  const title = step.title.trim();
  const description = step.description?.trim() ?? "";
  const why = step.completion_criteria?.trim() || null;

  let timelineLabel = "ステップ";
  let action = title;

  const titleTimeline = title.match(TIMELINE_FROM_TITLE);
  if (titleTimeline) {
    timelineLabel = titleTimeline[1];
    action = description || title.replace(TIMELINE_FROM_TITLE, "").replace(/^[（(]/, "").replace(/[）)]$/, "").trim() || title;
  } else if (description) {
    action = description;
    timelineLabel = index === 0 ? "今日" : index === 1 ? "今週中" : index === 2 ? "来週までに" : "今月中";
  } else {
    timelineLabel = index === 0 ? "今日" : index === 1 ? "今週中" : index === 2 ? "来週までに" : "今月中";
  }

  const hasStructuredContent = Boolean(description || why || parsedNotes.how || parsedNotes.fallback);

  return {
    timelineLabel,
    action,
    why,
    how: parsedNotes.how,
    fallback: parsedNotes.fallback,
    hasStructuredContent,
  };
}
