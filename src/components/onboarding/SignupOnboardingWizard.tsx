"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, ChevronDown, ImagePlus, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { SkillsTraitsEditor } from "@/components/profile/SkillsTraitsEditor";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  ageFromBirthday,
  birthdayInputMax,
  birthdayInputMin,
  parseBirthday,
} from "@/lib/profile/birthday";
import { countryLabel, sortedCountries } from "@/lib/profile/countries";
import { GENDER_OPTIONS, isProfileGender, type ProfileGender } from "@/lib/profile/gender";
import { normalizeTagList } from "@/lib/profile/skillsTraits";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export type OnboardingDraft = {
  birthday: string;
  gender: ProfileGender | "";
  country: string;
  nickname: string;
  avatarUrl: string | null;
  skills: string[];
  traits: string[];
};

type Step = 1 | 2 | 3 | 4 | 5;

type Props = {
  session: Session;
  initialNickname?: string;
  onComplete: () => void;
};

const TOTAL_STEPS = 5;
const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif";

export function SignupOnboardingWizard({ session, initialNickname = "", onComplete }: Props) {
  const { locale, tx } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [draft, setDraft] = useState<OnboardingDraft>({
    birthday: "",
    gender: "",
    country: "",
    nickname: initialNickname,
    avatarUrl: null,
    skills: [],
    traits: [],
  });

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("profiles")
      .select("display_name,avatar_url,birthday,gender,country,skills,traits")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const genderRaw = (data as { gender?: string | null }).gender;
        const birthdayRaw = (data as { birthday?: string | null }).birthday;
        setDraft((prev) => ({
          ...prev,
          nickname:
            prev.nickname ||
            ((data.display_name as string | null)?.trim() ?? "") ||
            initialNickname,
          avatarUrl: (data.avatar_url as string | null) ?? prev.avatarUrl,
          birthday: prev.birthday || (typeof birthdayRaw === "string" ? birthdayRaw.slice(0, 10) : ""),
          gender: prev.gender || (isProfileGender(genderRaw) ? genderRaw : ""),
          country: prev.country || ((data.country as string | null) ?? ""),
        }));
      });
  }, [session.user.id, initialNickname]);

  const countries = useMemo(() => sortedCountries(locale), [locale]);
  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.ja.toLowerCase().includes(q) ||
        c.en.toLowerCase().includes(q),
    );
  }, [countries, countryQuery]);

  const birthdayValid = parseBirthday(draft.birthday) !== null;
  const genderValid = isProfileGender(draft.gender);
  const countryValid = draft.country.length === 2;
  const nicknameValid = draft.nickname.trim().length >= 1 && draft.nickname.trim().length <= 32;
  const interestsValid = draft.skills.length === 3 && draft.traits.length === 3;

  function canContinue(): boolean {
    if (step === 1) return birthdayValid && genderValid;
    if (step === 2) return countryValid;
    if (step === 3) return nicknameValid;
    if (step === 4) return true;
    if (step === 5) return interestsValid;
    return false;
  }

  async function uploadAvatar(file: File) {
    if (!supabase) return;
    setUploading(true);
    setError("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error(tx("ログインが必要です", "Login required"));
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload-avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await res.json()) as { avatarUrl?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? tx("アップロードに失敗しました", "Upload failed"));
      setDraft((d) => ({ ...d, avatarUrl: json.avatarUrl ?? d.avatarUrl }));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("写真のアップロードに失敗しました", "Couldn’t upload photo"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function persistAndFinish() {
    if (!supabase || saving) return;
    const birthday = parseBirthday(draft.birthday);
    const age = birthday ? ageFromBirthday(birthday) : null;
    if (!birthday || age == null || !genderValid || !countryValid || !nicknameValid || !interestsValid) {
      setError(tx("入力内容を確認してください", "Please check your answers"));
      return;
    }
    setSaving(true);
    setError("");
    const nickname = draft.nickname.trim();
    const skills = normalizeTagList(draft.skills, 3);
    const traits = normalizeTagList(draft.traits, 3);
    const completedAt = new Date().toISOString();

    const fullPayload: Record<string, unknown> = {
      display_name: nickname,
      birthday,
      age,
      gender: draft.gender,
      country: draft.country,
      skills,
      traits,
      onboarding_completed_at: completedAt,
    };
    if (draft.avatarUrl) fullPayload.avatar_url = draft.avatarUrl;

    let { error: upErr } = await supabase.from("profiles").update(fullPayload).eq("id", session.user.id);
    if (upErr) {
      const fallbacks: Array<Record<string, unknown>> = [
        { display_name: nickname, birthday, age, country: draft.country, skills, traits, onboarding_completed_at: completedAt },
        { display_name: nickname, age, country: draft.country, skills, traits, onboarding_completed_at: completedAt },
        { display_name: nickname, skills, traits, onboarding_completed_at: completedAt },
        { display_name: nickname, skills, traits },
        { display_name: nickname },
      ];
      for (const payload of fallbacks) {
        const res = await supabase.from("profiles").update(payload).eq("id", session.user.id);
        if (!res.error) {
          upErr = null;
          break;
        }
        upErr = res.error;
      }
    }

    if (upErr) {
      setError(upErr.message);
      setSaving(false);
      return;
    }

    try {
      await supabase.auth.updateUser({ data: { display_name: nickname } });
    } catch {
      /* ignore metadata sync failure */
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(`moni-onboarding-complete-${session.user.id}`, "1");
    }
    setSaving(false);
    onComplete();
  }

  function goNext() {
    setError("");
    if (!canContinue()) {
      if (step === 1) {
        if (!birthdayValid)
          setError(tx("誕生日を正しく入力してください（年も含む）", "Enter a valid birthday including the year"));
        else setError(tx("性別を選んでください", "Please select a gender"));
      } else if (step === 2) setError(tx("国を選んでください", "Please select a country"));
      else if (step === 3) setError(tx("ニックネームを入力してください", "Please enter a nickname"));
      else if (step === 5)
        setError(tx("興味と性格をそれぞれ3つ選んでください", "Pick 3 interests and 3 personality traits"));
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    void persistAndFinish();
  }

  function goBack() {
    setError("");
    if (step > 1) setStep((s) => (s - 1) as Step);
  }

  const stepTitle: Record<Step, string> = {
    1: tx("誕生日と性別", "Birthday & gender"),
    2: tx("住んでいる国は？", "Which country are you in?"),
    3: tx("ニックネームを決めよう", "Choose a nickname"),
    4: tx("アイコンを選ぼう", "Pick a profile photo"),
    5: tx("興味と性格", "Interests & personality"),
  };

  const stepHint: Record<Step, string> = {
    1: tx("年・月・日を入力。性別は選びたくないも選べます", "Enter year, month, and day. You can prefer not to say gender."),
    2: tx("リストから選んでください", "Choose from the list"),
    3: tx("あとからプロフィール編集でいつでも変えられます", "You can change this later in Edit profile"),
    4: tx("写真・カメラ・ファイルから選べます。あとから変更もできます", "Use a photo, camera, or file. You can change it later"),
    5: tx("探すタブで相手があなたのプロフィールを見るときに反映されます", "These appear when others view your profile in Search"),
  };

  const derivedAge = ageFromBirthday(draft.birthday);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#f6f5f2]">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 8% -8%, rgba(24,24,27,0.07), transparent 55%), radial-gradient(ellipse 50% 35% at 100% 0%, rgba(82,82,91,0.08), transparent 50%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-3.5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
        <header className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold tracking-tight text-zinc-900">moni</p>
            <p className="text-[11px] font-medium text-zinc-500">
              {tx(`ステップ ${step} / ${TOTAL_STEPS}`, `Step ${step} of ${TOTAL_STEPS}`)}
            </p>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
              const n = (i + 1) as Step;
              return (
                <div
                  key={n}
                  className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                    n <= step ? "bg-zinc-900" : "bg-zinc-300/80"
                  }`}
                />
              );
            })}
          </div>
        </header>

        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_8px_24px_rgba(24,24,27,0.05)] backdrop-blur-sm"
            >
              <h1 className="text-[18px] font-bold leading-snug tracking-tight text-zinc-900">
                {stepTitle[step]}
              </h1>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{stepHint[step]}</p>

              <div className="mt-4">
                {step === 1 ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold text-zinc-600" htmlFor="ob-birthday">
                        {tx("誕生日", "Birthday")}
                      </label>
                      <input
                        id="ob-birthday"
                        type="date"
                        autoComplete="bday"
                        min={birthdayInputMin()}
                        max={birthdayInputMax()}
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[15px] font-semibold tracking-tight text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
                        value={draft.birthday}
                        onChange={(e) => setDraft((d) => ({ ...d, birthday: e.target.value }))}
                      />
                      <p className="text-[11px] text-zinc-400">
                        {derivedAge != null
                          ? tx(`現在 ${derivedAge}歳`, `Currently ${derivedAge} years old`)
                          : tx("年も含めて選んでください", "Include the year")}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-zinc-600">{tx("性別", "Gender")}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {GENDER_OPTIONS.map((opt) => {
                          const on = draft.gender === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setDraft((d) => ({ ...d, gender: opt.id }))}
                              className={`min-h-[40px] rounded-xl border px-3 py-2 text-[13px] font-semibold transition active:scale-[0.98] ${
                                on
                                  ? "border-zinc-900 bg-zinc-900 text-white"
                                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
                              }`}
                            >
                              {locale === "en" ? opt.en : opt.ja}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="space-y-2.5">
                    <label className="block text-[11px] font-semibold text-zinc-600" htmlFor="ob-country-q">
                      {tx("国を検索", "Search countries")}
                    </label>
                    <div className="relative">
                      <input
                        id="ob-country-q"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[14px] text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
                        placeholder={tx("国名で検索…", "Search by country…")}
                        value={countryQuery}
                        onChange={(e) => setCountryQuery(e.target.value)}
                      />
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                    </div>
                    {draft.country ? (
                      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[12px] font-medium text-zinc-800">
                        {tx("選択中:", "Selected:")}{" "}
                        <span className="font-semibold">{countryLabel(draft.country, locale)}</span>
                      </p>
                    ) : null}
                    <div className="max-h-[min(46vh,300px)] overflow-y-auto overscroll-contain rounded-xl border border-zinc-200">
                      <ul className="divide-y divide-zinc-100">
                        {filteredCountries.map((c) => {
                          const on = draft.country === c.code;
                          return (
                            <li key={c.code}>
                              <button
                                type="button"
                                onClick={() => {
                                  setDraft((d) => ({ ...d, country: c.code }));
                                  setCountryQuery("");
                                }}
                                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] transition ${
                                  on
                                    ? "bg-zinc-900 font-semibold text-white"
                                    : "bg-white text-zinc-800 hover:bg-zinc-50"
                                }`}
                              >
                                <span>{locale === "en" ? c.en : c.ja}</span>
                                <span className={`text-[10px] ${on ? "text-white/70" : "text-zinc-400"}`}>
                                  {c.code}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                        {filteredCountries.length === 0 ? (
                          <li className="px-3 py-5 text-center text-[12px] text-zinc-500">
                            {tx("該当する国がありません", "No matching countries")}
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="space-y-2.5">
                    <label className="block text-[11px] font-semibold text-zinc-600" htmlFor="ob-nick">
                      {tx("ニックネーム", "Nickname")}
                    </label>
                    <input
                      id="ob-nick"
                      autoComplete="nickname"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[16px] font-semibold tracking-tight text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
                      placeholder={tx("例：カイチ", "e.g. Kaichi")}
                      value={draft.nickname}
                      maxLength={32}
                      onChange={(e) => setDraft((d) => ({ ...d, nickname: e.target.value }))}
                    />
                    <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900">
                      {tx(
                        "あとからプロフィール編集でいつでも変えられます。まずは気軽に決めましょう。",
                        "You can change this anytime in Edit profile — pick something for now.",
                      )}
                    </p>
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="flex flex-col items-center gap-3.5">
                    <ProfileAvatar
                      displayName={draft.nickname || "?"}
                      avatarUrl={draft.avatarUrl}
                      size="lg"
                    />
                    <div className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-3">
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 text-[12px] font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                        {tx("写真ライブラリ", "Photo library")}
                      </button>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => cameraRef.current?.click()}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 text-[12px] font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        <Camera className="h-3.5 w-3.5" aria-hidden />
                        {tx("カメラ", "Camera")}
                      </button>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 text-[12px] font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5" aria-hidden />
                        {tx("ファイル", "Files")}
                      </button>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={AVATAR_ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadAvatar(file);
                      }}
                    />
                    <input
                      ref={cameraRef}
                      type="file"
                      accept={AVATAR_ACCEPT}
                      capture="user"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadAvatar(file);
                      }}
                    />
                    <p className="text-center text-[11px] text-zinc-400">
                      {uploading
                        ? tx("アップロード中…", "Uploading…")
                        : draft.avatarUrl
                          ? tx("設定済み。次へ進むか、別の写真に変えられます。", "Set. Continue or pick another photo.")
                          : tx("スキップして後から設定することもできます", "You can skip and set this later")}
                    </p>
                  </div>
                ) : null}

                {step === 5 ? (
                  <SkillsTraitsEditor
                    showIntro={false}
                    onboardingStyle
                    maxPerSection={3}
                    skills={draft.skills}
                    traits={draft.traits}
                    onSkillsChange={(skills) => setDraft((d) => ({ ...d, skills }))}
                    onTraitsChange={(traits) => setDraft((d) => ({ ...d, traits }))}
                  />
                ) : null}
              </div>

              {error ? (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800" role="alert">
                  {error}
                </p>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-3.5 flex items-center gap-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40"
            >
              {tx("戻る", "Back")}
            </button>
          ) : (
            <div className="flex-1" />
          )}
          <button
            type="button"
            onClick={goNext}
            disabled={saving || uploading}
            className="inline-flex min-h-[42px] flex-[1.4] items-center justify-center rounded-xl bg-zinc-900 px-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-40"
          >
            {saving
              ? tx("保存中…", "Saving…")
              : step === TOTAL_STEPS
                ? tx("完了してはじめる", "Finish and start")
                : tx("次へ", "Next")}
          </button>
        </footer>
      </div>
    </div>
  );
}
