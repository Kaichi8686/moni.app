"use client";

import { Camera, ImagePlus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { sortedCountries } from "@/lib/profile/countries";
import { GENDER_OPTIONS, isProfileGender, type ProfileGender } from "@/lib/profile/gender";
import { normalizeTagList, parseStringTagArray } from "@/lib/profile/skillsTraits";
import { supabase } from "@/lib/supabase";

const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif";

export function EditProfileForm() {
  const router = useRouter();
  const { locale, tx } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    birthday: "",
    gender: "" as ProfileGender | "",
    country: "",
    avatarUrl: null as string | null,
    skills: [] as string[],
    traits: [] as string[],
  });
  const [initialForm, setInitialForm] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const countries = useMemo(() => sortedCountries(locale), [locale]);
  const derivedAge = ageFromBirthday(form.birthday);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    void client.auth.getSession().then(async ({ data: session }) => {
      const uid = session.session?.user.id;
      if (!uid) {
        router.replace("/login");
        return;
      }
      setUserId(uid);
      let data: Record<string, unknown> | null = null;
      for (const sel of [
        "display_name,avatar_url,skills,traits,birthday,age,gender,country",
        "display_name,avatar_url,skills,traits,age,gender,country",
        "display_name,avatar_url,skills,traits,age,country",
        "display_name,avatar_url,skills,traits",
        "display_name,avatar_url",
      ]) {
        const res = await client.from("profiles").select(sel).eq("id", uid).maybeSingle();
        if (!res.error && res.data) {
          data = res.data as unknown as Record<string, unknown>;
          break;
        }
      }
      const name = ((data?.display_name as string) || "").trim() || "ユーザー";
      const birthdayRaw = typeof data?.birthday === "string" ? data.birthday.slice(0, 10) : "";
      const next = {
        displayName: name,
        birthday: birthdayRaw,
        gender: isProfileGender(data?.gender) ? data.gender : ("" as const),
        country: ((data?.country as string | null) ?? "").toUpperCase(),
        avatarUrl: (data?.avatar_url as string | null) ?? null,
        skills: parseStringTagArray(data?.skills),
        traits: parseStringTagArray(data?.traits),
      };
      setForm(next);
      setInitialForm(JSON.stringify(next));
    });
  }, [router]);

  const isDirty = JSON.stringify(form) !== initialForm;

  async function handleAvatarUpload(file: File) {
    if (!supabase || !userId) return;
    setUploading(true);
    setMessage("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error(tx("ログインが必要です", "Login required"));
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload-avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await res.json()) as { avatarUrl?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? tx("アップロード失敗", "Upload failed"));
      setForm((f) => ({ ...f, avatarUrl: json.avatarUrl ?? f.avatarUrl }));
      setMessage(tx("プロフィール写真を更新しました", "Profile photo updated"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : tx("アップロードに失敗しました", "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!supabase || !userId) return;
    setSaving(true);
    setMessage("");
    const skills = normalizeTagList(form.skills, 3);
    const traits = normalizeTagList(form.traits, 3);
    const birthday = parseBirthday(form.birthday);
    const ageNum = birthday ? ageFromBirthday(birthday) : null;
    const payload: Record<string, string | number | string[] | null> = {
      display_name: form.displayName.trim() || "ユーザー",
      skills,
      traits,
    };
    if (birthday) payload.birthday = birthday;
    if (ageNum != null) payload.age = ageNum;
    if (isProfileGender(form.gender)) payload.gender = form.gender;
    if (form.country.trim().length === 2) payload.country = form.country.trim().toUpperCase();

    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    setSaving(false);
    if (error) {
      const withoutExtra = { ...payload };
      delete withoutExtra.birthday;
      delete withoutExtra.age;
      delete withoutExtra.gender;
      delete withoutExtra.country;
      delete withoutExtra.traits;
      let fallback = await supabase.from("profiles").update(withoutExtra).eq("id", userId);
      if (fallback.error) {
        const withoutSkills = { ...withoutExtra };
        delete withoutSkills.skills;
        fallback = await supabase.from("profiles").update(withoutSkills).eq("id", userId);
      }
      if (fallback.error) {
        const minimal = await supabase
          .from("profiles")
          .update({ display_name: payload.display_name })
          .eq("id", userId);
        if (minimal.error) {
          setMessage(minimal.error.message);
          return;
        }
        setMessage(
          tx(
            "一部項目の保存には Supabase で apply_profile_onboarding.sql / apply_profile_skills_traits.sql を実行してください（基本項目は保存済み）。",
            "Run apply_profile_onboarding.sql / apply_profile_skills_traits.sql in Supabase for full saves (basic fields were saved).",
          ),
        );
        return;
      }
    }
    try {
      await supabase.auth.updateUser({ data: { display_name: payload.display_name } });
    } catch {
      /* ignore */
    }
    router.push("/profile");
  }

  const fieldCard =
    "overflow-hidden rounded-xl border border-zinc-200/90 bg-white";
  const fieldRow = "flex flex-col gap-1.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3";
  const fieldLabel = "shrink-0 text-[12px] font-medium text-zinc-500 sm:w-20";
  const fieldInput =
    "w-full bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400";

  return (
    <div className="account-shell w-full">
      <header className="account-header profile-inset justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex min-h-[40px] touch-manipulation items-center text-[13px] transition-opacity hover:opacity-70 active:opacity-50"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {tx("キャンセル", "Cancel")}
        </button>
        <h1 className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
          moni
        </h1>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isDirty || saving}
          className="inline-flex min-h-[40px] touch-manipulation items-center text-[13px] font-semibold transition-opacity disabled:opacity-40 active:opacity-70"
          style={{ color: "var(--color-accent)" }}
        >
          {saving ? tx("保存中...", "Saving...") : tx("完了", "Done")}
        </button>
      </header>

      <div className="profile-inset space-y-3 py-4">
        <div className={`${fieldCard} flex flex-col items-center px-3.5 py-4`}>
          <div className="relative mb-2.5">
            <ProfileAvatar displayName={form.displayName} avatarUrl={form.avatarUrl} size="lg" />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full shadow-md disabled:opacity-50"
              style={{ background: "var(--color-accent)" }}
              aria-label={tx("写真を変更", "Change photo")}
            >
              <Camera className="h-3.5 w-3.5 text-white" aria-hidden />
            </button>
          </div>
          <div className="grid w-full grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-1.5 text-[11px] font-semibold text-zinc-700 disabled:opacity-50"
            >
              <ImagePlus className="h-3 w-3" aria-hidden />
              {tx("写真", "Photos")}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => cameraRef.current?.click()}
              className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-1.5 text-[11px] font-semibold text-zinc-700 disabled:opacity-50"
            >
              <Camera className="h-3 w-3" aria-hidden />
              {tx("カメラ", "Camera")}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-1.5 text-[11px] font-semibold text-zinc-700 disabled:opacity-50"
            >
              <Upload className="h-3 w-3" aria-hidden />
              {tx("ファイル", "Files")}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-zinc-400">
            {uploading
              ? tx("アップロード中…", "Uploading…")
              : tx("あとからいつでも変更できます", "You can change this anytime")}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={AVATAR_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAvatarUpload(file);
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
              if (file) void handleAvatarUpload(file);
            }}
          />
        </div>

        <div className={fieldCard}>
          <div className={fieldRow}>
            <label className={fieldLabel} htmlFor="edit-nickname">
              {tx("ニックネーム", "Nickname")}
            </label>
            <input
              id="edit-nickname"
              autoComplete="nickname"
              className={fieldInput}
              placeholder={tx("例：カイチ", "e.g. Kaichi")}
              value={form.displayName}
              maxLength={32}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </div>
          <p className="border-t border-zinc-100 px-3.5 py-2 text-[11px] leading-relaxed text-zinc-400">
            {tx(
              "あとからいつでも変えられます。まずは気軽に決めましょう。",
              "You can change this anytime — pick something for now.",
            )}
          </p>
        </div>

        <div className={fieldCard}>
          <div className={fieldRow}>
            <label className={fieldLabel} htmlFor="edit-birthday">
              {tx("誕生日", "Birthday")}
            </label>
            <input
              id="edit-birthday"
              type="date"
              autoComplete="bday"
              min={birthdayInputMin()}
              max={birthdayInputMax()}
              className={fieldInput}
              value={form.birthday}
              onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
            />
          </div>
          {derivedAge != null ? (
            <p className="border-t border-zinc-100 px-3.5 py-2 text-[11px] text-zinc-400">
              {tx(`現在 ${derivedAge}歳`, `Currently ${derivedAge} years old`)}
            </p>
          ) : null}
        </div>

        <div className={fieldCard}>
          <div className="space-y-2 px-3.5 py-2.5">
            <p className="text-[12px] font-medium text-zinc-500">{tx("性別", "Gender")}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {GENDER_OPTIONS.map((opt) => {
                const on = form.gender === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setForm((f) => ({ ...f, gender: opt.id }))}
                    className={`min-h-[36px] rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition ${
                      on
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {locale === "en" ? opt.en : opt.ja}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={fieldCard}>
          <div className={fieldRow}>
            <label className={fieldLabel} htmlFor="edit-country">
              {tx("国", "Country")}
            </label>
            <select
              id="edit-country"
              className={`${fieldInput} appearance-none`}
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            >
              <option value="">{tx("選択してください", "Select…")}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {locale === "en" ? c.en : c.ja}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={`${fieldCard} px-3.5 py-3`}>
          <SkillsTraitsEditor
            compact
            onboardingStyle
            maxPerSection={3}
            skills={form.skills}
            traits={form.traits}
            onSkillsChange={(skills) => setForm((f) => ({ ...f, skills }))}
            onTraitsChange={(traits) => setForm((f) => ({ ...f, traits }))}
          />
        </div>
      </div>

      {message ? (
        <p className="px-4 pb-6 text-center text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
