"use client";

import { useCallback, useEffect, useState } from "react";
import { ProjectRoadmapPanel, type RoadmapStepFull } from "@/components/projects/ProjectRoadmapPanel";
import type { TaskPanelRow } from "@/components/projects/ProjectTasksPanel";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { mergeCoachingContext, parseCoachingContext, type CoachingContext } from "@/lib/projects/coachingContext";
import type { ProjectMemberRow, ProjectRow } from "@/lib/projects/types";
import { bumpTeamActivityStreak } from "@/lib/projects/teamActivityStreak";
import { supabase } from "@/lib/supabase";

function isSchemaError(err: { message?: string } | null | undefined): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("42p01");
}

/** 旧プロジェクトスペースと同じ「段階＋フォーカス」のコーチング型ロードマップ */
export default function WorkspaceCoachingRoadmap() {
  const { projectId, uid, canEdit, loading: workspaceLoading } = useProjectWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [steps, setSteps] = useState<RoadmapStepFull[]>([]);
  const [tasks, setTasks] = useState<TaskPanelRow[]>([]);
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!supabase) {
      setError("Supabase が未設定です。");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const client = supabase;
      const { data: projectData, error: projectError } = await client.from("projects").select("*").eq("id", projectId).single();
      if (projectError || !projectData) {
        setError(projectError?.message ?? "プロジェクトを読み込めませんでした。");
        setProject(null);
        return;
      }
      const row = projectData as ProjectRow;
      setProject(row);

      const [memberRes, roadmapRes, tasksRes] = await Promise.all([
        client.from("project_members").select("*").eq("project_id", projectId).order("joined_at", { ascending: true }),
        client
          .from("project_roadmap_steps")
          .select("id,title,status,position,description,due_date,owner_id,notes,completion_criteria,created_at,updated_at")
          .eq("project_id", projectId)
          .order("position", { ascending: true }),
        client
          .from("project_tasks")
          .select("id,title,description,status,priority,due_date,assignee_id,created_by,roadmap_step_id,meta,updated_at")
          .eq("project_id", projectId),
      ]);

      setMembers((memberRes.data ?? []) as ProjectMemberRow[]);
      if (isSchemaError(roadmapRes.error)) {
        setError("ロードマップ用のDBが未適用です。Supabase で apply_project_space_upgrade.sql を実行してください。");
        setSteps([]);
      } else {
        setSteps((roadmapRes.data ?? []) as RoadmapStepFull[]);
      }

      let taskRows: TaskPanelRow[] = [];
      if (!tasksRes.error) {
        taskRows = (tasksRes.data ?? []) as TaskPanelRow[];
      } else {
        const retry = await client
          .from("project_tasks")
          .select("id,title,description,status,priority,due_date,assignee_id,created_by,roadmap_step_id,updated_at")
          .eq("project_id", projectId);
        if (!retry.error) {
          taskRows = (retry.data ?? []).map((r) => ({ ...(r as TaskPanelRow), meta: {} }));
        }
      }
      setTasks(taskRows);

      const ids = [...new Set([row.owner_id, ...(memberRes.data ?? []).map((m: ProjectMemberRow) => m.user_id)])];
      if (ids.length > 0) {
        const { data: profs } = await client.from("profiles").select("id,display_name").in("id", ids);
        const map: Record<string, string> = {};
        for (const p of profs ?? []) {
          map[p.id as string] = ((p.display_name as string | null) ?? "").trim() || "ユーザー";
        }
        setMemberNames(map);
      } else {
        setMemberNames({});
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCoaching = useCallback(
    async (patch: Partial<CoachingContext>) => {
      if (!supabase || !project) return;
      const prev = parseCoachingContext(project.coaching_context);
      const next = mergeCoachingContext(prev, patch);
      const { error: err } = await supabase
        .from("projects")
        .update({ coaching_context: next, updated_at: new Date().toISOString() })
        .eq("id", projectId);
      if (err) throw new Error(err.message);
      setProject((p) => (p ? { ...p, coaching_context: next } : p));
    },
    [project, projectId],
  );

  const recordTeamActivity = useCallback(async () => {
    if (!supabase || !project) return null;
    return bumpTeamActivityStreak(supabase, projectId);
  }, [project, projectId]);

  if (workspaceLoading || loading) {
    return <p className="text-sm text-[#6B7280]">ロードマップを読み込み中…</p>;
  }
  if (error) {
    return <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{error}</div>;
  }
  if (!project) {
    return <p className="text-sm text-[#6B7280]">プロジェクトがありません。</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[#6B7280]">
        探究の段階とマイルストーンを進めます。日々の課題・予定は
        <a href={`/projects/${projectId}/issues`} className="mx-1 font-medium text-[#5E6AD2] hover:underline">
          課題タブ
        </a>
        で管理できます。
      </p>
      <ProjectRoadmapPanel
        projectId={projectId}
        project={project}
        uid={uid}
        steps={steps}
        tasks={tasks}
        members={members}
        memberNames={memberNames}
        canEdit={canEdit}
        onSaveCoaching={(patch) => saveCoaching(patch)}
        onRecordTeamActivity={() => recordTeamActivity()}
        onReload={() => void load()}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}
