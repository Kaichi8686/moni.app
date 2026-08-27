import type { Issue } from "@/lib/workspace/types";
import { simplifyIssueText } from "@/lib/workspace/issuePlainLanguage";

export type IssueWorkflowStep = {
  id: string;
  title: string;
  subtitle: string;
  prompts: string[];
  done: boolean;
  note: string;
};

export type IssueWorkflow = {
  version: 1;
  currentStepId: string;
  steps: IssueWorkflowStep[];
  /** 課題完了時に書く答え・まとめ */
  completionAnswer?: string;
};

const WORKFLOW_MARKER = "---moni-workflow-v1---";

const STEP_BLUEPRINTS: Omit<IssueWorkflowStep, "done" | "note">[] = [
  {
    id: "understand",
    title: "わかる",
    subtitle: "何を達成するか整理する",
    prompts: [
      "できている状態を、やさしい言葉で1文にする",
      "この段階のねらいとつながっているか確認する",
      "まだわからないことをメモする",
    ],
  },
  {
    id: "research",
    title: "しらべる",
    subtitle: "事実や人の声を集める",
    prompts: [
      "誰が・いつ困るかを具体化する",
      "参考になる例を1つ以上探す",
      "使える材料・ルール・時間の制限を書き出す",
    ],
  },
  {
    id: "execute",
    title: "やってみる",
    subtitle: "小さく試して前に進める",
    prompts: [
      "今日できるいちばん小さい一歩を決める",
      "試したことと結果を記録する",
      "詰まったら誰に聞くか決める",
    ],
  },
  {
    id: "verify",
    title: "できたか確認",
    subtitle: "目標に近づいたか確かめる",
    prompts: [
      "成功の基準を満たしたかチェックする",
      "可能なら誰かに見てもらう・意見をもらう",
      "次に直すところを1つ書く",
    ],
  },
  {
    id: "complete",
    title: "おわり",
    subtitle: "振り返って次につなぐ",
    prompts: [
      "学んだことを2行でまとめる",
      "次にやることを1つ書く",
      "課題を「完了」にする",
    ],
  },
];

function cloneBlueprint(): IssueWorkflowStep[] {
  return STEP_BLUEPRINTS.map((s) => ({ ...s, done: false, note: "" }));
}

export function buildWorkflowForMilestone(input: {
  milestoneTitle: string;
  phaseTitle: string;
  phaseGoal?: string;
  phaseGuide?: string;
  projectName?: string;
  projectAudience?: string;
}): IssueWorkflow {
  const title = simplifyIssueText(input.milestoneTitle);
  const phaseTitle = simplifyIssueText(input.phaseTitle);
  const phaseGoal = input.phaseGoal ? simplifyIssueText(input.phaseGoal) : undefined;

  const steps = cloneBlueprint();
  const proj = input.projectName?.trim();
  const audience = input.projectAudience?.trim();
  steps[0] = {
    ...steps[0],
    prompts: [
      proj ? `プロジェクト「${proj}」でのやること: ${title}` : `やること: ${title}`,
      phaseGoal ? `この段階のねらい: ${phaseGoal}` : `段階「${phaseTitle}」のねらいを確認する`,
      audience ? `「${audience}」にとってうれしい状態を1文で書く` : "できている状態を1文で書く",
    ],
  };
  if (input.phaseGuide?.trim()) {
    steps[1] = {
      ...steps[1],
      prompts: [
        proj ? `「${proj}」のヒントを読んで当てはめる` : "ヒントを読んで、自分の課題に当てはめる",
        ...steps[1].prompts.slice(0, 2),
      ],
    };
  }
  return { version: 1, currentStepId: steps[0].id, steps };
}

export function workflowFromJson(raw: unknown): IssueWorkflow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || !Array.isArray(o.steps)) return null;
  const steps: IssueWorkflowStep[] = [];
  for (const s of o.steps) {
    if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    const id = String(r.id ?? "");
    const title = String(r.title ?? "");
    if (!id || !title) continue;
    steps.push({
      id,
      title,
      subtitle: String(r.subtitle ?? ""),
      prompts: Array.isArray(r.prompts) ? r.prompts.map((p) => String(p)) : [],
      done: Boolean(r.done),
      note: String(r.note ?? ""),
    });
  }
  if (steps.length === 0) return null;
  const currentStepId = String(o.currentStepId ?? steps[0].id);
  const completionAnswer =
    typeof o.completionAnswer === "string" ? o.completionAnswer : undefined;
  return {
    version: 1,
    currentStepId: steps.some((s) => s.id === currentStepId) ? currentStepId : steps[0].id,
    steps,
    completionAnswer,
  };
}

export function parseWorkflowFromDescription(description?: string): IssueWorkflow | null {
  if (!description?.includes(WORKFLOW_MARKER)) return null;
  const idx = description.indexOf(WORKFLOW_MARKER);
  const jsonPart = description.slice(idx + WORKFLOW_MARKER.length).trim();
  try {
    return workflowFromJson(JSON.parse(jsonPart));
  } catch {
    return null;
  }
}

export function embedWorkflowInDescription(userDescription: string, workflow: IssueWorkflow): string {
  const base = stripWorkflowFromDescription(userDescription).trim();
  const block = `${WORKFLOW_MARKER}\n${JSON.stringify(workflow)}`;
  return base ? `${base}\n\n${block}` : block;
}

export function stripWorkflowFromDescription(description?: string): string {
  if (!description) return "";
  const idx = description.indexOf(WORKFLOW_MARKER);
  if (idx < 0) return description.trim();
  return description.slice(0, idx).trim();
}

export function resolveIssueWorkflow(issue: Issue): IssueWorkflow | null {
  if (issue.workflow) return issue.workflow;
  return parseWorkflowFromDescription(issue.description);
}

export function workflowProgressPercent(workflow: IssueWorkflow): number {
  const done = workflow.steps.filter((s) => s.done).length;
  return Math.round((done / workflow.steps.length) * 100);
}

export function defaultWorkflowIfMissing(issue: Issue, phaseTitle?: string, phaseGoal?: string): IssueWorkflow {
  return (
    resolveIssueWorkflow(issue) ??
    buildWorkflowForMilestone({
      milestoneTitle: issue.title,
      phaseTitle: phaseTitle ?? "段階",
      phaseGoal,
    })
  );
}

export function getIssueCompletionAnswer(issue: Issue): string {
  const w = resolveIssueWorkflow(issue);
  return w?.completionAnswer?.trim() ?? "";
}

/** True when the user has engaged with the optional 5-step guide (notes or step checkboxes). */
export function issueHasGuideActivity(issue: Issue): boolean {
  const w = resolveIssueWorkflow(issue);
  if (!w) return false;
  if (w.completionAnswer?.trim()) return true;
  return w.steps.some((s) => s.done || Boolean(s.note?.trim()));
}
