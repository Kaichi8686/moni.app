"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Link2,
  MoreVertical,
  PenTool,
  Plus,
  StickyNote,
  X,
} from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { AssigneeMultiSelect } from "@/components/issues/AssigneeMultiSelect";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { uploadProjectImage } from "@/lib/projects/uploadProjectImage";
import { createProjectBoard, deleteProjectBoard } from "@/lib/projects/whiteboard/boardApi";
import { supabase } from "@/lib/supabase";
import {
  clearIssueCreateDraft,
  clearIssueCreateOpen,
  markIssueCreateOpen,
  orderFilesForPublish,
  readIssueCreateDraft,
  replaceWorkFileInPlace,
  writeIssueCreateDraft,
} from "@/lib/workspace/issueCreateDraft";
import { dateInputToIso } from "@/lib/workspace/issueWork";
import {
  appendFileItem,
  createWorkFileId,
  defaultTitle,
  normalizeExternalUrl,
  resolveDraftLinkCreation,
  newCanvasWorkFile,
  newLinkSlotFile,
  newPhotoSlotFile,
  removeWorkFile,
  setWorkFileRequired,
  type IssueWorkFile,
  type IssueWorkFileItem,
  type IssueWorkFileKind,
} from "@/lib/workspace/issueWorkFiles";
import type { Member, TaskGenre } from "@/lib/workspace/types";

type Step = "details" | "files";

type Props = {
  projectId: string;
  phaseId: string | null;
  genre: TaskGenre;
  members: Member[];
  uid: string | null;
  onClose: () => void;
  onComplete: (payload: {
    title: string;
    description: string;
    assigneeIds: string[];
    dueDate: string | null;
    beginAt: string | null;
    workFiles: IssueWorkFile[];
  }) => Promise<void>;
};

function kindLabel(kind: IssueWorkFileKind, tx: (ja: string, en: string) => string) {
  if (kind === "doc") return tx("ドキュメント", "Document");
  if (kind === "board") return tx("ホワイトボード", "Whiteboard");
  if (kind === "photo") return tx("写真依頼", "Photo request");
  if (kind === "link") return tx("リンク依頼", "Link request");
  return tx("作業スペース", "Workspace");
}

function FileKindIcon({ kind }: { kind: IssueWorkFileKind }) {
  if (kind === "doc") {
    return (
      <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <path fill="#4285F4" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
      </svg>
    );
  }
  if (kind === "board") {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EDE9FE] text-[#7C3AED]">
        <StickyNote className="h-5 w-5" aria-hidden />
      </span>
    );
  }
  if (kind === "photo") {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#2E7D32]">
        <ImageIcon className="h-5 w-5" aria-hidden />
      </span>
    );
  }
  if (kind === "link") {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E3F2FD] text-[#1565C0]">
        <Link2 className="h-5 w-5" aria-hidden />
      </span>
    );
  }
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF3E0] text-[#E65100]">
      <PenTool className="h-5 w-5" aria-hidden />
    </span>
  );
}

/** iOS など入力後の拡大を元に戻す */
function resetViewportZoom() {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const prev = meta.getAttribute("content") || "width=device-width, initial-scale=1";
  meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1");
  window.setTimeout(() => {
    meta.setAttribute("content", prev.includes("width=") ? prev : "width=device-width, initial-scale=1");
  }, 80);
}

export function IssueCreateWizard({
  projectId,
  phaseId,
  genre,
  members,
  uid,
  onClose,
  onComplete,
}: Props) {
  const { tx } = useI18n();
  const lastTitleTap = useRef<{ id: string; at: number } | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>("details");
  const [stepAnim, setStepAnim] = useState<"idle" | "to-files" | "to-details">("idle");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [beginAt, setBeginAt] = useState("");
  const [files, setFiles] = useState<IssueWorkFile[]>([]);
  const [fabOpen, setFabOpen] = useState(false);
  const [namePrompt, setNamePrompt] = useState<IssueWorkFileKind | null>(null);
  const [draftName, setDraftName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [draftSlotItems, setDraftSlotItems] = useState<IssueWorkFileItem[]>([]);
  const [draftLinkUrl, setDraftLinkUrl] = useState("");
  const [draftLinkTitle, setDraftLinkTitle] = useState("");
  const [uploadingDraft, setUploadingDraft] = useState(false);
  const draftPhotoRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const canGoNext = Boolean(title.trim());
  const isDirty = useMemo(
    () =>
      Boolean(title.trim()) ||
      Boolean(description.trim()) ||
      assignees.length > 0 ||
      Boolean(dueDate) ||
      Boolean(beginAt) ||
      files.length > 0,
    [title, description, assignees, dueDate, beginAt, files],
  );

  // 下書き復元（完了してから書き込み開始）
  useEffect(() => {
    const draft = readIssueCreateDraft(projectId, phaseId, genre);
    if (draft) {
      setStep(draft.step);
      setTitle(draft.title);
      setDescription(draft.description);
      setAssignees(draft.assignees);
      setDueDate(draft.dueDate);
      setBeginAt(draft.beginAt);
      setFiles(draft.files);
    }
    setHydrated(true);
  }, [projectId, phaseId, genre]);

  // 下書き保存
  useEffect(() => {
    if (!hydrated) return;
    writeIssueCreateDraft(projectId, phaseId, genre, {
      step,
      title,
      description,
      assignees,
      dueDate,
      beginAt,
      files,
    });
  }, [hydrated, projectId, phaseId, genre, step, title, description, assignees, dueDate, beginAt, files]);

  useEffect(() => {
    setPortalReady(true);
    markIssueCreateOpen(projectId, phaseId, genre);
    const id = window.requestAnimationFrame(() => setEntered(true));
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflowX = document.documentElement.style.overflowX;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflowX = "hidden";
    return () => {
      window.cancelAnimationFrame(id);
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflowX = prevHtmlOverflowX;
    };
  }, [projectId, phaseId, genre]);

  function clearDraftAndClose() {
    clearIssueCreateDraft(projectId, phaseId, genre);
    clearIssueCreateOpen(projectId);
    setConfirmDiscard(false);
    setExiting(true);
    window.setTimeout(() => onClose(), 220);
  }

  function requestClose() {
    if (saving) return;
    // ファイル画面の戻る → 詳細へ（確認なし・データ保持）
    if (step === "files") {
      setError("");
      setFabOpen(false);
      setMenuId(null);
      setStepAnim("to-details");
      setStep("details");
      return;
    }
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    clearDraftAndClose();
  }

  function goToFiles() {
    if (!canGoNext) return;
    setError("");
    setStepAnim("to-files");
    setStep("files");
  }

  function clearDraftSlotExtras() {
    setDraftSlotItems([]);
    setDraftLinkUrl("");
    setDraftLinkTitle("");
    setUploadingDraft(false);
    if (draftPhotoRef.current) draftPhotoRef.current.value = "";
  }

  function openNamePrompt(kind: IssueWorkFileKind) {
    setFabOpen(false);
    setRenameId(null);
    setNamePrompt(kind);
    setDraftName(defaultTitle(kind));
    clearDraftSlotExtras();
    setError("");
  }

  function openRename(file: IssueWorkFile) {
    setFabOpen(false);
    setMenuId(null);
    setNamePrompt(null);
    setRenameId(file.id);
    setDraftName(file.title || defaultTitle(file.kind));
    clearDraftSlotExtras();
    setError("");
  }

  async function addDraftPhotos(list: FileList | null) {
    if (!list || !uid || !supabase) return;
    setUploadingDraft(true);
    setError("");
    try {
      const added: IssueWorkFileItem[] = [];
      for (const file of Array.from(list)) {
        const uploaded = await uploadProjectImage(supabase, uid, "issue-photo", projectId, file);
        added.push({
          id: createWorkFileId(),
          url: uploaded.publicUrl,
          title: file.name.replace(/\.[^.]+$/, "") || undefined,
          addedBy: uid,
          addedAt: new Date().toISOString(),
        });
      }
      setDraftSlotItems((prev) => [...prev, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("写真を追加できませんでした", "Couldn’t add the photo"));
    } finally {
      setUploadingDraft(false);
      if (draftPhotoRef.current) draftPhotoRef.current.value = "";
    }
  }

  function addDraftLink() {
    const url = normalizeExternalUrl(draftLinkUrl);
    if (!url) {
      setError(tx("正しいURLを入力してください", "Enter a valid URL"));
      return;
    }
    setError("");
    setDraftSlotItems((prev) => [
      ...prev,
      {
        id: createWorkFileId(),
        url,
        title: draftLinkTitle.trim() || undefined,
        addedBy: uid ?? undefined,
        addedAt: new Date().toISOString(),
      },
    ]);
    setDraftLinkUrl("");
    setDraftLinkTitle("");
  }

  function handleTitleTap(file: IssueWorkFile) {
    const now = Date.now();
    const prev = lastTitleTap.current;
    if (prev && prev.id === file.id && now - prev.at < 350) {
      lastTitleTap.current = null;
      openRename(file);
      return;
    }
    lastTitleTap.current = { id: file.id, at: now };
  }

  async function createNamedFile() {
    if (!namePrompt) return;
    if (!uid) {
      setError(tx("ログインが必要です", "Sign in required"));
      return;
    }
    const name = draftName.trim() || defaultTitle(namePrompt);
    setCreating(true);
    setError("");
    try {
      let next: IssueWorkFile;
      if (namePrompt === "doc") {
        if (!supabase) throw new Error(tx("ドキュメントを作成できません", "Can’t create a document"));
        const { data, error: err } = await supabase
          .from("project_documents")
          .insert({
            project_id: projectId,
            title: name,
            content: "",
            updated_by: uid,
          })
          .select("id,title,updated_at")
          .single();
        if (err || !data) throw new Error(err?.message ?? tx("作成に失敗しました", "Couldn’t create"));
        next = {
          id: createWorkFileId(),
          kind: "doc",
          title: data.title || name,
          refId: data.id,
          updatedAt: data.updated_at || new Date().toISOString(),
        };
      } else if (namePrompt === "board") {
        const board = await createProjectBoard(projectId, uid, name);
        next = {
          id: createWorkFileId(),
          kind: "board",
          title: board.title || name,
          refId: board.id,
          updatedAt: board.updated_at || new Date().toISOString(),
        };
      } else if (namePrompt === "canvas") {
        next = newCanvasWorkFile(name);
      } else if (namePrompt === "photo") {
        next = newPhotoSlotFile(name);
        for (const item of draftSlotItems) next = appendFileItem(next, item);
      } else {
        const resolved = resolveDraftLinkCreation({
          fileName: name,
          draftItems: draftSlotItems,
          pendingUrl: draftLinkUrl,
          pendingTitle: draftLinkTitle,
          addedBy: uid,
        });
        if ("error" in resolved) {
          setError(tx("正しいURLを入力してください", "Enter a valid URL"));
          setCreating(false);
          return;
        }
        next = newLinkSlotFile(resolved.title);
        for (const item of resolved.items) next = appendFileItem(next, item);
      }
      setFiles((prev) => replaceWorkFileInPlace(prev, next));
      setNamePrompt(null);
      setDraftName("");
      clearDraftSlotExtras();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("作成に失敗しました", "Couldn’t create"));
    } finally {
      setCreating(false);
    }
  }

  async function saveRename() {
    if (!renameId) return;
    const file = files.find((item) => item.id === renameId);
    if (!file) {
      setRenameId(null);
      return;
    }
    const name = draftName.trim() || defaultTitle(file.kind);
    setCreating(true);
    setError("");
    try {
      if (file.kind === "doc" && supabase) {
        await supabase.from("project_documents").update({ title: name }).eq("id", file.refId);
      }
      if (file.kind === "board" && supabase) {
        await supabase.from("project_boards").update({ title: name }).eq("id", file.refId);
      }
      setFiles((prev) =>
        replaceWorkFileInPlace(prev, {
          ...file,
          title: name,
          // 位置を動かさないため updatedAt は変えない
        }),
      );
      setRenameId(null);
      setDraftName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("名前を変えられませんでした", "Couldn’t rename"));
    } finally {
      setCreating(false);
    }
  }

  async function deleteFile(file: IssueWorkFile) {
    setMenuId(null);
    try {
      if (file.kind === "doc" && supabase) {
        await supabase.from("project_documents").delete().eq("id", file.refId);
      }
      if (file.kind === "board") {
        await deleteProjectBoard(file.refId);
      }
      setFiles((prev) => removeWorkFile(prev, file.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("削除に失敗しました", "Couldn’t delete"));
    }
  }

  function toggleRequired(file: IssueWorkFile) {
    // 作成中は並びを変えず、必須フラグだけ更新
    const next = setWorkFileRequired(file, !file.required);
    setFiles((prev) => replaceWorkFileInPlace(prev, { ...next, updatedAt: file.updatedAt }));
  }

  async function finish() {
    if (!canGoNext || saving) return;
    setSaving(true);
    setError("");
    try {
      await onComplete({
        title: title.trim(),
        description: description.trim(),
        assigneeIds: assignees,
        dueDate: dateInputToIso(dueDate),
        beginAt: dateInputToIso(beginAt),
        workFiles: orderFilesForPublish(files),
      });
      clearIssueCreateDraft(projectId, phaseId, genre);
      clearIssueCreateOpen(projectId);
      setExiting(true);
      window.setTimeout(() => onClose(), 180);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("課題を追加できませんでした", "Couldn’t add the task"));
      setSaving(false);
    }
  }

  if (!portalReady) return null;

  const nameDialogOpen = Boolean(namePrompt || renameId);

  return createPortal(
    <>
    <div
      className={`fixed inset-0 z-[300] flex w-full max-w-[100vw] flex-col overscroll-none bg-white ${
        exiting ? "issue-create-wizard-out" : entered ? "issue-create-wizard-in" : "translate-x-full"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={tx("課題を作成", "Create task")}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          disabled={saving}
          onClick={requestClose}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 bg-white text-zinc-800 shadow-[0_2px_0_#D4D4D8] transition-[transform,box-shadow] duration-75 enabled:active:translate-y-[2px] enabled:active:shadow-none disabled:opacity-50"
          aria-label={tx("戻る", "Back")}
        >
          <ArrowLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-extrabold leading-tight text-zinc-900">
          {step === "details" ? tx("課題を作成", "Create task") : tx("ファイルを用意", "Prepare files")}
        </h1>
      </div>

      <div className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-hidden">
        {/* 詳細 */}
        <div
          className={`absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] pt-4 ${
            step === "details"
              ? stepAnim === "to-details"
                ? "issue-create-step-from-left"
                : ""
              : "pointer-events-none"
          }`}
          style={step === "details" ? undefined : { visibility: "hidden" }}
          aria-hidden={step !== "details"}
        >
          <div className="mx-auto flex w-full max-w-lg min-w-0 flex-col gap-4">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold text-zinc-700">{tx("名前", "Name")}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={resetViewportZoom}
                placeholder={tx("課題名", "Task name")}
                className="min-h-[48px] w-full rounded-2xl border border-zinc-200 px-3 text-[16px] outline-none focus:border-[#FF9600]"
                autoFocus={step === "details"}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold text-zinc-700">{tx("説明", "Description")}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={resetViewportZoom}
                rows={4}
                placeholder={tx("何をする課題か（任意）", "What should be done (optional)")}
                className="w-full resize-y rounded-2xl border border-zinc-200 px-3 py-2.5 text-[16px] outline-none focus:border-[#FF9600]"
              />
            </label>
            <div className="space-y-1.5">
              <span className="text-[12px] font-semibold text-zinc-700">{tx("担当者", "Assignees")}</span>
              <AssigneeMultiSelect
                members={members}
                selectedIds={assignees}
                onChange={setAssignees}
                idPrefix="wizard-assignee"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-[12px] font-semibold text-zinc-700">{tx("やり始める", "Start")}</span>
                <input
                  type="date"
                  value={beginAt}
                  onChange={(e) => setBeginAt(e.target.value)}
                  onBlur={resetViewportZoom}
                  className="min-h-[48px] w-full rounded-2xl border border-zinc-200 px-3 text-[16px]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-semibold text-zinc-700">{tx("締め切り", "Deadline")}</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  onBlur={resetViewportZoom}
                  className="min-h-[48px] w-full rounded-2xl border border-zinc-200 px-3 text-[16px]"
                />
              </label>
            </div>
            {error && step === "details" ? <p className="text-sm text-rose-600">{error}</p> : null}
          </div>
        </div>

        {/* ファイル */}
        <div
          className={`absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] ${
            step === "files"
              ? stepAnim === "to-files"
                ? "issue-create-step-from-right"
                : ""
              : "pointer-events-none"
          }`}
          style={step === "files" ? undefined : { visibility: "hidden" }}
          aria-hidden={step !== "files"}
        >
          <div className="mx-auto w-full min-w-0 max-w-lg px-2 pt-2">
            <p className="px-2 pb-2 text-[13px] text-zinc-500">
              {tx(
                "公開前にファイルを用意できます。写真・リンクは担当者が後から入れる枠になります。",
                "Prepare files before publishing. Photos and links become slots assignees fill in.",
              )}
            </p>
            <ul className="divide-y divide-[#e8eaed]">
              {files.length === 0 ? (
                <li className="px-3 py-14 text-center text-[14px] text-zinc-500">
                  {tx("まだファイルはありません。右下の＋から追加。", "No files yet. Add with + below.")}
                </li>
              ) : (
                orderFilesForPublish(files).map((file) => (
                  <li
                    key={file.id}
                    className={`relative flex items-center gap-1 border-l-4 pr-2 ${
                      file.required ? "border-l-[#FF9600] bg-[#FFF4EC]" : "border-l-transparent bg-white"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
                      <FileKindIcon kind={file.kind} />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => handleTitleTap(file)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="block min-w-0 truncate text-[15px] text-[#202124]">
                            {file.title || defaultTitle(file.kind)}
                          </span>
                          {file.required ? (
                            <span className="shrink-0 rounded-md bg-[#FF9600] px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                              {tx("必須", "Required")}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-[#5f6368]">
                          {kindLabel(file.kind, tx)}
                        </span>
                      </button>
                    </div>
                    <DuoButton
                      type="button"
                      tone={file.required ? "orange" : "peach"}
                      size="md"
                      onClick={() => toggleRequired(file)}
                      className="!min-h-0 !px-3 !py-2 !text-[12px] !font-bold"
                    >
                      {tx("必須", "Must")}
                    </DuoButton>
                    <button
                      type="button"
                      className="shrink-0 rounded-full p-2 text-[#5f6368] hover:bg-[#f1f3f4]"
                      aria-label={tx("その他", "More")}
                      onClick={() => setMenuId(menuId === file.id ? null : file.id)}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {menuId === file.id ? (
                      <>
                        <button type="button" className="fixed inset-0 z-40" aria-label={tx("閉じる", "Close")} onClick={() => setMenuId(null)} />
                        <div className="absolute right-2 top-full z-50 min-w-[140px] rounded-lg border border-[#dadce0] bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-4 py-2.5 text-left text-[14px] text-[#202124] hover:bg-[#f8f9fa]"
                            onClick={() => openRename(file)}
                          >
                            {tx("名前を変更", "Rename")}
                          </button>
                          <button
                            type="button"
                            className="block w-full px-4 py-2.5 text-left text-[14px] text-[#d93025] hover:bg-[#fce8e6]"
                            onClick={() => void deleteFile(file)}
                          >
                            {tx("削除", "Delete")}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            {error && step === "files" ? <p className="px-3 pt-2 text-sm text-rose-600">{error}</p> : null}
          </div>

        </div>
      </div>

      {confirmDiscard ? (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal
            aria-labelledby="issue-create-discard-title"
            className="w-full max-w-sm rounded-2xl bg-white px-5 py-6 text-center shadow-xl"
          >
            <h3 id="issue-create-discard-title" className="text-base font-semibold text-[#202124]">
              {tx("入力内容を捨てますか？", "Discard what you entered?")}
            </h3>
            <p className="mt-2 text-sm text-[#5f6368]">
              {tx(
                "今まで入力した内容は消えます。戻っても大丈夫ですか？この操作は取り消せません。",
                "Everything you’ve entered will be lost. Go back anyway? This can’t be undone.",
              )}
            </p>
            <div className="mx-auto mt-6 flex w-full max-w-[220px] flex-col items-stretch gap-3">
              <button
                type="button"
                className="rounded-xl bg-[#d93025] px-4 py-3 text-sm font-semibold text-white hover:bg-[#c5221f]"
                onClick={clearDraftAndClose}
              >
                {tx("捨てて戻る", "Discard")}
              </button>
              <button
                type="button"
                className="rounded-xl px-4 py-3 text-sm font-medium text-[#5f6368] hover:bg-[#f1f3f4]"
                onClick={() => setConfirmDiscard(false)}
              >
                {tx("キャンセル", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {nameDialogOpen
        ? createPortal(
            <div className="fixed inset-0 z-[310] flex items-end justify-center bg-black/40 p-4 sm:items-center">
              <button
                type="button"
                className="absolute inset-0"
                aria-label={tx("閉じる", "Close")}
                onClick={() => {
                  setNamePrompt(null);
                  setRenameId(null);
                  clearDraftSlotExtras();
                }}
              />
              <div className="relative z-10 max-h-[min(90dvh,720px)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
                <h2 className="text-base font-bold text-zinc-900">
                  {renameId ? tx("名前を変更", "Rename") : tx("ファイル名", "File name")}
                </h2>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={resetViewportZoom}
                  className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[16px] outline-none focus:border-[#FF9600]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (renameId) void saveRename();
                      else if (namePrompt !== "photo" && namePrompt !== "link") void createNamedFile();
                    }
                  }}
                />

                {!renameId && namePrompt === "photo" ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-[12px] font-semibold text-zinc-600">
                      {tx("写真（任意・何枚でも）", "Photos (optional, any number)")}
                    </p>
                    {draftSlotItems.length > 0 ? (
                      <ul className="grid grid-cols-3 gap-2">
                        {draftSlotItems.map((item) => (
                          <li key={item.id} className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                            {/* eslint-disable-next-line @next/next/no-img-element -- draft preview */}
                            <img src={item.url} alt={item.title || ""} className="aspect-square w-full object-cover" />
                            <button
                              type="button"
                              className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white"
                              aria-label={tx("削除", "Remove")}
                              onClick={() => setDraftSlotItems((prev) => prev.filter((x) => x.id !== item.id))}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <button
                      type="button"
                      disabled={uploadingDraft || !uid}
                      onClick={() => draftPhotoRef.current?.click()}
                      className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#F0B85A] bg-[#FFF8EE] px-4 py-6 text-[13px] font-bold text-[#9A5B1F] disabled:opacity-50"
                    >
                      <Plus className="h-5 w-5" aria-hidden />
                      {uploadingDraft ? tx("アップロード中…", "Uploading…") : tx("写真を追加", "Add photos")}
                    </button>
                    <input
                      ref={draftPhotoRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => void addDraftPhotos(e.target.files)}
                    />
                  </div>
                ) : null}

                {!renameId && namePrompt === "link" ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-[12px] font-semibold text-zinc-600">
                      {tx(
                        "リンク（任意・何個でも。追加を押すと入力中のURLも入ります）",
                        "Links (optional. Create also saves the URL you’re typing)",
                      )}
                    </p>
                    {draftSlotItems.length > 0 ? (
                      <ul className="space-y-2">
                        {draftSlotItems.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px]"
                          >
                            <Link2 className="h-4 w-4 shrink-0 text-[#1565C0]" aria-hidden />
                            <span className="min-w-0 flex-1 truncate font-semibold text-[#1565C0]">
                              {item.title || item.url}
                            </span>
                            <button
                              type="button"
                              className="shrink-0 rounded-full p-1 text-zinc-500 hover:bg-zinc-200"
                              aria-label={tx("削除", "Remove")}
                              onClick={() => setDraftSlotItems((prev) => prev.filter((x) => x.id !== item.id))}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <label className="block text-[12px] font-semibold text-zinc-700">
                      {tx("URL", "URL")}
                      <input
                        type="text"
                        inputMode="url"
                        autoCapitalize="off"
                        autoCorrect="off"
                        value={draftLinkUrl}
                        onChange={(e) => setDraftLinkUrl(e.target.value)}
                        placeholder="https://"
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[15px] outline-none focus:border-[#FF9600]"
                      />
                    </label>
                    <label className="block text-[12px] font-semibold text-zinc-700">
                      {tx("タイトル（任意）", "Title (optional)")}
                      <input
                        type="text"
                        value={draftLinkTitle}
                        onChange={(e) => setDraftLinkTitle(e.target.value)}
                        placeholder={tx("表示名", "Display name")}
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[15px] outline-none focus:border-[#FF9600]"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!draftLinkUrl.trim()}
                      onClick={addDraftLink}
                      className="flex w-full items-center justify-center gap-1 rounded-2xl border border-dashed border-[#F0B85A] bg-[#FFF8EE] px-4 py-3 text-[13px] font-bold text-[#9A5B1F] disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      {tx("リストに追加", "Add to list")}
                    </button>
                  </div>
                ) : null}

                {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                    onClick={() => {
                      setNamePrompt(null);
                      setRenameId(null);
                      clearDraftSlotExtras();
                    }}
                  >
                    {tx("キャンセル", "Cancel")}
                  </button>
                  <DuoButton
                    type="button"
                    tone="orange"
                    size="md"
                    disabled={creating || uploadingDraft}
                    onClick={() => {
                      if (renameId) void saveRename();
                      else void createNamedFile();
                    }}
                    className="!px-4 !py-2 !text-[14px]"
                  >
                    {creating
                      ? tx("保存中…", "Saving…")
                      : renameId
                        ? tx("保存", "Save")
                        : tx("追加", "Add")}
                  </DuoButton>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>

    {!exiting ? (
      <>
        {step === "files" ? (
          <div className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] right-4 z-[305] flex flex-col items-end gap-2">
            {fabOpen ? (
              <div className="pointer-events-auto mb-1 flex w-[220px] flex-col gap-1 rounded-2xl border border-[#dadce0] bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                {(
                  [
                    ["doc", tx("ドキュメント", "Document"), <FileText key="d" className="h-5 w-5 text-[#4285F4]" />],
                    ["board", tx("ホワイトボード", "Whiteboard"), <StickyNote key="b" className="h-5 w-5 text-[#7C3AED]" />],
                    ["canvas", tx("作業スペース", "Workspace"), <PenTool key="c" className="h-5 w-5 text-[#E65100]" />],
                    ["photo", tx("写真依頼", "Photo request"), <ImageIcon key="p" className="h-5 w-5 text-[#2E7D32]" />],
                    ["link", tx("リンク依頼", "Link request"), <Link2 key="l" className="h-5 w-5 text-[#1565C0]" />],
                  ] as const
                ).map(([kind, label, icon]) => (
                  <button
                    key={kind}
                    type="button"
                    disabled={creating}
                    onClick={() => openNamePrompt(kind)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-[#202124] hover:bg-[#f8f9fa] disabled:opacity-50"
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              disabled={creating}
              onClick={() => setFabOpen((v) => !v)}
              className="pointer-events-auto inline-flex h-[68px] w-[68px] items-center justify-center rounded-full border-[4px] border-[#FF9600] bg-white text-[#FF9600] shadow-[0_4px_0_#D97706] transition-[transform,box-shadow] duration-75 enabled:active:translate-y-[4px] enabled:active:shadow-none disabled:opacity-50"
              aria-label={fabOpen ? tx("閉じる", "Close") : tx("新規作成", "New")}
            >
              {fabOpen ? <X className="h-8 w-8" aria-hidden strokeWidth={3} /> : <Plus className="h-8 w-8" aria-hidden strokeWidth={3} />}
            </button>
          </div>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-[304] border-t border-zinc-100 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
          <div className="mx-auto max-w-lg">
            {step === "details" ? (
              <DuoButton type="button" tone="orange" size="lg" fullWidth disabled={!canGoNext} onClick={goToFiles}>
                {tx("次へ", "Next")}
              </DuoButton>
            ) : (
              <DuoButton
                type="button"
                tone="orange"
                size="lg"
                fullWidth
                disabled={saving || !canGoNext}
                onClick={() => void finish()}
              >
                {saving ? tx("作成中…", "Creating…") : tx("完了", "Done")}
              </DuoButton>
            )}
          </div>
        </div>
      </>
    ) : null}
    </>,
    document.body,
  );
}
