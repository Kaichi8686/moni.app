"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, ChevronDown, ImagePlus, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { SkillsTraitsEditor } from "@/components/profile/SkillsTraitsEditor";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { countryLabel, sortedCountries } from "@/lib/profile/countries";
import { normalizeTagList } from "@/lib/profile/skillsTraits";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export type OnboardingDraft = {
  age: string;
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

function parseAge(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 5 || n > 120) return null;
  return n;
}

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
    age: "",
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
      .select("display_name,avatar_url,age,country,skills,traits")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDraft((prev) => ({
          ...prev,
          nickname:
            prev.nickname ||
            ((data.display_name as string | null)?.trim() ?? "") ||
            initialNickname,
          avatarUrl: (data.avatar_url as string | null) ?? prev.avatarUrl,
          age:
            prev.age ||
            (typeof data.age === "number" && Number.isFinite(data.age) ? String(data.age) : ""),
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

  const ageValid = parseAge(draft.age) !== null;
  const countryValid = draft.country.length === 2;
  const nicknameValid = draft.nickname.trim().length >= 1 && draft.nickname.trim().length <= 32;
  const interestsValid = draft.skills.length === 3 && draft.traits.length === 3;

  function canContinue(): boolean {
    if (step === 1) return ageValid;
    if (step === 2) return countryValid;
    if (step === 3) return nicknameValid;
    if (step === 4) return true; // avatar optional but encouraged
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
    const age = parseAge(draft.age);
    if (age == null || !countryValid || !nicknameValid || !interestsValid) {
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
      age,
      country: draft.country,
      skills,
      traits,
      onboarding_completed_at: completedAt,
    };
    if (draft.avatarUrl) fullPayload.avatar_url = draft.avatarUrl;

    let { error: upErr } = await supabase.from("profiles").update(fullPayload).eq("id", session.user.id);
    if (upErr) {
      // columns may be missing until SQL applied — degrade gracefully
      const fallbacks: Array<Record<string, unknown>> = [
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
      if (step === 1) setError(tx("年齢は数字のみ（5〜120）で入力してください", "Enter age as a number (5–120)"));
      else if (step === 2) setError(tx("国を選んでください", "Please select a country"));
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
    1: tx("年齢を教えてください", "How old are you?"),
    2: tx("住んでいる国は？", "Which country are you in?"),
    3: tx("ニックネームを決めよう", "Choose a nickname"),
    4: tx("アイコンを選ぼう", "Pick a profile photo"),
    5: tx("興味と性格", "Interests & personality"),
  };

  const stepHint: Record<Step, string> = {
    1: tx("数字のみで入力できます", "Numbers only"),
    2: tx("リストから選んでください", "Choose from the list"),
    3: tx("あとからプロフィール編集でいつでも変えられます", "You can change this later in Edit profile"),
    4: tx("写真・カメラ・ファイルから選べます。あとから変更もできます", "Use a photo, camera, or file. You can change it later"),
    5: tx("探すタブで相手があなたのプロフィールを見るときに反映されます", "These appear when others view your profile in Search"),
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#f6f5f2]">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 10% -10%, rgba(24,24,27,0.08), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(82,82,91,0.1), transparent 50%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))]">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold tracking-tight text-zinc-900">moni</p>
            <p className="text-[12px] font-medium text-zinc-500">
              {tx(`ステップ ${step} / ${TOTAL_STEPS}`, `Step ${step} of ${TOTAL_STEPS}`)}
            </p>
          </div>
          <div className="mt-3 flex gap-1.5" aria-hidden>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
              const n = (i + 1) as Step;
              return (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-3xl border border-zinc-200/80 bg-white/95 p-5 shadow-[0_12px_40px_rgba(24,24,27,0.06)] backdrop-blur-sm sm:p-6"
            >
              <h1 className="text-[22px] font-bold leading-tight tracking-tight text-zinc-900">
                {stepTitle[step]}
              </h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{stepHint[step]}</p>

              <div className="mt-6">
                {step === 1 ? (
                  <div className="space-y-3">
                    <label className="block text-[12px] font-semibold text-zinc-600" htmlFor="ob-age">
                      {tx("年齢", "Age")}
                    </label>
                    <input
                      id="ob-age"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="bday-year"
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-[28px] font-semibold tracking-tight text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
                      placeholder="16"
                      value={draft.age}
                      maxLength={3}
                      onChange={(e) => {
                        const next = e.target.value.replace(/\D/g, "").slice(0, 3);
                        setDraft((d) => ({ ...d, age: next }));
                      }}
                    />
                    <p className="text-[12px] text-zinc-400">
                      {tx("半角数字のみ。例: 16", "Digits only. e.g. 16")}
                    </p>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="space-y-3">
                    <label className="block text-[12px] font-semibold text-zinc-600" htmlFor="ob-country-q">
                      {tx("国を検索", "Search countries")}
                    </label>
                    <div className="relative">
                      <input
                        id="ob-country-q"
                        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
                        placeholder={tx("国名で検索…", "Search by country…")}
                        value={countryQuery}
                        onChange={(e) => setCountryQuery(e.target.value)}
                      />
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    </div>
                    {draft.country ? (
                      <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] font-medium text-zinc-800">
                        {tx("選択中:", "Selected:")}{" "}
                        <span className="font-semibold">{countryLabel(draft.country, locale)}</span>
                      </p>
                    ) : null}
                    <div className="max-h-[min(52vh,360px)] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200">
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
                                className={`flex w-full items-center justify-between px-4 py-3 text-left text-[14px] transition ${
                                  on
                                    ? "bg-zinc-900 font-semibold text-white"
                                    : "bg-white text-zinc-800 hover:bg-zinc-50"
                                }`}
                              >
                                <span>{locale === "en" ? c.en : c.ja}</span>
                                <span className={`text-[11px] ${on ? "text-white/70" : "text-zinc-400"}`}>
                                  {c.code}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                        {filteredCountries.length === 0 ? (
                          <li className="px-4 py-6 text-center text-[13px] text-zinc-500">
                            {tx("該当する国がありません", "No matching countries")}
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="space-y-3">
                    <label className="block text-[12px] font-semibold text-zinc-600" htmlFor="ob-nick">
                      {tx("ニックネーム", "Nickname")}
                    </label>
                    <input
                      id="ob-nick"
                      autoComplete="nickname"
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-[18px] font-semibold tracking-tight text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
                      placeholder={tx("例：カイチ", "e.g. Kaichi")}
                      value={draft.nickname}
                      maxLength={32}
                      onChange={(e) => setDraft((d) => ({ ...d, nickname: e.target.value }))}
                    />
                    <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900">
                      {tx(
                        "あとからプロフィール編集でいつでも変えられます。まずは気軽に決めましょう。",
                        "You can change this anytime in Edit profile — pick something for now.",
                      )}
                    </p>
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="flex flex-col items-center gap-5">
                    <ProfileAvatar
                      displayName={draft.nickname || "?"}
                      avatarUrl={draft.avatarUrl}
                      size="xl"
                    />
                    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        <ImagePlus className="h-4 w-4" aria-hidden />
                        {tx("写真ライブラリ", "Photo library")}
                      </button>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => cameraRef.current?.click()}
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        <Camera className="h-4 w-4" aria-hidden />
                        {tx("カメラ", "Camera")}
                      </button>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        <Upload className="h-4 w-4" aria-hidden />
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
                    <p className="text-center text-[12px] text-zinc-400">
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
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800" role="alert">
                  {error}
                </p>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-5 flex items-center gap-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl border border-zinc-300 bg-white px-4 text-[14px] font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40"
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
            className="inline-flex min-h-[48px] flex-[1.4] items-center justify-center rounded-2xl bg-zinc-900 px-4 text-[14px] font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-40"
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
