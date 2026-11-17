"use client";

import { ScoreReveal } from "@/components/office/ScoreReveal";
import type { OfficeSubmission } from "@/lib/office/types";

type Props = {
  submission: OfficeSubmission;
  busy: boolean;
  onNext: () => void;
};

export function ResultStep({ submission, busy, onNext }: Props) {
  return <ScoreReveal submission={submission} busy={busy} onNext={onNext} />;
}
