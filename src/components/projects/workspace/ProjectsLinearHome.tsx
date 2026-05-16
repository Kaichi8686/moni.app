"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { ProjectRow } from "@/lib/projects/types";
import { ProjectSidebar } from "@/components/projects/ProjectSidebar";
import { ProjectCard } from "@/components/projects/ProjectCard";
import type { Issue, Member, Phase, Project, ProjectStatus } from "@/lib/workspace/types";
import { projectRowToWorkspace } from "@/lib/workspace/mapRows";
import { useWorkspaceUiStore } from "@/lib/workspace/store";

type ProjectDbRow = ProjectRow & {
  icon?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  linear_status?: string | null;
  lead_id?: string | null;
};

type Filter = "all" | "active" | "completed";

const PROJECT_LIST_SELECT = "*";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function ProjectsLinearHome() {
  const setCommandOpen = useWorkspaceUiStore((s) => s.setCommandOpen);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<ProjectDbRow[]>([]);
  const [issueStats, setIssueStats] = useState<Record<string, { total: number; done: number }>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "📁", start: "", end: "" });

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const { data: session } = await client.auth.getSession();
      const uid = session?.session?.user.id;
      if (!uid) {
        setRows([]);
        setErr("ログインするとプロジェクト一覧が表示されます。");
        return;
      }
      const { data: mems } = await client.from("project_members").select("project_id").eq("user_id", uid);
      const memberIds = [...new Set((mems ?? []).map((m: { project_id: string }) => m.project_id))];
      let memberRows: ProjectDbRow[] = [];
      if (memberIds.length) {
        const batches = chunk(memberIds, 90);
        const results = await Promise.all(
          batches.map((batch) => client.from("projects").select(PROJECT_LIST_SELECT).in("id", batch)),
        );
        for (const r of results) {
          if (r.error) {
            setErr(r.error.message);
            return;
          }
          memberRows = memberRows.concat((r.data ?? []) as ProjectDbRow[]);
        }
      }
      const { data: owned, error: oerr } = await client
        .from("projects")
        .select(PROJECT_LIST_SELECT)
        .eq("owner_id", uid)
        .order("updated_at", { ascending: false })
        .limit(120);
      if (oerr) {
        setErr(oerr.message);
        return;
      }
      const byId = new Map<string, ProjectDbRow>();
      for (const row of [...memberRows, ...((owned ?? []) as ProjectDbRow[])]) {
        byId.set(row.id, row);
      }
      const merged = [...byId.values()].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setRows(merged.slice(0, 200));

      const ids = merged.map((p) => p.id);
      if (ids.length) {
        const { data: iss, error: ierr } = await client.from("project_issues").select("project_id,status").in("project_id", ids);
        if (!ierr && iss) {
          const stats: Record<string, { total: number; done: number }> = {};
          for (const id of ids) stats[id] = { total: 0, done: 0 };
          for (const row of iss as { project_id: string; status: string }[]) {
            if (!stats[row.project_id]) stats[row.project_id] = { total: 0, done: 0 };
            stats[row.project_id].total += 1;
            if (row.status === "done") stats[row.project_id].done += 1;
          }
          setIssueStats(stats);
        } else {
          setIssueStats({});
        }
      } else {
        setIssueStats({});
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "読み込み失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey) {
        e.preventDefault();
        useWorkspaceUiStore.getState().setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const st = (r.linear_status as ProjectStatus | null) || "planned";
      if (filter === "active") return st !== "completed" && st !== "cancelled";
      if (filter === "completed") return st === "completed";
      return true;
    });
  }, [rows, filter]);

  const toCard = (r: ProjectDbRow): Project => {
    const members: Member[] = [{ id: r.owner_id, name: r.name.trim() || "オーナー", role: "owner" }];
    const phases: Phase[] = [];
    const issues: Issue[] = [];
    return projectRowToWorkspace(r, phases, issues, members);
  };

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const client = supabase;
    if (!client || !form.name.trim()) return;
    setCreating(true);
    try {
      const { data: session } = await client.auth.getSession();
      const uid = session?.session?.user.id;
      if (!uid) return;
      const { data, error } = await client
        .from("projects")
        .insert({
          owner_id: uid,
          name: form.name.trim(),
          description: "",
          category: "探究",
          tags: [],
          visibility: "public",
          recruitment_target: "",
          recruitment_message: "",
          icon: form.icon,
          start_date: form.start ? new Date(form.start).toISOString() : null,
          target_date: form.end ? new Date(form.end).toISOString() : null,
          linear_status: "planned",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await client.from("project_members").upsert(
        { project_id: (data as { id: string }).id, user_id: uid, role: "owner" },
        { onConflict: "project_id,user_id" },
      );
      setModal(false);
      setForm({ name: "", icon: "📁", start: "", end: "" });
      await load();
    } catch (er) {
      setErr(er instanceof Error ? er.message : "作成に失敗");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] bg-[#FAFAFA] text-[#1A1A1A]">
      <ProjectSidebar />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">プロジェクト</h1>
            <p className="text-[12px] text-[#6B7280]">一覧・進捗・ロードマップ・課題をまとめて管理</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px] font-medium text-[#6B7280] hover:bg-[#F7F8F8]"
              onClick={() => setCommandOpen(true)}
            >
              ⌘K
            </button>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px]"
            >
              <option value="all">すべて</option>
              <option value="active">進行中</option>
              <option value="completed">完了</option>
            </select>
            <button
              type="button"
              className="rounded-md bg-[#5E6AD2] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4F5BBD]"
              onClick={() => setModal(true)}
            >
              ＋ 新規プロジェクト
            </button>
          </div>
        </header>
        {err ? <div className="mx-4 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{err}</div> : null}
        <div className="mx-auto max-w-3xl px-4 py-4">
          {loading ? <p className="text-sm text-[#6B7280]">読み込み中…</p> : null}
          {!loading && filtered.length === 0 ? <p className="text-sm text-[#6B7280]">プロジェクトがありません。</p> : null}
          {!loading
            ? filtered.map((r) => {
                const st = issueStats[r.id] ?? { total: 0, done: 0 };
                return <ProjectCard key={r.id} project={toCard(r)} issueTotal={st.total} issueDone={st.done} />;
              })
            : null}
        </div>
        <p className="px-4 pb-6 text-[11px] text-[#6B7280]">
          <Link href="/" className="underline">
            ホームに戻る
          </Link>
          {" · "}
          DB 初回は <code className="rounded bg-[#F7F8F8] px-1">apply_linear_workspace.sql</code> を実行
        </p>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={() => !creating && setModal(false)}>
          <form
            className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void onCreate(e)}
          >
            <h2 className="text-base font-semibold">新規プロジェクト</h2>
            <label className="mt-3 block text-[12px] font-medium text-[#6B7280]">名前（必須）</label>
            <input
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <label className="mt-3 block text-[12px] font-medium text-[#6B7280]">アイコン（絵文字）</label>
            <input
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value.slice(0, 4) }))}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[12px] font-medium text-[#6B7280]">開始日</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
                  value={form.start}
                  onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#6B7280]">終了日</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
                  value={form.end}
                  onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm" onClick={() => setModal(false)} disabled={creating}>
                キャンセル
              </button>
              <button type="submit" className="rounded-md bg-[#5E6AD2] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" disabled={creating}>
                作成
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
