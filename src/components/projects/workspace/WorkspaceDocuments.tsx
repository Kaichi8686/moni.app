"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ProjectGoogleDocsShell,
  type ProjectGoogleDocsShellHandle,
} from "@/components/projects/ProjectGoogleDocsShell";
import { DocumentsHomeList } from "@/components/projects/workspace/DocumentsHomeList";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { supabase } from "@/lib/supabase";
import {
  type ProjectDocumentRow,
  wordCountFromDocContent,
} from "@/lib/projects/documents";
import { uploadProjectImage } from "@/lib/projects/uploadProjectImage";

const DOC_EDITOR_CLASS = "moni-doc-editor";

/** キーボード直上にツールバーが来るよう visualViewport に合わせて全体を載せる */
function DocEditorViewport({ children }: { children: ReactNode }) {
  const [box, setBox] = useState({ top: 0, height: 0, left: 0, width: 0 });

  useEffect(() => {
    const sync = () => {
      const vv = window.visualViewport;
      if (vv) {
        setBox({ top: vv.offsetTop, height: vv.height, left: vv.offsetLeft, width: vv.width });
      } else {
        setBox({ top: 0, height: window.innerHeight, left: 0, width: window.innerWidth });
      }
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
      className="fixed z-[200] flex flex-col bg-white"
      style={{
        top: box.top,
        left: box.left,
        width: box.width || "100%",
        height: box.height || "100dvh",
      }}
    >
      {children}
    </div>
  );
}

function isSchemaError(error?: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || (error.message ?? "").includes("does not exist");
}

type ViewMode = "list" | "editor";

export default function WorkspaceDocuments() {
  const { project, projectId, loading: workspaceLoading, uid, canEdit, registerBackHandler } = useProjectWorkspace();
  const [documents, setDocuments] = useState<ProjectDocumentRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [schemaErr, setSchemaErr] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docCreating, setDocCreating] = useState(false);
  const [docSaving, setDocSaving] = useState(false);
  const [leavingEditor, setLeavingEditor] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const editorShellRef = useRef<ProjectGoogleDocsShellHandle>(null);

  const memberNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of project?.members ?? []) map[m.id] = m.name;
    return map;
  }, [project?.members]);

  const userInitial = useMemo(() => {
    if (!uid) return "?";
    const name = memberNames[uid];
    return (name?.trim().charAt(0) || "?").toUpperCase();
  }, [uid, memberNames]);

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) ?? null,
    [documents, activeDocId],
  );

  const docWordCount = useMemo(() => wordCountFromDocContent(docContent), [docContent]);

  const loadDocuments = useCallback(async () => {
    if (!supabase || !projectId) return;
    setDocsLoading(true);
    setSchemaErr("");
    const { data, error } = await supabase
      .from("project_documents")
      .select("id,title,content,updated_at,updated_by")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });
    if (isSchemaError(error)) {
      setSchemaErr("ドキュメント機能を使うには Supabase で apply_project_space_upgrade.sql を実行してください。");
      setDocuments([]);
      setDocsLoading(false);
      return;
    }
    if (error) {
      setActionErr(error.message);
      setDocsLoading(false);
      return;
    }
    const rows = (data ?? []) as ProjectDocumentRow[];
    setDocuments(rows);
    setActiveDocId((prev) => (prev && rows.some((d) => d.id === prev) ? prev : null));
    setDocsLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (workspaceLoading || !projectId) return;
    void loadDocuments();
  }, [workspaceLoading, projectId, loadDocuments]);

  useEffect(() => {
    const client = supabase;
    if (!client || !projectId) return;
    const channel = client
      .channel(`project-docs-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_documents", filter: `project_id=eq.${projectId}` },
        () => void loadDocuments(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [projectId, loadDocuments]);

  useEffect(() => {
    if (!activeDoc) return;
    setDocTitle(activeDoc.title);
    setDocContent(activeDoc.content ?? "");
  }, [activeDoc]);

  function openDocument(id: string) {
    const row = documents.find((d) => d.id === id);
    if (!row) return;
    setActiveDocId(id);
    setDocTitle(row.title);
    setDocContent(row.content ?? "");
    setViewMode("editor");
    if (typeof window !== "undefined") {
      window.history.pushState({ moniDocuments: "editor" }, "", window.location.href);
    }
  }

  /** 戻るは保存しない（チェックで保存済みの前提） */
  const backToList = useCallback(() => {
    if (leavingEditor) return;
    setLeavingEditor(true);
    try {
      setViewMode("list");
      if (typeof window !== "undefined" && window.history.state?.moniDocuments === "editor") {
        window.history.back();
      }
    } finally {
      setLeavingEditor(false);
    }
  }, [leavingEditor]);

  useEffect(() => {
    const onPopState = () => {
      // ブラウザ戻る: シェル unmount 時の flush 保存に任せる
      setViewMode("list");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    registerBackHandler(() => {
      if (viewMode === "editor") {
        backToList();
        return true;
      }
      return false;
    });
    return () => registerBackHandler(null);
  }, [viewMode, registerBackHandler, backToList]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  /** 編集中は下タブ・ワークスペースヘッダーを隠し、画面全体を使う */
  useEffect(() => {
    if (viewMode !== "editor") return;
    const root = document.documentElement;
    root.classList.add(DOC_EDITOR_CLASS);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      root.classList.remove(DOC_EDITOR_CLASS);
      document.body.style.overflow = prevOverflow;
    };
  }, [viewMode]);

  async function createDocument() {
    setActionErr("");
    if (!supabase || !projectId) return;
    if (!uid) {
      setActionErr("ドキュメントを作成するにはログインが必要です。");
      return;
    }
    if (!canEdit) {
      setActionErr("ドキュメントを作成する権限がありません。");
      return;
    }
    setDocCreating(true);
    try {
      const { data, error } = await supabase
        .from("project_documents")
        .insert({ project_id: projectId, title: "無題のドキュメント", content: "", updated_by: uid })
        .select("id,title,content,updated_at,updated_by")
        .single();
      if (error) {
        setActionErr(error.message);
        return;
      }
      const row = data as ProjectDocumentRow;
      setDocuments((prev) => [row, ...prev]);
      setActiveDocId(row.id);
      setDocTitle(row.title);
      setDocContent(row.content ?? "");
      setViewMode("editor");
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "ドキュメントの作成に失敗しました。");
    } finally {
      setDocCreating(false);
    }
  }

  async function saveDocument(payload?: { title: string; content: string }) {
    if (!supabase || !uid || !activeDocId || !canEdit) return;
    setDocSaving(true);
    setActionErr("");
    try {
      const title = (payload?.title ?? docTitle).trim() || "無題";
      const content = payload?.content ?? docContent;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("project_documents")
        .update({ title, content, updated_by: uid, updated_at: now })
        .eq("id", activeDocId);
      if (error) {
        setActionErr(error.message);
        throw new Error(error.message);
      }
      setDocTitle(title);
      setDocContent(content);
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDocId ? { ...d, title, content, updated_at: now, updated_by: uid } : d,
        ),
      );
    } finally {
      setDocSaving(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!supabase || !canEdit) return;
    setActionErr("");
    const { error } = await supabase.from("project_documents").delete().eq("id", id);
    if (error) {
      setActionErr(error.message);
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDocId === id) {
      setActiveDocId(null);
      setViewMode("list");
    }
  }

  async function uploadDocImage(file: File): Promise<string> {
    if (!supabase || !uid || !projectId) throw new Error("画像を追加するにはログインが必要です。");
    const uploaded = await uploadProjectImage(supabase, uid, "project-doc", projectId, file);
    return uploaded.publicUrl;
  }

  if (workspaceLoading || docsLoading) {
    return <p className="text-sm text-[#6B7280]">読み込み中…</p>;
  }

  if (!project) return null;

  if (schemaErr) {
    return <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{schemaErr}</p>;
  }

  if (viewMode === "list") {
    return (
      <div className="space-y-2">
        {actionErr ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{actionErr}</p>
        ) : null}
        <DocumentsHomeList
          documents={documents}
          canEdit={canEdit}
          docCreating={docCreating}
          userInitial={userInitial}
          onOpen={openDocument}
          onCreate={() => void createDocument()}
          onDelete={canEdit ? (id) => void deleteDocument(id) : undefined}
        />
      </div>
    );
  }

  const editor = (
    <DocEditorViewport>
      {actionErr ? (
        <p className="shrink-0 border-b border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-800">{actionErr}</p>
      ) : null}
      <div className="min-h-0 flex-1">
        <ProjectGoogleDocsShell
          ref={editorShellRef}
          activeDocId={activeDocId}
          documents={documents.map((d) => ({ id: d.id, content: d.content ?? "" }))}
          docTitle={docTitle}
          onDocTitleChange={setDocTitle}
          onDocContentChange={setDocContent}
          onSave={(payload) => saveDocument(payload)}
          saving={docSaving}
          autoSave={canEdit}
          wordCount={docWordCount}
          updatedByLabel={
            activeDoc?.updated_by ? (memberNames[activeDoc.updated_by] ?? "メンバー") : "—"
          }
          hideSidebar
          fullscreen
          onUploadImage={canEdit ? uploadDocImage : undefined}
          onBack={backToList}
        />
      </div>
    </DocEditorViewport>
  );

  if (!portalReady) return null;
  return createPortal(editor, document.body);
}
