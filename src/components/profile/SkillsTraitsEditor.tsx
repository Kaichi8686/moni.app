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
};

export function SkillsTraitsEditor({
  skills,
  traits,
  onSkillsChange,
  onTraitsChange,
  showIntro = false,
  compact = false,
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

  return (
    <div className={compact ? "space-y-5" : "space-y-6"}>
      {showIntro ? (
        <div className="space-y-1.5">
          <p className="text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
            {tx(
              "あなたの得意なことや性格を教えてください",
              "Tell us your strengths and personality",
            )}
          </p>
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {tx(
              "相性の良い仲間を見つけやすくなります。後からプロフィール編集でも変更できます。",
              "This helps match you with compatible teammates. You can edit this later in your profile.",
            )}
          </p>
        </div>
      ) : null}

      <section>
        <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
          {tx("特技", "Skills")}
        </h3>
        <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
          {tx(
            "プロジェクトで活かせそうな得意分野を選んでください",
            "Pick strengths you can bring to a project",
          )}
        </p>
        <TagChipPicker
          className="mt-2.5"
          presets={skillPresets}
          value={skills}
          onChange={onSkillsChange}
        />
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
          {tx("性格", "Personality")}
        </h3>
        <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
          {tx(
            "チームでの関わり方のイメージを教えてください",
            "How do you usually work with others?",
          )}
        </p>
        <TagChipPicker
          className="mt-2.5"
          presets={traitPresets}
          value={traits}
          onChange={onTraitsChange}
        />
      </section>
    </div>
  );
}
