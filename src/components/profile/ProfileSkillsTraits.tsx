"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  SKILL_PRESETS,
  TRAIT_PRESETS,
  displayTagLabel,
} from "@/lib/profile/skillsTraits";

type Props = {
  skills: string[];
  traits: string[];
  className?: string;
};

export function ProfileSkillsTraits({ skills, traits, className = "" }: Props) {
  const { locale, tx } = useI18n();
  if (skills.length === 0 && traits.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {skills.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-zinc-400">
            {tx("特技", "Skills")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((tag) => (
              <span
                key={`skill-${tag}`}
                className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[12px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {displayTagLabel(tag, SKILL_PRESETS, locale)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {traits.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-zinc-400">
            {tx("性格", "Personality")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {traits.map((tag) => (
              <span
                key={`trait-${tag}`}
                className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[12px] font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
              >
                {displayTagLabel(tag, TRAIT_PRESETS, locale)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
