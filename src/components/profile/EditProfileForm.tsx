"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { SkillsTraitsEditor } from "@/components/profile/SkillsTraitsEditor";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { resolveProfileBio } from "@/lib/profile/resolveBio";
import { normalizeTagList, parseStringTagArray } from "@/lib/profile/skillsTraits";
import { profileUsername } from "@/lib/profile/username";
import { supabase } from "@/lib/supabase";

export function EditProfileForm() {
  const router = useRouter();
  const { tx } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    bio: "",
    website: "",
    school: "",
    location: "",
    avatarUrl: null as string | null,
    skills: [] as string[],
    traits: [] as string[],
  });
  const [initialForm, setInitialForm] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

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
        "display_name,goal,avatar_url,bio,website,school,location,skills,traits",
        "display_name,goal,avatar_url,bio,website,school,location,skills",
        "display_name,goal,avatar_url,bio,website,school,location",
        "display_name,goal,avatar_url,bio,website",
        "display_name,goal,avatar_url",
      ]) {
        const res = await client.from("profiles").select(sel).eq("id", uid).maybeSingle();
        if (!res.error && res.data) {
          data = res.data as unknown as Record<string, unknown>;
          break;
        }
      }
      const name = ((data?.display_name as string) || "").trim() || "ユーザー";
      const next = {
        displayName: name,
        username: profileUsername(name, uid),
        bio: data ? resolveProfileBio(data as { bio?: string | null; goal?: string | null }) : "",
        website: (data?.website as string | null) ?? "",
        school: (data?.school as string | null) ?? "",
        location: (data?.location as string | null) ?? "",
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
    }
  }

  async function handleSave() {
    if (!supabase || !userId) return;
    setSaving(true);
    setMessage("");
    const skills = normalizeTagList(form.skills);
    const traits = normalizeTagList(form.traits);
    const payload: Record<string, string | string[]> = {
      display_name: form.displayName.trim() || "ユーザー",
      goal: form.bio.trim(),
      bio: form.bio.trim(),
      skills,
      traits,
    };
    if (form.website.trim()) payload.website = form.website.trim();
    if (form.school.trim()) payload.school = form.school.trim();
    if (form.location.trim()) payload.location = form.location.trim();

    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    setSaving(false);
    if (error) {
      const withoutTraits = { ...payload };
      delete withoutTraits.traits;
      let fallback = await supabase.from("profiles").update(withoutTraits).eq("id", userId);
      if (fallback.error) {
        const withoutSkills = { ...withoutTraits };
        delete withoutSkills.skills;
        fallback = await supabase.from("profiles").update(withoutSkills).eq("id", userId);
      }
      if (fallback.error) {
        const minimal = await supabase
          .from("profiles")
          .update({ display_name: payload.display_name, goal: payload.goal })
          .eq("id", userId);
        if (minimal.error) {
          setMessage(minimal.error.message);
          return;
        }
        setMessage(
          tx(
            "特技・性格の保存には Supabase で apply_profile_skills_traits.sql を実行してください（他の項目は保存済み）。",
            "Run apply_profile_skills_traits.sql in Supabase to save skills/traits (other fields were saved).",
          ),
        );
        return;
      }
    }
    router.push("/profile");
  }

  const fields: Array<{
    label: string;
    field: "displayName" | "username" | "bio" | "school" | "location" | "website";
    placeholder: string;
    multiline: boolean;
    readOnly?: boolean;
  }> = [
    { label: tx("表示名", "Display name"), field: "displayName", placeholder: tx("例：カイチ", "e.g. Kaichi"), multiline: false },
    { label: tx("ユーザーID", "Username"), field: "username", placeholder: tx("表示のみ", "Display only"), multiline: false, readOnly: true },
    { label: tx("自己紹介", "Bio"), field: "bio", placeholder: tx("いま挑戦していることを一言で", "What you’re working on, in a sentence"), multiline: true },
    { label: tx("学校", "School"), field: "school", placeholder: tx("例：○○大学 2年", "e.g. University, 2nd year"), multiline: false },
    { label: tx("場所", "Location"), field: "location", placeholder: tx("例：東京", "e.g. Tokyo"), multiline: false },
    { label: tx("リンク", "Link"), field: "website", placeholder: "https://", multiline: false },
  ];

  return (
    <div className="account-shell w-full">
      <header className="account-header profile-inset justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex min-h-[44px] touch-manipulation items-center text-[14px] transition-opacity hover:opacity-70 active:opacity-50"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {tx("キャンセル", "Cancel")}
        </button>
        <h1 className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
          moni
        </h1>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isDirty || saving}
          className="inline-flex min-h-[44px] touch-manipulation items-center text-[14px] font-semibold transition-opacity disabled:opacity-40 active:opacity-70"
          style={{ color: "var(--color-accent)" }}
        >
          {saving ? tx("保存中...", "Saving...") : tx("完了", "Done")}
        </button>
      </header>

      <div className="profile-inset space-y-6 py-5">
        <div className="account-card flex flex-col items-center py-6">
          <div className="relative mb-3">
            <ProfileAvatar displayName={form.displayName} avatarUrl={form.avatarUrl} size="lg" />
            <label
              className="absolute -bottom-1 -right-1 flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-full shadow-md"
              style={{ background: "var(--color-accent)" }}
            >
              <Camera className="h-4 w-4 text-white" aria-hidden />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAvatarUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <label className="cursor-pointer text-[13px] font-semibold" style={{ color: "var(--color-accent)" }}>
            {uploading ? tx("アップロード中…", "Uploading…") : tx("写真を変更", "Change photo")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAvatarUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {fields.map(({ label, field, placeholder, multiline, readOnly }) => (
          <div key={field} className="account-card overflow-hidden">
            <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-start sm:gap-4">
              <label
                className="shrink-0 text-[13px] font-medium sm:w-24 sm:pt-0.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {label}
              </label>
              {multiline ? (
                <textarea
                  rows={3}
                  className="flex-1 resize-none bg-transparent text-[14px] outline-none"
                  style={{ color: "var(--color-text-primary)" }}
                  placeholder={placeholder}
                  value={String(form[field] ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                />
              ) : (
                <input
                  className="flex-1 bg-transparent text-[14px] outline-none disabled:opacity-60"
                  style={{ color: "var(--color-text-primary)" }}
                  placeholder={placeholder}
                  value={String(form[field] ?? "")}
                  readOnly={readOnly}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                />
              )}
            </div>
          </div>
        ))}

        <div className="account-card px-4 py-4">
          <SkillsTraitsEditor
            compact
            skills={form.skills}
            traits={form.traits}
            onSkillsChange={(skills) => setForm((f) => ({ ...f, skills }))}
            onTraitsChange={(traits) => setForm((f) => ({ ...f, traits }))}
          />
        </div>
      </div>

      {message ? (
        <p className="px-4 pb-6 text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
