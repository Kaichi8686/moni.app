"use client";

import { TagChipPicker } from "@/components/profile/TagChipPicker";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  SKILL_PRESETS,
  TRAIT_PRESETS,
  labelForPreset,
} from "@/lib/profile/skillsTraits";

type Props = {
  skills: string[];
  traits: string[];
  onSkillsChange: (next: string[]) => void;
  onTraitsChange: (next: string[]) => void;
  /** 導入文を出す（オンボーディング向け） */
  showIntro?: boolean;
  compact?: boolean;
  /** オンボーディング: カードUI + 各3つまで */
  onboardingStyle?: boolean;
  maxPerSection?: number;
};

export function SkillsTraitsEditor({
  skills,
  traits,
  onSkillsChange,
  onTraitsChange,
  showIntro = false,
  compact = false,
  onboardingStyle = false,
  maxPerSection,
}: Props) {
  const { locale, tx } = useI18n();
  const skillPresets = SKILL_PRESETS.map((p) => ({
    id: p.ja,
    label: labelForPreset(p, locale),
  }));
  const traitPresets = TRAIT_PRESETS.map((p) => ({
    id: p.ja,
    label: labelForPreset(p, locale),
  }));
  const max = maxPerSection ?? (onboardingStyle ? 3 : 12);
  const variant = onboardingStyle ? "cards" : "chips";

  return (
    <div className={compact || onboardingStyle ? "space-y-6" : "space-y-6"}>
      {showIntro ? (
        <div className="space-y-1.5">
          <p className="text-[17px] font-semibold leading-snug tracking-tight text-zinc-900">
            {tx(
              "興味と性格を教えてください",
              "Tell us your interests and personality",
            )}
          </p>
          <p className="text-[13px] leading-relaxed text-zinc-500">
            {tx(
              "探すタブで仲間があなたのプロフィールを見るときに表示されます。あとから変更できます。",
              "These show on your profile when others find you in Search. You can change them later.",
            )}
          </p>
        </div>
      ) : null}

      <section>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-zinc-900">
            {onboardingStyle
              ? tx("興味のあること", "Interests")
              : tx("特技", "Skills")}
          </h3>
          {onboardingStyle ? (
            <span className="text-[11px] font-medium text-zinc-400">
              {tx("3つ選ぶ", "Pick 3")}
            </span>
          ) : null}
        </div>
        <p className="text-[12px] leading-relaxed text-zinc-500">
          {onboardingStyle
            ? tx(
                "いま関心がある分野や、やってみたいことを選びましょう",
                "Pick topics you care about or want to explore",
              )
            : tx(
                "プロジェクトで活かせそうな得意分野を選んでください",
                "Pick strengths you can bring to a project",
              )}
        </p>
        <TagChipPicker
          className="mt-3"
          presets={skillPresets}
          value={skills}
          onChange={onSkillsChange}
          max={max}
          variant={variant}
          allowCustom={!onboardingStyle}
        />
      </section>

      <section>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-zinc-900">
            {tx("性格", "Personality")}
          </h3>
          {onboardingStyle ? (
            <span className="text-[11px] font-medium text-zinc-400">
              {tx("3つ選ぶ", "Pick 3")}
            </span>
          ) : null}
        </div>
        <p className="text-[12px] leading-relaxed text-zinc-500">
          {tx(
            "チームでの関わり方のイメージを教えてください",
            "How do you usually work with others?",
          )}
        </p>
        <TagChipPicker
          className="mt-3"
          presets={traitPresets}
          value={traits}
          onChange={onTraitsChange}
          max={max}
          variant={variant}
          allowCustom={!onboardingStyle}
        />
      </section>
    </div>
  );
}
