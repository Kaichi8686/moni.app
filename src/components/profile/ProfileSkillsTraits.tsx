"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { interestFieldLabel } from "@/lib/profile/interestFields";
import {
  SKILL_PRESETS,
  TRAIT_PRESETS,
  displayTagLabel,
} from "@/lib/profile/skillsTraits";
import { socialIssueLabel } from "@/lib/profile/socialIssues";

type Props = {
  skills: string[];
  traits: string[];
  interestFields?: string[];
  socialIssues?: string[];
  className?: string;
};

function Section({
  title,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  empty: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-zinc-400">{title}</p>
      {empty ? (
        <p className="text-[13px] leading-relaxed text-zinc-400">{emptyLabel}</p>
      ) : (
        children
      )}
    </div>
  );
}

function TagList({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function TagChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[12px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </span>
  );
}

export function ProfileSkillsTraits({
  skills,
  traits,
  interestFields = [],
  socialIssues = [],
  className = "",
}: Props) {
  const { locale, tx } = useI18n();
  const unset = tx("未設定です", "Not set");

  return (
    <div className={`space-y-3 ${className}`}>
      <Section title={tx("興味のあること", "Interests")} empty={skills.length === 0} emptyLabel={unset}>
        <TagList>
          {skills.map((tag) => (
            <TagChip key={`skill-${tag}`}>{displayTagLabel(tag, SKILL_PRESETS, locale)}</TagChip>
          ))}
        </TagList>
      </Section>

      <Section
        title={tx("興味のある分野", "Fields of interest")}
        empty={interestFields.length === 0}
        emptyLabel={unset}
      >
        <TagList>
          {interestFields.map((tag) => (
            <TagChip key={`field-${tag}`}>{interestFieldLabel(tag, locale)}</TagChip>
          ))}
        </TagList>
      </Section>

      <Section title={tx("性格", "Personality")} empty={traits.length === 0} emptyLabel={unset}>
        <TagList>
          {traits.map((tag) => (
            <TagChip key={`trait-${tag}`}>{displayTagLabel(tag, TRAIT_PRESETS, locale)}</TagChip>
          ))}
        </TagList>
      </Section>

      <Section
        title={tx("気になる社会問題", "Social issues")}
        empty={socialIssues.length === 0}
        emptyLabel={unset}
      >
        <TagList>
          {socialIssues.map((tag) => (
            <TagChip key={`issue-${tag}`}>{socialIssueLabel(tag, locale)}</TagChip>
          ))}
        </TagList>
      </Section>
    </div>
  );
}
