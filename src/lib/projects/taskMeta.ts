import type { ProjectTaskMeta } from "@/lib/projects/types";

export function parseTaskMeta(raw: unknown): ProjectTaskMeta {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  let inputKind: ProjectTaskMeta["inputKind"];
  if (o.inputKind === "choice" || o.inputKind === "text" || o.inputKind === "none") inputKind = o.inputKind;
  const choiceOptions = Array.isArray(o.choiceOptions)
    ? o.choiceOptions.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : undefined;
  const placeholder = typeof o.placeholder === "string" ? o.placeholder : undefined;
  const answer = typeof o.answer === "string" ? o.answer : undefined;
  return { inputKind, choiceOptions, placeholder, answer };
}

export function mergeTaskMeta(current: ProjectTaskMeta, patch: ProjectTaskMeta): ProjectTaskMeta {
  return { ...current, ...patch };
}
