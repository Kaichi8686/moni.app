"use client";

import { TagChipPicker } from "@/components/profile/TagChipPicker";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  INTEREST_FIELDS_MAX,
  interestFieldPresetOptions,
} from "@/lib/profile/interestFields";
import {
  SKILL_PRESETS,
  TRAIT_PRESETS,
  labelForPreset,
} from "@/lib/profile/skillsTraits";
import {
  SOCIAL_ISSUES_MAX,
  socialIssuePresetOptions,
} from "@/lib/profile/socialIssues";

type Props = {
  skills: string[];
  traits: string[];
  onSkillsChange: (next: string[]) => void;
  onTraitsChange: (next: string[]) => void;
  /** 興味のある分野（最大3・任意） */
  interestFields?: string[];
  onInterestFieldsChange?: (next: string[]) => void;
  /** 気になる社会問題（最大3・任意） */
  socialIssues?: string[];
  onSocialIssuesChange?: (next: string[]) => void;
  showIntro?: boolean;
  compact?: boolean;
  onboardingStyle?: boolean;
  maxPerSection?: number;
  /** 興味のある分野のみ（オンボーディング専用ステップ） */
  interestFieldsOnly?: boolean;
  /** 社会問題のみ（オンボーディング専用ステップ） */
  socialIssuesOnly?: boolean;
};

export function SkillsTraitsEditor({
  skills,
  traits,
  onSkillsChange,
  onTraitsChange,
  interestFields,
  onInterestFieldsChange,
  socialIssues,
  onSocialIssuesChange,
  showIntro = false,
  compact = false,
  onboardingStyle = false,
  maxPerSection,
  interestFieldsOnly = false,
  socialIssuesOnly = false,
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
  const fieldPresets = interestFieldPresetOptions(locale);
  const issuePresets = socialIssuePresetOptions(locale);
  const max = maxPerSection ?? (onboardingStyle ? 3 : 12);
  const variant = onboardingStyle ? "cards" : "chips";
  const showInterestFields = Boolean(onInterestFieldsChange) && interestFields != null;
  const showSocialIssues = Boolean(onSocialIssuesChange) && socialIssues != null;

  const interestFieldsSection = showInterestFields ? (
    <section>
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-zinc-900">
          {tx("興味のある分野", "Fields of interest")}
        </h3>
        <span className="text-[10px] font-medium text-zinc-400">
          {tx("最大3つ・スキップ可", "Up to 3 · optional")}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-500">
        {tx(
          "AIや音楽など、いまワクワクする分野を選びましょう",
          "Pick areas that excite you — AI, music, and more",
        )}
      </p>
      <TagChipPicker
        className="mt-2"
        presets={fieldPresets}
        value={interestFields ?? []}
        onChange={onInterestFieldsChange!}
        max={INTEREST_FIELDS_MAX}
        variant={variant}
        allowCustom={!onboardingStyle}
      />
    </section>
  ) : null;

  const socialIssuesSection = showSocialIssues ? (
    <section>
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-zinc-900">
          {tx("気になる社会問題", "Social issues you care about")}
        </h3>
        <span className="text-[10px] font-medium text-zinc-400">
          {tx("最大3つ・スキップ可", "Up to 3 · optional")}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-500">
        {tx(
          "関心のあるテーマを選ぶと、プロフィールに表示されます",
          "Pick topics you care about — they show on your profile",
        )}
      </p>
      <TagChipPicker
        className="mt-2"
        presets={issuePresets}
        value={socialIssues ?? []}
        onChange={onSocialIssuesChange!}
        max={SOCIAL_ISSUES_MAX}
        variant={variant}
        allowCustom={!onboardingStyle}
      />
    </section>
  ) : null;

  if (interestFieldsOnly) {
    return (
      <div className={onboardingStyle ? "space-y-4" : compact ? "space-y-5" : "space-y-6"}>
        {interestFieldsSection}
      </div>
    );
  }

  if (socialIssuesOnly) {
    return (
      <div className={onboardingStyle ? "space-y-4" : compact ? "space-y-5" : "space-y-6"}>
        {socialIssuesSection}
      </div>
    );
  }

  return (
    <div className={onboardingStyle ? "space-y-4" : compact ? "space-y-5" : "space-y-6"}>
      {showIntro ? (
        <div className="space-y-1">
          <p className="text-[15px] font-semibold leading-snug tracking-tight text-zinc-900">
            {tx(
              "興味と性格を教えてください",
              "Tell us your interests and personality",
            )}
          </p>
          <p className="text-[12px] leading-relaxed text-zinc-500">
            {tx(
              "探すタブで仲間があなたのプロフィールを見るときに表示されます。あとから変更できます。",
              "These show on your profile when others find you in Search. You can change them later.",
            )}
          </p>
        </div>
      ) : null}

      <section>
        <div className="mb-0.5 flex items-baseline justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-zinc-900">
            {onboardingStyle
              ? tx("興味のあること", "Interests")
              : tx("特技", "Skills")}
          </h3>
          {onboardingStyle ? (
            <span className="text-[10px] font-medium text-zinc-400">
              {tx("3つ選ぶ", "Pick 3")}
            </span>
          ) : null}
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500">
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
          className="mt-2"
          presets={skillPresets}
          value={skills}
          onChange={onSkillsChange}
          max={max}
          variant={variant}
          allowCustom={!onboardingStyle}
        />
      </section>

      <section>
        <div className="mb-0.5 flex items-baseline justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-zinc-900">
            {tx("性格", "Personality")}
          </h3>
          {onboardingStyle ? (
            <span className="text-[10px] font-medium text-zinc-400">
              {tx("3つ選ぶ", "Pick 3")}
            </span>
          ) : null}
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          {tx(
            "チームでの関わり方のイメージを教えてください",
            "How do you usually work with others?",
          )}
        </p>
        <TagChipPicker
          className="mt-2"
          presets={traitPresets}
          value={traits}
          onChange={onTraitsChange}
          max={max}
          variant={variant}
          allowCustom={!onboardingStyle}
        />
      </section>

      {interestFieldsSection}
      {socialIssuesSection}
    </div>
  );
}
