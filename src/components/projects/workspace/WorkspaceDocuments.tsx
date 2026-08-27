"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProjectGoogleDocsShell } from "@/components/projects/ProjectGoogleDocsShell";
import { DocumentsHomeList } from "@/components/projects/workspace/DocumentsHomeList";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { supabase } from "@/lib/supabase";
import {
  type ProjectDocumentRow,
  wordCountFromDocContent,
} from "@/lib/projects/documents";

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
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

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

  function backToList() {
    setViewMode("list");
    if (typeof window !== "undefined" && window.history.state?.moniDocuments === "editor") {
      window.history.back();
    }
  }

  useEffect(() => {
    const onPopState = () => {
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
  }, [viewMode, registerBackHandler]);

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

  async function saveDocument() {
    if (!supabase || !uid || !activeDocId || !canEdit) return;
    setDocSaving(true);
    setActionErr("");
    try {
      const title = docTitle.trim() || "無題";
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("project_documents")
        .update({ title, content: docContent, updated_by: uid, updated_at: now })
        .eq("id", activeDocId);
      if (error) {
        setActionErr(error.message);
        return;
      }
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDocId ? { ...d, title, content: docContent, updated_at: now, updated_by: uid } : d,
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
    if (selectedDocId === id) setSelectedDocId(null);
    if (activeDocId === id) {
      setActiveDocId(null);
      setViewMode("list");
    }
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
          selectedDocId={selectedDocId}
          onSelectDoc={setSelectedDocId}
          onOpen={openDocument}
          onCreate={() => void createDocument()}
          onDelete={canEdit ? (id) => void deleteDocument(id) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {actionErr ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{actionErr}</p>
      ) : null}
      <ProjectGoogleDocsShell
        activeDocId={activeDocId}
        documents={documents.map((d) => ({ id: d.id, content: d.content ?? "" }))}
        docTitle={docTitle}
        onDocTitleChange={setDocTitle}
        onDocContentChange={setDocContent}
        onSave={() => saveDocument()}
        saving={docSaving}
        wordCount={docWordCount}
        updatedByLabel={
          activeDoc?.updated_by ? (memberNames[activeDoc.updated_by] ?? "メンバー") : "—"
        }
        hideSidebar
        onBack={backToList}
      />
    </div>
  );
}
