"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { validateProjectImageFile } from "@/lib/projects/uploadProjectImage";
import type { ProjectRow, ProjectVisibility } from "@/lib/projects/types";
import { parseCoachingContext } from "@/lib/projects/coachingContext";
import {
  applyBriefToCoachingContext,
  composeProjectDescription,
  emptyProjectBrief,
  resolveProjectBrief,
  type ProjectBrief,
} from "@/lib/projects/projectBrief";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { WorkspaceSlideShell } from "@/components/projects/workspace/WorkspaceSlideShell";

export type ProjectSettingsMeta = Pick<
  ProjectRow,
  | "thumbnail_url"
  | "background_url"
  | "category"
  | "business_type"
  | "recruitment_target"
  | "recruitment_message"
  | "visibility"
>;

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif";

type Props = {
  open: boolean;
  projectId: string;
  userId: string | null;
  canEdit: boolean;
  isOwner: boolean;
  name: string;
  description?: string;
  coachingContext?: unknown;
  meta: ProjectSettingsMeta | null;
  onClose: () => void;
  onSaved: () => void;
  onNotice: (message: string) => void;
};

export function ProjectSettingsModal({
  open,
  projectId,
  userId,
  canEdit,
  isOwner,
  name,
  description,
  coachingContext,
  meta,
  onClose,
  onSaved,
  onNotice,
}: Props) {
  const { tx } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrl = useRef<string | null>(null);
  const bgPreviewObjectUrl = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [err, setErr] = useState("");
  const [editName, setEditName] = useState("");
  const [editThumb, setEditThumb] = useState("");
  const [editBg, setEditBg] = useState("");
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [showUrlField, setShowUrlField] = useState(false);
  const [editBrief, setEditBrief] = useState<ProjectBrief>(() => emptyProjectBrief());
  const [editCategory, setEditCategory] = useState("");
  const [editBusinessType, setEditBusinessType] = useState<"maker" | "software" | "social">("software");
  const [editRecruitmentTarget, setEditRecruitmentTarget] = useState("");
  const [editRecruitmentMessage, setEditRecruitmentMessage] = useState("");
  const [editVisibility, setEditVisibility] = useState<ProjectVisibility>("public");

  function clearPreviewObjectUrl() {
    if (previewObjectUrl.current) {
      URL.revokeObjectURL(previewObjectUrl.current);
      previewObjectUrl.current = null;
    }
  }

  function clearBgPreviewObjectUrl() {
    if (bgPreviewObjectUrl.current) {
      URL.revokeObjectURL(bgPreviewObjectUrl.current);
      bgPreviewObjectUrl.current = null;
    }
  }

  useEffect(() => {
    if (!open) {
      clearPreviewObjectUrl();
      clearBgPreviewObjectUrl();
      setThumbPreview(null);
      setBgPreview(null);
      return;
    }
    setErr("");
    setEditName(name);
    setEditBrief(resolveProjectBrief({ coachingContext, description }));
    const thumb = meta?.thumbnail_url?.trim() ?? "";
    const bg = meta?.background_url?.trim() ?? "";
    setEditThumb(thumb);
    setThumbPreview(thumb || null);
    setEditBg(bg);
    setBgPreview(bg || null);
    setShowUrlField(Boolean(thumb && !thumb.includes("post-images")));
    setEditCategory(meta?.category ?? "");
    setEditBusinessType(
      meta?.business_type === "maker" || meta?.business_type === "social" ? meta.business_type : "software",
    );
    setEditRecruitmentTarget(meta?.recruitment_target ?? "");
    setEditRecruitmentMessage(meta?.recruitment_message ?? "");
    setEditVisibility(meta?.visibility === "private" ? "private" : "public");
  }, [open, name, description, coachingContext, meta]);

  useEffect(
    () => () => {
      clearPreviewObjectUrl();
      clearBgPreviewObjectUrl();
    },
    [],
  );

  if (!open) return null;

  async function onPhotoSelected(file: File | null) {
    if (!file || !canEdit) return;
    const validationErr = validateProjectImageFile(file);
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    if (!supabase || !userId) {
      setErr(tx("ログイン後に写真をアップロードできます。", "Log in to upload a photo."));
      return;
    }
    setThumbUploading(true);
    setErr("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error(tx("ログインが必要です", "Login required"));
      const body = new FormData();
      body.append("file", file);
      body.append("projectId", projectId);
      const res = await fetch("/api/upload-project-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await res.json()) as { publicUrl?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? tx("アップロードに失敗しました", "Upload failed"));
      const publicUrl = json.publicUrl ?? "";
      clearPreviewObjectUrl();
      previewObjectUrl.current = URL.createObjectURL(file);
      setThumbPreview(publicUrl || previewObjectUrl.current);
      setEditThumb(publicUrl);
      setShowUrlField(false);
      onNotice(tx("プロジェクト写真を更新しました", "Project photo updated"));
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx("写真のアップロードに失敗しました", "Failed to upload photo"));
    } finally {
      setThumbUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto() {
    clearPreviewObjectUrl();
    setThumbPreview(null);
    setEditThumb("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!canEdit || !supabase) return;
    void supabase
      .from("projects")
      .update({ thumbnail_url: null, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .then(({ error }) => {
        if (error) {
          setErr(error.message);
          return;
        }
        onNotice(tx("プロジェクト写真を削除しました", "Project photo removed"));
        onSaved();
      });
  }

  async function onBackgroundSelected(file: File | null) {
    if (!file || !canEdit) return;
    const validationErr = validateProjectImageFile(file);
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    if (!supabase || !userId) {
      setErr(tx("ログイン後に写真をアップロードできます。", "Log in to upload a photo."));
      return;
    }
    setBgUploading(true);
    setErr("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error(tx("ログインが必要です", "Login required"));
      const body = new FormData();
      body.append("file", file);
      body.append("projectId", projectId);
      const res = await fetch("/api/upload-project-background", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await res.json()) as { backgroundUrl?: string; publicUrl?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? tx("アップロードに失敗しました", "Upload failed"));
      const publicUrl = json.backgroundUrl ?? json.publicUrl ?? "";
      clearBgPreviewObjectUrl();
      bgPreviewObjectUrl.current = URL.createObjectURL(file);
      setBgPreview(publicUrl || bgPreviewObjectUrl.current);
      setEditBg(publicUrl);
      onNotice(tx("背景写真を更新しました", "Background photo updated"));
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx("背景のアップロードに失敗しました", "Failed to upload background"));
    } finally {
      setBgUploading(false);
      if (bgInputRef.current) bgInputRef.current.value = "";
    }
  }

  function removeBackground() {
    clearBgPreviewObjectUrl();
    setBgPreview(null);
    setEditBg("");
    if (bgInputRef.current) bgInputRef.current.value = "";
    if (!canEdit || !supabase) return;
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setErr(tx("ログインが必要です", "Login required"));
        return;
      }
      const res = await fetch(`/api/upload-project-background?projectId=${encodeURIComponent(projectId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(json.error ?? tx("背景の削除に失敗しました", "Failed to remove background"));
        return;
      }
      onNotice(tx("背景写真を削除しました", "Background photo removed"));
      onSaved();
    })();
  }

  async function save() {
    if (!canEdit || !supabase) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setErr(tx("プロジェクト名を入力してください。", "Enter a project name."));
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const descriptionText = composeProjectDescription(editBrief);
      const nextCoaching = applyBriefToCoachingContext(parseCoachingContext(coachingContext), editBrief);
      const payload: Record<string, unknown> = {
          name: trimmedName,
          thumbnail_url: editThumb.trim() || null,
          background_url: editBg.trim() || null,
          description: descriptionText,
          coaching_context: nextCoaching,
          category: editCategory.trim() || tx("探究", "Inquiry"),
          business_type: editBusinessType,
          recruitment_target: editRecruitmentTarget.trim(),
          recruitment_message: editRecruitmentMessage.trim(),
          updated_at: new Date().toISOString(),
        };
      if (isOwner) payload.visibility = editVisibility;
      let { error } = await supabase.from("projects").update(payload).eq("id", projectId);
      if (error) {
        const schemaMismatch =
          error.code === "42703" ||
          error.code === "PGRST204" ||
          error.message.includes("does not exist") ||
          error.message.includes("schema cache");
        if (schemaMismatch) {
          const { coaching_context: _drop, background_url: _bg, ...withoutOptional } = payload;
          void _drop;
          void _bg;
          const retry = await supabase.from("projects").update(withoutOptional).eq("id", projectId);
          error = retry.error;
          if (!error && editBg.trim()) {
            onSaved();
            onNotice(tx("プロジェクト設定を保存しました", "Project settings saved"));
            setErr(
              tx(
                "背景の保存には Supabase で apply_project_background_url.sql の実行が必要です。",
                "To save the background, run apply_project_background_url.sql in Supabase.",
              ),
            );
            return;
          }
        }
      }
      if (error) {
        setErr(error.message);
        return;
      }
      onSaved();
      onNotice(tx("プロジェクト設定を保存しました", "Project settings saved"));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || thumbUploading || bgUploading;

  if (!open) return null;

  return (
    <WorkspaceSlideShell
      title={tx("プロジェクト設定", "Project settings")}
      onClose={onClose}
      contentClassName="px-0 pt-0"
    >
      <input
        ref={bgInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => void onBackgroundSelected(e.target.files?.[0] ?? null)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => void onPhotoSelected(e.target.files?.[0] ?? null)}
      />

      {/* Overview-style hero: background + project icon (editable) */}
      <section className="border-b border-zinc-200 bg-white">
        <button
          type="button"
          disabled={!canEdit || bgUploading}
          onClick={() => canEdit && bgInputRef.current?.click()}
          className="relative block h-44 w-full overflow-hidden bg-zinc-100 sm:h-52 disabled:cursor-default"
          aria-label={tx("背景を変更", "Change background")}
        >
          {bgPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-owned Supabase image
            <img src={bgPreview} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(145deg, #fed7aa 0%, #fdba74 42%, #fb923c 100%)",
              }}
              aria-hidden
            />
          )}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent"
            aria-hidden
          />
          {canEdit ? (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">
              <Camera className="h-3.5 w-3.5" />
              {bgUploading ? tx("アップロード中…", "Uploading…") : tx("背景を編集", "Edit background")}
            </span>
          ) : null}
        </button>

        <div className="px-4 pb-4">
          <div className="relative z-10 -mt-9 flex items-end gap-3">
            <button
              type="button"
              disabled={!canEdit || thumbUploading}
              onClick={() => canEdit && fileInputRef.current?.click()}
              className="relative h-16 w-16 shrink-0 rounded-lg border-2 border-white bg-zinc-100 shadow-sm sm:h-20 sm:w-20 disabled:cursor-default"
              aria-label={tx("アイコンを変更", "Change icon")}
            >
              <span className="absolute inset-0 overflow-hidden rounded-[6px]">
                {thumbPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user-owned Supabase image
                  <img src={thumbPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-orange-100 text-3xl">📁</div>
                )}
              </span>
              {canEdit ? (
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm ring-2 ring-white">
                  <Camera className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
              ) : null}
            </button>
            <div className="min-w-0 flex-1 pb-0.5 pt-10">
              <p className="truncate text-lg font-semibold tracking-tight text-zinc-950 sm:text-xl">
                {editName.trim() || name}
              </p>
              {canEdit ? (
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {tx("背景・アイコンをタップして変更", "Tap background or icon to edit")}
                </p>
              ) : null}
            </div>
          </div>
          {canEdit ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {bgPreview ? (
                <button
                  type="button"
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium text-zinc-500 hover:text-rose-600"
                  onClick={removeBackground}
                  disabled={bgUploading}
                >
                  {tx("背景を削除", "Remove background")}
                </button>
              ) : null}
              {thumbPreview ? (
                <button
                  type="button"
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium text-zinc-500 hover:text-rose-600"
                  onClick={removePhoto}
                  disabled={thumbUploading}
                >
                  {tx("アイコンを削除", "Remove icon")}
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-full px-2.5 py-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-800"
                onClick={() => setShowUrlField((v) => !v)}
              >
                {showUrlField ? tx("URL入力を閉じる", "Hide URL field") : tx("アイコンをURLで指定", "Icon via URL")}
              </button>
            </div>
          ) : null}
          {showUrlField && canEdit ? (
            <input
              className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none ring-[#FF9600] focus:ring-2"
              placeholder="https://..."
              value={editThumb}
              onChange={(e) => {
                setEditThumb(e.target.value);
                setThumbPreview(e.target.value.trim() || null);
                clearPreviewObjectUrl();
              }}
            />
          ) : null}
        </div>
      </section>

      <div className="px-4 pt-4">
        {!canEdit ? (
          <p className="text-sm text-amber-800">{tx("このプロジェクトの設定を変更する権限がありません。", "You don’t have permission to change this project’s settings.")}</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-[12px] font-medium text-[#6B7280]">
              {tx("プロジェクト名", "Project name")}
              <input
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none ring-[#FF9600] focus:ring-2"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>

            {isOwner ? (
              <label className="block text-[12px] font-medium text-[#6B7280]">
                {tx("公開設定", "Visibility")}
                <select
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none ring-[#FF9600] focus:ring-2"
                  value={editVisibility}
                  onChange={(e) => setEditVisibility(e.target.value as ProjectVisibility)}
                >
                  <option value="public">{tx("公開（探すタブに表示）", "Public (shown in Discover)")}</option>
                  <option value="private">{tx("非公開（メンバーのみ）", "Private (members only)")}</option>
                </select>
                <span className="mt-1 block text-[11px] font-normal leading-relaxed text-[#9CA3AF]">
                  {tx("公開中は未参加のユーザーも概要を見られます。非公開は招待・参加メンバーだけがアクセスできます。", "Public projects can be viewed by people who haven’t joined. Private ones are invite/members only.")}
                </span>
              </label>
            ) : null}

            <div className="space-y-2 rounded-lg border border-[#E5E7EB] bg-[#F7F8F8] p-3">
              <p className="text-[12px] font-semibold text-[#374151]">{tx("プロジェクトの詳細", "Project details")}</p>
              <label className="block text-[12px] font-medium text-[#6B7280]">
                {tx(
                  "どのようなことを解決したくてこのプロジェクトを思いついたか",
                  "What problem made you think of this project?",
                )}
                <textarea
                  className="mt-1 min-h-[4rem] w-full resize-y rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none ring-[#5E6AD2] focus:ring-2"
                  value={editBrief.problemMotivation}
                  onChange={(e) => setEditBrief((b) => ({ ...b, problemMotivation: e.target.value }))}
                />
              </label>
              <label className="block text-[12px] font-medium text-[#6B7280]">
                {tx("このプロジェクトのゴール", "Project goal")}
                <textarea
                  className="mt-1 min-h-[3rem] w-full resize-y rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none ring-[#5E6AD2] focus:ring-2"
                  value={editBrief.projectGoal}
                  onChange={(e) => setEditBrief((b) => ({ ...b, projectGoal: e.target.value }))}
                />
              </label>
              <label className="block text-[12px] font-medium text-[#6B7280]">
                {tx("何をするのか", "What will you do?")}
                <textarea
                  className="mt-1 min-h-[3rem] w-full resize-y rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none ring-[#5E6AD2] focus:ring-2"
                  value={editBrief.whatToDo}
                  onChange={(e) => setEditBrief((b) => ({ ...b, whatToDo: e.target.value }))}
                />
              </label>
            </div>
            <label className="block text-[12px] font-medium text-[#6B7280]">
              {tx("カテゴリ", "Category")}
              <input
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none ring-[#5E6AD2] focus:ring-2"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
              />
            </label>
            <label className="block text-[12px] font-medium text-[#6B7280]">
              {tx("何系のプロジェクトか", "What kind of project")}
              <select
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none ring-[#5E6AD2] focus:ring-2"
                value={editBusinessType}
                onChange={(e) => setEditBusinessType(e.target.value as "maker" | "software" | "social")}
              >
                <option value="software">{tx("ソフトウェア・アプリ", "Software / app")}</option>
                <option value="maker">{tx("ものづくり・物販", "Making / products")}</option>
                <option value="social">{tx("社会課題・コミュニティ", "Social / community")}</option>
              </select>
            </label>
            <label className="block text-[12px] font-medium text-[#6B7280]">
              {tx("欲しい仲間・姿勢", "Who you’re looking for")}
              <textarea
                className="mt-1 min-h-[3rem] w-full resize-y rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none ring-[#5E6AD2] focus:ring-2"
                value={editRecruitmentTarget}
                onChange={(e) => setEditRecruitmentTarget(e.target.value)}
              />
            </label>
            <label className="block text-[12px] font-medium text-[#6B7280]">
              {tx("理念・ビジョン", "Mission / vision")}
              <textarea
                className="mt-1 min-h-[3rem] w-full resize-y rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none ring-[#5E6AD2] focus:ring-2"
                value={editRecruitmentMessage}
                onChange={(e) => setEditRecruitmentMessage(e.target.value)}
              />
            </label>
          </div>
        )}

        {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}
      </div>

      {canEdit ? (
        <div className="sticky bottom-0 mt-4 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <button
            type="button"
            className="w-full rounded-full bg-[#FF9600] py-3.5 text-[15px] font-semibold text-white transition active:opacity-90 disabled:opacity-50"
            disabled={busy}
            onClick={() => void save()}
          >
            {saving ? tx("保存中…", "Saving…") : tx("保存", "Save")}
          </button>
        </div>
      ) : null}
    </WorkspaceSlideShell>
  );
}
