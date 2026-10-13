"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LogOut, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { leaveProject, leaveProjectErrorMessage, type LeaveProjectErrorCode } from "@/lib/projects/leaveProject";
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

export type ProjectSettingsMeta = Pick<
  ProjectRow,
  "thumbnail_url" | "category" | "business_type" | "recruitment_target" | "recruitment_message" | "visibility"
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
  onDelete: () => Promise<void>;
  /** メンバー（非オーナー）が脱退したあと。呼び出し側でリダイレクトなど */
  onLeft?: () => void;
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
  onDelete,
  onLeft,
  onNotice,
}: Props) {
  const { tx } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrl = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [err, setErr] = useState("");
  const [editName, setEditName] = useState("");
  const [editThumb, setEditThumb] = useState("");
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [showUrlField, setShowUrlField] = useState(false);
  const [editBrief, setEditBrief] = useState<ProjectBrief>(() => emptyProjectBrief());
  const [editCategory, setEditCategory] = useState("");
  const [editBusinessType, setEditBusinessType] = useState<"maker" | "software" | "social">("software");
  const [editRecruitmentTarget, setEditRecruitmentTarget] = useState("");
  const [editRecruitmentMessage, setEditRecruitmentMessage] = useState("");
  const [editVisibility, setEditVisibility] = useState<ProjectVisibility>("public");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function clearPreviewObjectUrl() {
    if (previewObjectUrl.current) {
      URL.revokeObjectURL(previewObjectUrl.current);
      previewObjectUrl.current = null;
    }
  }

  useEffect(() => {
    if (!open) {
      clearPreviewObjectUrl();
      setThumbPreview(null);
      setConfirmDelete(false);
      setConfirmLeave(false);
      return;
    }
    setErr("");
    setConfirmDelete(false);
    setConfirmLeave(false);
    setEditName(name);
    setEditBrief(resolveProjectBrief({ coachingContext, description }));
    const thumb = meta?.thumbnail_url?.trim() ?? "";
    setEditThumb(thumb);
    setThumbPreview(thumb || null);
    setShowUrlField(Boolean(thumb && !thumb.includes("post-images")));
    setEditCategory(meta?.category ?? "");
    setEditBusinessType(
      meta?.business_type === "maker" || meta?.business_type === "social" ? meta.business_type : "software",
    );
    setEditRecruitmentTarget(meta?.recruitment_target ?? "");
    setEditRecruitmentMessage(meta?.recruitment_message ?? "");
    setEditVisibility(meta?.visibility === "private" ? "private" : "public");
  }, [open, name, description, coachingContext, meta]);

  useEffect(() => () => clearPreviewObjectUrl(), []);

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
          const { coaching_context: _drop, ...withoutCoaching } = payload;
          void _drop;
          const retry = await supabase.from("projects").update(withoutCoaching).eq("id", projectId);
          error = retry.error;
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

  const busy = saving || thumbUploading || deleting || leaving;

  async function handleDelete() {
    if (!isOwner) return;
    setDeleting(true);
    setErr("");
    try {
      await onDelete();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx("削除に失敗しました", "Failed to delete"));
    } finally {
      setDeleting(false);
    }
  }

  function leaveErrText(code: LeaveProjectErrorCode, fallback: string): string {
    const ja = leaveProjectErrorMessage(code, fallback);
    const enMap: Partial<Record<LeaveProjectErrorCode, string>> = {
      not_authenticated: "Login required.",
      project_not_found: "Project not found.",
      owner_must_transfer_first: "Owners must transfer ownership before leaving.",
      not_a_member: "You’re not a member of this project.",
      supabase_unavailable: "Supabase is not configured.",
      unknown: fallback || "Failed to leave the project.",
    };
    return tx(ja, enMap[code] ?? (fallback || "Failed to leave the project."));
  }

  async function handleLeave() {
    if (isOwner || !userId) return;
    setLeaving(true);
    setErr("");
    try {
      const result = await leaveProject(projectId);
      if (!result.ok) {
        setErr(leaveErrText(result.code, result.error));
        return;
      }
      onClose();
      onLeft?.();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-settings-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 id="project-settings-title" className="text-base font-bold text-[#1A1A1A]">
              {tx("プロジェクト設定", "Project settings")}
            </h2>
            <p className="mt-1 text-[12px] text-[#6B7280]">
              {tx("名前・詳細・募集内容などを編集できます。", "Edit the name, details, recruiting info, and more.")}
            </p>
          </div>
          <button type="button" className="rounded-md p-1 text-gray-500 hover:bg-gray-100" onClick={onClose} aria-label={tx("閉じる", "Close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {!canEdit ? (
          <p className="text-sm text-amber-800">{tx("このプロジェクトの設定を変更する権限がありません。", "You don’t have permission to change this project’s settings.")}</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-[12px] font-medium text-[#6B7280]">
              {tx("プロジェクト名", "Project name")}
              <input
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none ring-[#5E6AD2] focus:ring-2"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>

            {isOwner ? (
              <label className="block text-[12px] font-medium text-[#6B7280]">
                {tx("公開設定", "Visibility")}
                <select
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none ring-[#5E6AD2] focus:ring-2"
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

            <div>
              <span className="block text-[12px] font-medium text-[#6B7280]">{tx("写真", "Photo")}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => void onPhotoSelected(e.target.files?.[0] ?? null)}
              />
              <div className="mt-2 overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F7F8F8]">
                {thumbPreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- user upload preview */}
                    <img src={thumbPreview} alt="" className="aspect-[2/1] w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white"
                      onClick={removePhoto}
                      disabled={thumbUploading}
                    >
                      {tx("削除", "Remove")}
                    </button>
                  </div>
                ) : (
                  <div className="flex aspect-[2/1] flex-col items-center justify-center gap-1 text-[#6B7280]">
                    <ImagePlus className="h-8 w-8 opacity-50" />
                    <span className="text-[12px]">{tx("まだ写真がありません", "No photo yet")}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-semibold text-[#1A1A1A] hover:bg-[#F7F8F8] disabled:opacity-50"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={thumbUploading}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {thumbUploading ? tx("アップロード中…", "Uploading…") : tx("写真フォルダから選ぶ", "Choose from photos")}
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-2 text-[12px] text-[#6B7280] hover:text-[#1A1A1A]"
                  onClick={() => setShowUrlField((v) => !v)}
                >
                  {showUrlField ? tx("URL入力を閉じる", "Hide URL field") : tx("URLで指定", "Use a URL")}
                </button>
              </div>
              {showUrlField ? (
                <input
                  className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none ring-[#5E6AD2] focus:ring-2"
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

        {!isOwner && userId ? (
          <section className="mt-6 rounded-lg border border-rose-200 bg-rose-50/50 px-4 py-3">
            <p className="text-[12px] font-semibold text-rose-900">{tx("プロジェクトから脱退", "Leave project")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-800/90">
              {tx(
                "脱退するとメンバーではなくなり、このプロジェクトにアクセスできなくなります。",
                "Leaving removes you from the project and you’ll lose access.",
              )}
            </p>
            {!confirmLeave ? (
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-[12px] font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                disabled={busy}
                onClick={() => setConfirmLeave(true)}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                {tx("脱退する…", "Leave…")}
              </button>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void handleLeave()}
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  {leaving ? tx("脱退中…", "Leaving…") : tx("本当に脱退する", "Confirm leave")}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-semibold text-[#374151]"
                  disabled={busy}
                  onClick={() => setConfirmLeave(false)}
                >
                  {tx("キャンセル", "Cancel")}
                </button>
              </div>
            )}
          </section>
        ) : null}

        {isOwner ? (
          <section className="mt-6 rounded-lg border border-rose-200 bg-rose-50/50 px-4 py-3">
            <p className="text-[12px] font-semibold text-rose-900">{tx("危険な操作", "Danger zone")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-800/90">
              {tx(
                "プロジェクト削除は、メンバーの2/3賛成後にオーナーが最終確定する流れです。右上の「三」メニューから「プロジェクト削除…」を開いてください。脱退したい場合は「メンバー」タブから権限を引き継いでください。",
                "Deleting a project needs 2/3 member approval, then the owner confirms. Open “Delete project…” from the menu (☰) in the top right. To leave as owner, transfer ownership from the Members tab first.",
              )}
            </p>
          </section>
        ) : null}

        {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#1A1A1A] hover:bg-[#F7F8F8]"
            onClick={onClose}
            disabled={busy}
          >
            {tx("閉じる", "Close")}
          </button>
          {canEdit ? (
            <button
              type="button"
              className="rounded-lg bg-[#5E6AD2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void save()}
            >
              {saving ? tx("保存中…", "Saving…") : tx("保存", "Save")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
