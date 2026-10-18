"use client";

import { TagChipPicker } from "@/components/profile/TagChipPicker";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  /** 気になる社会問題（最大3・任意）。渡したときだけ表示 */
  socialIssues?: string[];
  onSocialIssuesChange?: (next: string[]) => void;
  /** 導入文を出す（オンボーディング向け） */
  showIntro?: boolean;
  compact?: boolean;
  /** オンボーディング: カードUI + 各3つまで */
  onboardingStyle?: boolean;
  maxPerSection?: number;
  /** 社会問題のみ表示（オンボーディング専用ステップ） */
  socialIssuesOnly?: boolean;
};

export function SkillsTraitsEditor({
  skills,
  traits,
  onSkillsChange,
  onTraitsChange,
  socialIssues,
  onSocialIssuesChange,
  showIntro = false,
  compact = false,
  onboardingStyle = false,
  maxPerSection,
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
  const issuePresets = socialIssuePresetOptions(locale);
  const max = maxPerSection ?? (onboardingStyle ? 3 : 12);
  const variant = onboardingStyle ? "cards" : "chips";
  const showSocialIssues = Boolean(onSocialIssuesChange) && socialIssues != null;

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

  if (socialIssuesOnly) {
    return (
      <div className={onboardingStyle ? "space-y-4" : compact ? "space-y-5" : "space-y-6"}>
        {showIntro ? (
          <div className="space-y-1">
            <p className="text-[15px] font-semibold leading-snug tracking-tight text-zinc-900">
              {tx("気になる社会問題はありますか？", "Any social issues you care about?")}
            </p>
            <p className="text-[12px] leading-relaxed text-zinc-500">
              {tx(
                "最大3つまで選べます。スキップしてもあとからプロフィール編集で追加できます。",
                "Pick up to 3. You can skip and add them later in Edit profile.",
              )}
            </p>
          </div>
        ) : null}
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

      {socialIssuesSection}
    </div>
  );
}
