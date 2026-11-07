"use client";

import { useEffect, useMemo, useState } from "react";
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
import { createProjectBoard, deleteProjectBoard } from "@/lib/projects/whiteboard/boardApi";
import { supabase } from "@/lib/supabase";
import { dateInputToIso } from "@/lib/workspace/issueWork";
import {
  createWorkFileId,
  defaultTitle,
  newCanvasWorkFile,
  newLinkSlotFile,
  newPhotoSlotFile,
  removeWorkFile,
  setWorkFileRequired,
  sortWorkFilesByUpdated,
  upsertWorkFile,
  type IssueWorkFile,
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
  const [portalReady, setPortalReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [step, setStep] = useState<Step>("details");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [beginAt, setBeginAt] = useState("");
  const [files, setFiles] = useState<IssueWorkFile[]>([]);
  const [fabOpen, setFabOpen] = useState(false);
  const [namePrompt, setNamePrompt] = useState<IssueWorkFileKind | null>(null);
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const sortedFiles = useMemo(() => sortWorkFilesByUpdated(files), [files]);
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

  useEffect(() => {
    setPortalReady(true);
    const id = window.requestAnimationFrame(() => setEntered(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(id);
      document.body.style.overflow = prev;
    };
  }, []);

  function closeWizard() {
    setConfirmDiscard(false);
    setExiting(true);
    window.setTimeout(() => onClose(), 220);
  }

  function requestClose() {
    if (saving) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    closeWizard();
  }

  function openNamePrompt(kind: IssueWorkFileKind) {
    setFabOpen(false);
    setNamePrompt(kind);
    setDraftName(defaultTitle(kind));
    setError("");
  }

  async function createNamedFile() {
    if (!namePrompt || !uid) return;
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
      } else {
        next = newLinkSlotFile(name);
      }
      setFiles((prev) => upsertWorkFile(prev, next));
      setNamePrompt(null);
      setDraftName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("作成に失敗しました", "Couldn’t create"));
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
    setFiles((prev) => upsertWorkFile(prev, setWorkFileRequired(file, !file.required)));
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
        workFiles: files,
      });
      setExiting(true);
      window.setTimeout(() => onClose(), 180);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("課題を追加できませんでした", "Couldn’t add the task"));
      setSaving(false);
    }
  }

  if (!portalReady) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[300] flex flex-col bg-white ${
        exiting ? "issue-create-wizard-out" : entered ? "issue-create-wizard-in" : "translate-x-full"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={tx("課題を作成", "Create task")}
    >
      <button
        type="button"
        disabled={saving}
        onClick={requestClose}
        className="fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-zinc-300 bg-white text-zinc-800 shadow-[0_2px_0_#D4D4D8] transition-[transform,box-shadow] duration-75 enabled:active:translate-y-[2px] enabled:active:shadow-none disabled:opacity-50"
        aria-label={tx("戻る", "Back")}
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden />
      </button>

      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 py-2 pl-16 pr-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold text-zinc-900">
          {step === "details" ? tx("課題を作成", "Create task") : tx("ファイルを用意", "Prepare files")}
        </h1>
        {step === "files" ? (
          <button
            type="button"
            onClick={() => setStep("details")}
            className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-zinc-600 hover:bg-zinc-100"
          >
            {tx("詳細へ", "Details")}
          </button>
        ) : null}
      </div>

      {step === "details" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] pt-4">
          <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold text-zinc-700">{tx("名前", "Name")}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={tx("課題名", "Task name")}
                className="min-h-[48px] w-full rounded-2xl border border-zinc-200 px-3 text-[15px] outline-none focus:border-[#FF9600]"
                autoFocus
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold text-zinc-700">{tx("説明", "Description")}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder={tx("何をする課題か（任意）", "What should be done (optional)")}
                className="w-full resize-y rounded-2xl border border-zinc-200 px-3 py-2.5 text-[14px] outline-none focus:border-[#FF9600]"
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
                  className="min-h-[48px] w-full rounded-2xl border border-zinc-200 px-3 text-[14px]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-semibold text-zinc-700">{tx("締め切り", "Deadline")}</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-zinc-200 px-3 text-[14px]"
                />
              </label>
            </div>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <p className="text-[11px] text-zinc-400">
              {tx(`ジャンル: ${genre}`, `Genre: ${genre}`)}
              {phaseId ? "" : ` · ${tx("ステップ未設定", "No step")}`}
            </p>
          </div>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-y-auto pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]">
          <div className="mx-auto w-full max-w-lg px-2 pt-2">
            <p className="px-2 pb-2 text-[13px] text-zinc-500">
              {tx(
                "公開前にファイルを用意できます。写真・リンクは担当者が後から入れる枠になります。",
                "Prepare files before publishing. Photos and links become slots assignees fill in.",
              )}
            </p>
            <ul className="divide-y divide-[#e8eaed]">
              {sortedFiles.length === 0 ? (
                <li className="px-3 py-14 text-center text-[14px] text-zinc-500">
                  {tx("まだファイルはありません。右下の＋から追加。", "No files yet. Add with + below.")}
                </li>
              ) : (
                sortedFiles.map((file) => (
                  <li
                    key={file.id}
                    className={`relative flex items-center gap-1 pr-2 ${
                      file.required ? "bg-[#FFF4EC]" : "bg-white"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
                      <FileKindIcon kind={file.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-[#202124]">
                          {file.title || defaultTitle(file.kind)}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-[#5f6368]">
                          {kindLabel(file.kind, tx)}
                          {file.required ? ` · ${tx("必須", "Required")}` : ""}
                        </span>
                      </span>
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
            {error ? <p className="px-3 pt-2 text-sm text-rose-600">{error}</p> : null}
          </div>

          <div className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] right-4 z-30 flex flex-col items-end gap-2">
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
              className="pointer-events-auto inline-flex h-14 min-w-[7.5rem] items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[15px] font-semibold text-[#202124] shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
              aria-label={fabOpen ? tx("閉じる", "Close") : tx("新規作成", "New")}
            >
              {fabOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5 text-[#1a73e8]" />}
              {fabOpen ? tx("閉じる", "Close") : tx("新規", "New")}
            </button>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-100 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          {step === "details" ? (
            <DuoButton
              type="button"
              tone="orange"
              size="lg"
              fullWidth
              disabled={!canGoNext}
              onClick={() => {
                setError("");
                setStep("files");
              }}
            >
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

      {confirmDiscard ? (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal
            aria-labelledby="issue-create-discard-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
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
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#5f6368] hover:bg-[#f1f3f4]"
                onClick={() => setConfirmDiscard(false)}
              >
                {tx("キャンセル", "Cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#d93025] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c5221f]"
                onClick={closeWizard}
              >
                {tx("捨てて戻る", "Discard")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {namePrompt ? (
        <div className="fixed inset-0 z-[310] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button type="button" className="absolute inset-0" aria-label={tx("閉じる", "Close")} onClick={() => setNamePrompt(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <h2 className="text-base font-bold text-zinc-900">
              {tx("ファイル名", "File name")}
            </h2>
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
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
