"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  MoreVertical,
  PenTool,
  StickyNote,
  X,
} from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { ProjectGoogleDocsShell } from "@/components/projects/ProjectGoogleDocsShell";
import { ProjectWhiteboard } from "@/components/projects/whiteboard/ProjectWhiteboard";
import { appendImageToBoard, IssueWorkspaceCanvas } from "@/components/projects/workspace/IssueWorkspaceCanvas";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { wordCountFromDocContent } from "@/lib/projects/documents";
import { uploadProjectImage } from "@/lib/projects/uploadProjectImage";
import {
  createProjectBoard,
  deleteProjectBoard,
} from "@/lib/projects/whiteboard/boardApi";
import { supabase } from "@/lib/supabase";
import { assigneeNames } from "@/lib/workspace/issueAssignees";
import { daysUntilDue, isoToDateInput, isIssueSubmitted, type IssueWork } from "@/lib/workspace/issueWork";
import {
  appendFileItem,
  createWorkFileId,
  defaultTitle,
  fileItems,
  isCollectSlot,
  markWorkFileComplete,
  newCanvasWorkFile,
  newLinkSlotFile,
  newPhotoSlotFile,
  normalizeExternalUrl,
  removeWorkFile,
  requiredFilesReady,
  sortWorkFilesByUpdated,
  upsertWorkFile,
  type IssueWorkFile,
  type IssueWorkFileKind,
} from "@/lib/workspace/issueWorkFiles";
import { createEmptyBoard, type IssueWorkspaceBoard } from "@/lib/workspace/issueWorkspaceBoard";
import type { Issue, Member } from "@/lib/workspace/types";

type Props = {
  issue: Issue;
  members: Member[];
  stepLabel: string;
  genreLabel: string;
  uid: string | null;
  canEdit: boolean;
  onBack: () => void;
  onSaveWork: (patch: Partial<IssueWork>) => Promise<void>;
  registerBackHandler: (handler: (() => boolean) | null) => void;
};

function DocIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
      <path fill="#A1C2FA" d="M13 3.5L18.5 9H14c-.55 0-1-.45-1-1V3.5z" />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <rect x="3" y="4" width="18" height="16" rx="2" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="1.4" />
      <path
        d="M7 15c1.2-2.2 2.2-3.2 3.4-3.2 1.4 0 1.6 2 3 2 1.1 0 2-1.2 3.2-3.2"
        fill="none"
        stroke="#7C3AED"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CanvasIcon() {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF3E0] text-[#E65100]">
      <StickyNote className="h-5 w-5" aria-hidden />
    </span>
  );
}

function PhotoIcon({ url }: { url?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded preview
      <img src={url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
    );
  }
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#2E7D32]">
      <ImageIcon className="h-5 w-5" aria-hidden />
    </span>
  );
}

function LinkIcon() {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E3F2FD] text-[#1565C0]">
      <Link2 className="h-5 w-5" aria-hidden />
    </span>
  );
}

function formatUpdated(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale === "en" ? "en-US" : "ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FileIcon({ kind, url }: { kind: IssueWorkFileKind; url?: string }) {
  if (kind === "doc") return <DocIcon />;
  if (kind === "board") return <BoardIcon />;
  if (kind === "photo") return <PhotoIcon url={url} />;
  if (kind === "link") return <LinkIcon />;
  return <CanvasIcon />;
}

function kindLabel(kind: IssueWorkFileKind, tx: (ja: string, en: string) => string) {
  if (kind === "doc") return tx("ドキュメント", "Document");
  if (kind === "board") return tx("ホワイトボード", "Whiteboard");
  if (kind === "photo") return tx("写真依頼", "Photo request");
  if (kind === "link") return tx("リンク依頼", "Link request");
  return tx("作業スペース", "Workspace");
}

function DocEditorViewport({ children }: { children: ReactNode }) {
  const [box, setBox] = useState({ top: 0, height: 0, left: 0, width: 0 });
  useEffect(() => {
    const sync = () => {
      const vv = window.visualViewport;
      if (vv) setBox({ top: vv.offsetTop, height: vv.height, left: vv.offsetLeft, width: vv.width });
      else setBox({ top: 0, height: window.innerHeight, left: 0, width: window.innerWidth });
    };
    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);
  return (
    <div
      className="fixed z-[240] flex flex-col bg-white"
      style={{ top: box.top, left: box.left, width: box.width || "100%", height: box.height || "100dvh" }}
    >
      {children}
    </div>
  );
}

export function IssueTaskFilesPanel({
  issue,
  members,
  stepLabel,
  genreLabel,
  uid,
  canEdit,
  onBack,
  onSaveWork,
  registerBackHandler,
}: Props) {
  const { tx, locale } = useI18n();
  const [files, setFiles] = useState<IssueWorkFile[]>(() => sortWorkFilesByUpdated(issue.workFiles ?? []));
  const [fabOpen, setFabOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docSaving, setDocSaving] = useState(false);
  const [canvasDraft, setCanvasDraft] = useState<IssueWorkspaceBoard>(() => createEmptyBoard());
  const [uploading, setUploading] = useState(false);
  const [linkDraftOpen, setLinkDraftOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [namePrompt, setNamePrompt] = useState<IssueWorkFileKind | null>(null);
  const [draftName, setDraftName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const slotPhotoInputRef = useRef<HTMLInputElement>(null);
  const canvasSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitted = isIssueSubmitted(issue);
  const openFile = files.find((file) => file.id === openFileId) ?? null;
  const canSubmit = canEdit && !submitted && requiredFilesReady(files);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const member of members) map[member.id] = member.name;
    return map;
  }, [members]);

  const userInitial = useMemo(() => {
    if (!uid) return "?";
    return (names[uid]?.trim().charAt(0) || "?").toUpperCase();
  }, [names, uid]);

  useEffect(() => {
    setFiles(sortWorkFilesByUpdated(issue.workFiles ?? []));
  }, [issue.id, issue.workFiles]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (canvasSaveTimer.current) clearTimeout(canvasSaveTimer.current);
    };
  }, []);

  const persistFiles = useCallback(
    async (nextFiles: IssueWorkFile[], workspaceBoard?: IssueWorkspaceBoard | null) => {
      const sorted = sortWorkFilesByUpdated(nextFiles);
      setFiles(sorted);
      const primaryCanvas = sorted.find((file) => file.kind === "canvas");
      await onSaveWork({
        workFiles: sorted,
        workspaceBoard:
          workspaceBoard !== undefined
            ? workspaceBoard
            : primaryCanvas?.canvasBoard ?? issue.workspaceBoard ?? null,
      });
    },
    [issue.workspaceBoard, onSaveWork],
  );

  const closeEditor = useCallback(() => {
    setOpenFileId(null);
    setDocTitle("");
    setDocContent("");
    setFabOpen(false);
    setMenuId(null);
    setLinkDraftOpen(false);
  }, []);

  useEffect(() => {
    if (!openFile) {
      registerBackHandler(null);
      return;
    }
    registerBackHandler(() => {
      closeEditor();
      return true;
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      registerBackHandler(null);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeEditor, openFile, registerBackHandler]);

  async function openExisting(file: IssueWorkFile) {
    setError("");
    setMenuId(null);
    if (file.kind === "doc") {
      if (!supabase) {
        setError(tx("ドキュメントを開けません", "Can’t open the document"));
        return;
      }
      const { data, error: err } = await supabase
        .from("project_documents")
        .select("id,title,content,updated_at")
        .eq("id", file.refId)
        .maybeSingle();
      if (err || !data) {
        setError(err?.message ?? tx("ドキュメントが見つかりません", "Document not found"));
        return;
      }
      setDocTitle(typeof data.title === "string" ? data.title : file.title);
      setDocContent(typeof data.content === "string" ? data.content : "");
      setOpenFileId(file.id);
      return;
    }
    if (file.kind === "canvas") {
      setCanvasDraft(file.canvasBoard ?? createEmptyBoard());
      setOpenFileId(file.id);
      return;
    }
    if (isCollectSlot(file)) {
      setOpenFileId(file.id);
      return;
    }
    setOpenFileId(file.id);
  }

  function openNamePrompt(kind: IssueWorkFileKind) {
    setFabOpen(false);
    setNamePrompt(kind);
    setDraftName(defaultTitle(kind));
    setError("");
  }

  async function createNamedFile() {
    if (!canEdit || !uid || !namePrompt) return;
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
            project_id: issue.projectId,
            title: name,
            content: "",
            updated_by: uid,
          })
          .select("id,title,content,updated_at")
          .single();
        if (err || !data) throw new Error(err?.message ?? tx("ドキュメントの作成に失敗しました", "Couldn’t create document"));
        next = {
          id: createWorkFileId(),
          kind: "doc",
          title: data.title || name,
          refId: data.id,
          updatedAt: data.updated_at || new Date().toISOString(),
        };
        await persistFiles(upsertWorkFile(files, next));
        setDocTitle(next.title);
        setDocContent("");
        setOpenFileId(next.id);
      } else if (namePrompt === "board") {
        const board = await createProjectBoard(issue.projectId, uid, name);
        next = {
          id: createWorkFileId(),
          kind: "board",
          title: board.title || name,
          refId: board.id,
          updatedAt: board.updated_at || new Date().toISOString(),
        };
        await persistFiles(upsertWorkFile(files, next));
        setOpenFileId(next.id);
      } else if (namePrompt === "canvas") {
        next = newCanvasWorkFile(name);
        await persistFiles(upsertWorkFile(files, next), next.canvasBoard ?? createEmptyBoard());
        setCanvasDraft(next.canvasBoard ?? createEmptyBoard());
        setOpenFileId(next.id);
      } else if (namePrompt === "photo") {
        next = newPhotoSlotFile(name);
        await persistFiles(upsertWorkFile(files, next));
        setOpenFileId(next.id);
      } else {
        next = newLinkSlotFile(name);
        await persistFiles(upsertWorkFile(files, next));
        setOpenFileId(next.id);
      }
      setNamePrompt(null);
      setDraftName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("作成に失敗しました", "Couldn’t create"));
    } finally {
      setCreating(false);
    }
  }

  async function addPhotosToOpenSlot(list: FileList | null) {
    if (!list || !canEdit || !uid || !supabase || !openFile || openFile.kind !== "photo") return;
    setUploading(true);
    setError("");
    try {
      let next = openFile;
      for (const file of Array.from(list)) {
        const uploaded = await uploadProjectImage(supabase, uid, "issue-photo", issue.id, file);
        next = appendFileItem(next, {
          url: uploaded.publicUrl,
          title: file.name.replace(/\.[^.]+$/, "") || undefined,
          addedBy: uid,
        });
      }
      await persistFiles(upsertWorkFile(files, next));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("写真を追加できませんでした", "Couldn’t add the photo"));
    } finally {
      setUploading(false);
      if (slotPhotoInputRef.current) slotPhotoInputRef.current.value = "";
    }
  }

  async function addLinkToOpenSlot() {
    if (!canEdit || !openFile || openFile.kind !== "link") return;
    const url = normalizeExternalUrl(linkUrl);
    if (!url) {
      setError(tx("正しいURLを入力してください", "Enter a valid URL"));
      return;
    }
    setCreating(true);
    setError("");
    try {
      const next = appendFileItem(openFile, {
        url,
        title: linkTitle.trim() || undefined,
        addedBy: uid ?? undefined,
      });
      await persistFiles(upsertWorkFile(files, next));
      setLinkDraftOpen(false);
      setLinkUrl("");
      setLinkTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("リンクを追加できませんでした", "Couldn’t add the link"));
    } finally {
      setCreating(false);
    }
  }

  async function toggleFileComplete(file: IssueWorkFile) {
    if (!canEdit || submitted || !file.required) return;
    const next = markWorkFileComplete(file, !file.completedAt);
    await persistFiles(upsertWorkFile(files, next));
  }

  async function deleteFile(file: IssueWorkFile) {
    if (!canEdit) return;
    setMenuId(null);
    setError("");
    try {
      if (file.kind === "doc" && supabase) {
        await supabase.from("project_documents").delete().eq("id", file.refId);
      }
      if (file.kind === "board") {
        await deleteProjectBoard(file.refId);
      }
      const next = removeWorkFile(files, file.id);
      await persistFiles(next);
      if (openFileId === file.id) closeEditor();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("削除に失敗しました", "Couldn’t delete"));
    }
  }

  async function saveDocument(payload?: { title: string; content: string }) {
    if (!supabase || !uid || !openFile || openFile.kind !== "doc" || !canEdit) return;
    setDocSaving(true);
    setError("");
    try {
      const title = (payload?.title ?? docTitle).trim() || defaultTitle("doc");
      const content = payload?.content ?? docContent;
      const now = new Date().toISOString();
      const { error: err } = await supabase
        .from("project_documents")
        .update({ title, content, updated_by: uid, updated_at: now })
        .eq("id", openFile.refId);
      if (err) throw new Error(err.message);
      setDocTitle(title);
      setDocContent(content);
      await persistFiles(upsertWorkFile(files, { ...openFile, title, updatedAt: now }));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存に失敗しました", "Couldn’t save"));
      throw e;
    } finally {
      setDocSaving(false);
    }
  }

  function persistCanvas(board: IssueWorkspaceBoard) {
    if (!openFile || openFile.kind !== "canvas") return;
    setCanvasDraft(board);
    if (canvasSaveTimer.current) clearTimeout(canvasSaveTimer.current);
    canvasSaveTimer.current = setTimeout(() => {
      const next: IssueWorkFile = {
        ...openFile,
        canvasBoard: board,
        updatedAt: new Date().toISOString(),
      };
      void persistFiles(upsertWorkFile(files, next), board);
    }, 400);
  }

  async function addPhotos(list: FileList | null) {
    if (!list || !uid || !openFile || openFile.kind !== "canvas") return;
    setUploading(true);
    setError("");
    try {
      if (!supabase) throw new Error(tx("画像を保存できません", "Can’t save the photo"));
      let nextBoard = canvasDraft;
      for (const file of Array.from(list)) {
        const result = await uploadProjectImage(supabase, uid, "issue-photo", issue.id, file);
        nextBoard = appendImageToBoard(nextBoard, result.publicUrl);
      }
      if (canvasSaveTimer.current) clearTimeout(canvasSaveTimer.current);
      setCanvasDraft(nextBoard);
      const next: IssueWorkFile = {
        ...openFile,
        canvasBoard: nextBoard,
        updatedAt: new Date().toISOString(),
      };
      await persistFiles(upsertWorkFile(files, next), nextBoard);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("画像を追加できませんでした", "Couldn’t add the photo"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const dueDays = daysUntilDue(issue.dueDate);
  const dueText =
    dueDays == null
      ? tx("期限なし", "No deadline")
      : dueDays > 0
        ? tx(`期限まであと${dueDays}日（${isoToDateInput(issue.dueDate)}）`, `${dueDays} days left (${isoToDateInput(issue.dueDate)})`)
        : dueDays === 0
          ? tx(`期限は今日（${isoToDateInput(issue.dueDate)}）`, `Due today (${isoToDateInput(issue.dueDate)})`)
          : tx(`期限を${Math.abs(dueDays)}日過ぎています（${isoToDateInput(issue.dueDate)}）`, `${Math.abs(dueDays)} days overdue (${isoToDateInput(issue.dueDate)})`);

  const assignee = assigneeNames(issue, names).join("、") || tx("担当未設定", "No assignee");

  if (openFile && portalReady) {
    if (openFile.kind === "doc") {
      return createPortal(
        <DocEditorViewport>
          {error ? (
            <p className="shrink-0 border-b border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
          ) : null}
          <div className="min-h-0 flex-1">
            <ProjectGoogleDocsShell
              activeDocId={openFile.refId}
              documents={[{ id: openFile.refId, content: docContent }]}
              docTitle={docTitle}
              onDocTitleChange={setDocTitle}
              onDocContentChange={setDocContent}
              onSave={(payload) => saveDocument(payload)}
              saving={docSaving}
              autoSave={canEdit}
              wordCount={wordCountFromDocContent(docContent)}
              updatedByLabel={assignee}
              onBack={closeEditor}
              onUploadImage={
                uid
                  ? async (file) => {
                      if (!supabase) throw new Error("upload unavailable");
                      const uploaded = await uploadProjectImage(supabase, uid, "project-doc", issue.projectId, file);
                      return uploaded.publicUrl;
                    }
                  : undefined
              }
            />
          </div>
        </DocEditorViewport>,
        document.body,
      );
    }

    if (openFile.kind === "board") {
      return createPortal(
        <div className="fixed inset-0 z-[240] flex flex-col bg-white">
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-3 py-2">
            <button
              type="button"
              onClick={closeEditor}
              className="inline-flex h-10 items-center gap-1 rounded-full px-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {tx("戻る", "Back")}
            </button>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">{openFile.title}</p>
          </div>
          <div className="min-h-0 flex-1">
            <ProjectWhiteboard projectId={issue.projectId} boardId={openFile.refId} uid={uid} canEdit={canEdit} />
          </div>
        </div>,
        document.body,
      );
    }

    if (openFile.kind === "photo" || openFile.kind === "link") {
      const items = fileItems(openFile);
      return createPortal(
        <div className="fixed inset-0 z-[240] flex flex-col bg-white">
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-3 py-2">
            <button
              type="button"
              onClick={closeEditor}
              className="inline-flex h-10 items-center gap-1 rounded-full px-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {tx("戻る", "Back")}
            </button>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">{openFile.title}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <p className="mb-3 text-[13px] text-zinc-500">
              {openFile.kind === "photo"
                ? tx("担当者が写真をここに追加します。", "Assignees add photos here.")
                : tx("担当者がリンクをここに追加します。", "Assignees add links here.")}
            </p>
            {items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
                {tx("まだ何もありません", "Nothing yet")}
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                    {openFile.kind === "photo" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- slot photo
                      <img src={item.url} alt={item.title || ""} className="max-h-80 w-full object-contain bg-zinc-50" />
                    ) : (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[#1565C0] hover:bg-zinc-50"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 truncate">{item.title || item.url}</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          </div>
          {canEdit && !submitted ? (
            <div className="shrink-0 border-t border-zinc-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {openFile.kind === "photo" ? (
                <>
                  <DuoButton
                    type="button"
                    tone="orange"
                    size="lg"
                    fullWidth
                    disabled={uploading}
                    onClick={() => slotPhotoInputRef.current?.click()}
                  >
                    {uploading ? tx("アップロード中…", "Uploading…") : tx("写真を入れる", "Add photo")}
                  </DuoButton>
                  <input
                    ref={slotPhotoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => void addPhotosToOpenSlot(event.target.files)}
                  />
                </>
              ) : (
                <DuoButton
                  type="button"
                  tone="orange"
                  size="lg"
                  fullWidth
                  onClick={() => {
                    setLinkDraftOpen(true);
                    setError("");
                  }}
                >
                  {tx("リンクを入れる", "Add link")}
                </DuoButton>
              )}
            </div>
          ) : null}
        </div>,
        document.body,
      );
    }

    if (openFile.kind === "canvas") {
      return createPortal(
        <div className="fixed inset-0 z-[240] overflow-hidden overscroll-none bg-white">
          <IssueWorkspaceCanvas
            board={canvasDraft}
            canEdit={canEdit}
            uploading={uploading}
            fullscreen
            onChange={persistCanvas}
            onRequestPhoto={() => fileRef.current?.click()}
            toolbarStart={
              <button
                type="button"
                data-board-ui
                onClick={closeEditor}
                className="inline-flex h-10 shrink-0 items-center gap-0.5 rounded-xl border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                <span>{tx("戻る", "Back")}</span>
              </button>
            }
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void addPhotos(event.target.files)}
          />
          {error ? (
            <p className="absolute bottom-4 left-1/2 z-10 max-w-sm -translate-x-1/2 rounded-full bg-rose-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg">
              {error}
            </p>
          ) : null}
        </div>,
        document.body,
      );
    }
  }

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-3 pb-28">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100"
          aria-label={tx("戻る", "Back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-zinc-500">
            {stepLabel}
            <span className="text-zinc-300"> · </span>
            {genreLabel}
          </p>
          <h1 className="truncate text-xl font-bold tracking-tight text-zinc-950">{issue.title}</h1>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm text-zinc-700">
        <p>
          <span className="font-semibold text-zinc-800">{tx("期限", "Deadline")}</span>
          <span className="mx-2 text-zinc-300">·</span>
          {dueText}
        </p>
        <p className="mt-1 text-[13px] text-zinc-500">
          {[
            assignee,
            issue.beginAt ? tx(`開始 ${isoToDateInput(issue.beginAt)}`, `Start ${isoToDateInput(issue.beginAt)}`) : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="-mx-4 flex min-h-[min(52dvh,560px)] flex-col bg-white sm:mx-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[#e8eaed]">
        <div className="sticky top-0 z-10 border-b border-[#e8eaed] bg-white px-3 pb-2 pt-2 sm:px-4">
          <div className="flex items-center gap-2 rounded-full bg-[#f1f3f4] px-3 py-2.5">
            <FileText className="h-4 w-4 shrink-0 text-[#5f6368]" aria-hidden />
            <span className="min-w-0 flex-1 text-[14px] text-[#5f6368]">
              {tx("この課題のファイル", "Files in this task")}
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-xs font-bold text-white">
              {userInitial}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between px-1">
            <p className="text-[14px] text-[#202124]">{tx("ファイル", "Files")}</p>
            <LayoutGrid className="h-5 w-5 text-[#5f6368]" aria-hidden />
          </div>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-[#e8eaed] overflow-y-auto pb-8">
          {files.length === 0 ? (
            <li className="px-4 py-16 text-center text-[14px] text-[#5f6368]">
              {tx("まだファイルはありません。右下の＋から追加できます。", "No files yet. Add one with + below.")}
            </li>
          ) : (
            files.map((file) => {
              const items = fileItems(file);
              return (
              <li
                key={file.id}
                className={`relative flex items-center gap-1 pr-2 ${
                  file.required ? "bg-[#FFF4EC]" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => void openExisting(file)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left transition hover:bg-[#f8f9fa]/80 active:bg-[#f1f3f4] sm:px-4"
                >
                  <FileIcon kind={file.kind} url={items[0]?.url || file.url} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-normal text-[#202124]">
                      {file.title?.trim() || defaultTitle(file.kind)}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-[#5f6368]">
                      {kindLabel(file.kind, tx)}
                      {file.required ? ` · ${tx("必須", "Required")}` : ""}
                      {file.required && file.completedAt ? ` · ${tx("できた", "Done")}` : ""}
                      {isCollectSlot(file) ? ` · ${tx(`${items.length}件`, `${items.length}`)}` : ""}
                      {file.updatedAt ? ` · ${formatUpdated(file.updatedAt, locale)}` : ""}
                    </span>
                  </span>
                </button>
                {canEdit && file.required && !submitted ? (
                  <DuoButton
                    type="button"
                    tone={file.completedAt ? "lime" : "peach"}
                    size="md"
                    onClick={() => void toggleFileComplete(file)}
                    className="!min-h-0 !px-3 !py-2 !text-[12px] !font-bold"
                  >
                    {file.completedAt ? tx("できた", "Done") : tx("できた？", "Done?")}
                  </DuoButton>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-full p-2 text-[#5f6368] hover:bg-[#f1f3f4]"
                    aria-label={tx("その他", "More")}
                    onClick={() => setMenuId(menuId === file.id ? null : file.id)}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                ) : null}
                {menuId === file.id ? (
                  <>
                    <button type="button" className="fixed inset-0 z-40" aria-label={tx("閉じる", "Close")} onClick={() => setMenuId(null)} />
                    <div className="absolute right-2 top-full z-50 min-w-[140px] rounded-lg border border-[#dadce0] bg-white py-1 shadow-lg">
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
            );
            })
          )}
        </ul>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!requiredFilesReady(files) && !submitted ? (
        <p className="text-center text-[12px] font-semibold text-[#9A5B1F]">
          {tx("必須ファイルを「できた」にしてから提出できます", "Mark required files as done before submitting")}
        </p>
      ) : null}

      <DuoButton
        type="button"
        tone={submitted ? "lime" : "orange"}
        size="lg"
        fullWidth
        disabled={!canSubmit}
        onClick={() => {
          if (!requiredFilesReady(files)) return;
          void onSaveWork({ submittedAt: new Date().toISOString(), workFiles: files });
        }}
        className="!text-[16px]"
      >
        {submitted ? tx("提出済み", "Submitted") : tx("提出する", "Submit")}
      </DuoButton>

      {canEdit && !submitted ? (
        <div className="pointer-events-none fixed bottom-[calc(var(--bottom-nav-clearance)+0.75rem)] right-4 z-30 flex flex-col items-end gap-2 md:bottom-8">
          {fabOpen ? (
            <div className="pointer-events-auto mb-1 flex w-[220px] flex-col gap-2 rounded-2xl border border-[#dadce0] bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
              <button
                type="button"
                disabled={creating}
                onClick={() => openNamePrompt("doc")}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-[#202124] hover:bg-[#f8f9fa] disabled:opacity-50"
              >
                <DocIcon />
                {tx("ドキュメント", "Document")}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => openNamePrompt("board")}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-[#202124] hover:bg-[#f8f9fa] disabled:opacity-50"
              >
                <BoardIcon />
                {tx("ホワイトボード", "Whiteboard")}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => openNamePrompt("canvas")}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-[#202124] hover:bg-[#f8f9fa] disabled:opacity-50"
              >
                <PenTool className="h-5 w-5 text-[#E65100]" aria-hidden />
                {tx("作業スペース", "Workspace")}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => openNamePrompt("photo")}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-[#202124] hover:bg-[#f8f9fa] disabled:opacity-50"
              >
                <PhotoIcon />
                {tx("写真依頼", "Photo request")}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => openNamePrompt("link")}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-[#202124] hover:bg-[#f8f9fa] disabled:opacity-50"
              >
                <LinkIcon />
                {tx("リンク依頼", "Link request")}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={creating}
            onClick={() => setFabOpen((v) => !v)}
            className="pointer-events-auto inline-flex h-14 min-w-[7.5rem] items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[15px] font-semibold text-[#202124] shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition hover:shadow-[0_4px_14px_rgba(0,0,0,0.22)] disabled:opacity-50"
            aria-label={fabOpen ? tx("閉じる", "Close") : tx("新規作成", "New")}
          >
            {fabOpen ? <X className="h-5 w-5" aria-hidden /> : <span className="text-[22px] font-light leading-none text-[#1a73e8]">+</span>}
            {fabOpen ? tx("閉じる", "Close") : tx("新規", "New")}
          </button>
        </div>
      ) : null}

      {namePrompt && portalReady
        ? createPortal(
            <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/40 p-4 sm:items-center">
              <button type="button" className="absolute inset-0" aria-label={tx("閉じる", "Close")} onClick={() => setNamePrompt(null)} />
              <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
                <h2 className="text-base font-bold text-zinc-900">{tx("ファイル名", "File name")}</h2>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[15px] outline-none focus:border-[#FF9600]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void createNamedFile();
                    }
                  }}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                    onClick={() => setNamePrompt(null)}
                  >
                    {tx("キャンセル", "Cancel")}
                  </button>
                  <DuoButton
                    type="button"
                    tone="orange"
                    size="md"
                    disabled={creating}
                    onClick={() => void createNamedFile()}
                    className="!px-4 !py-2 !text-[14px]"
                  >
                    {creating ? tx("作成中…", "Creating…") : tx("追加", "Add")}
                  </DuoButton>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {linkDraftOpen && portalReady
        ? createPortal(
            <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/40 p-4 sm:items-center">
              <button
                type="button"
                className="absolute inset-0"
                aria-label={tx("閉じる", "Close")}
                onClick={() => {
                  setLinkDraftOpen(false);
                  setError("");
                }}
              />
              <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-zinc-900">{tx("リンクを入れる", "Add link")}</h2>
                  <button
                    type="button"
                    className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
                    aria-label={tx("閉じる", "Close")}
                    onClick={() => {
                      setLinkDraftOpen(false);
                      setError("");
                    }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <label className="block text-[13px] font-semibold text-zinc-700">
                  {tx("URL", "URL")}
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://"
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[15px] text-zinc-900 outline-none focus:border-[#1a73e8]"
                    autoFocus
                  />
                </label>
                <label className="mt-3 block text-[13px] font-semibold text-zinc-700">
                  {tx("タイトル（任意）", "Title (optional)")}
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder={tx("表示名", "Display name")}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[15px] text-zinc-900 outline-none focus:border-[#1a73e8]"
                  />
                </label>
                {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                    onClick={() => {
                      setLinkDraftOpen(false);
                      setError("");
                    }}
                  >
                    {tx("キャンセル", "Cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={creating || !linkUrl.trim()}
                    onClick={() => void addLinkToOpenSlot()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#1a73e8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1765cc] disabled:opacity-50"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    {tx("追加", "Add")}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
