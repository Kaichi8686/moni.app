"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays } from "date-fns";
import { supabase } from "@/lib/supabase";
import { buildPhasesFromTemplate } from "@/lib/roadmap/phaseTemplates";
import {
  nestPhasesWithTasks,
  parseRoadmapBusinessType,
  type PhaseRowDb,
  type PhaseTaskRowDb,
} from "@/lib/roadmap/mapRows";
import type { PhaseStatus, PhaseTask, RoadmapBusinessType, RoadmapPhase, RoadmapProjectMeta } from "@/lib/roadmap/types";

function isMissingTable(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("42p01") || m.includes("phase_tasks");
}

export function useRoadmapProject(projectId: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState<RoadmapProjectMeta | null>(null);
  const [phases, setPhases] = useState<RoadmapPhase[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase) {
      setError("Supabase が未設定です。");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const client = supabase;
      const { data: session } = await client.auth.getSession();
      const userId = session?.session?.user.id ?? null;
      setUid(userId);

      const { data: prow, error: perr } = await client.from("projects").select("*").eq("id", projectId).single();
      if (perr || !prow) {
        setError(perr?.message ?? "プロジェクトを読み込めませんでした。");
        setProject(null);
        setPhases([]);
        return;
      }

      const row = prow as Record<string, unknown>;
      const ownerId = String(row.owner_id);
      const { data: mem } = await client.from("project_members").select("user_id,role").eq("project_id", projectId);
      const member = userId ? (mem ?? []).find((m) => m.user_id === userId) : undefined;
      setCanEdit(Boolean(userId && (ownerId === userId || member)));

      setProject({
        id: projectId,
        name: String(row.name),
        description: String(row.description ?? ""),
        roadmapBusinessType: parseRoadmapBusinessType(row.roadmap_business_type as string | undefined),
        startDate: (row.start_date as string) ?? undefined,
        targetDate: (row.target_date as string) ?? undefined,
      });

      const { data: ph, error: phErr } = await client
        .from("project_phases")
        .select("*")
        .eq("project_id", projectId)
        .order("order", { ascending: true });

      if (phErr) {
        if (isMissingTable(phErr)) {
          setError("ロードマップ用DBが未適用です。Supabase で apply_linear_workspace.sql と apply_roadmap_phase_tasks.sql を実行してください。");
        } else {
          setError(phErr.message);
        }
        setPhases([]);
        return;
      }

      const { data: tasks, error: tErr } = await client.from("phase_tasks").select("*").eq("project_id", projectId);
      if (tErr && isMissingTable(tErr)) {
        setPhases(nestPhasesWithTasks((ph ?? []) as PhaseRowDb[], []));
        return;
      }

      setPhases(nestPhasesWithTasks((ph ?? []) as PhaseRowDb[], (tasks ?? []) as PhaseTaskRowDb[]));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const movePhase = useCallback(
    async (phaseId: string, deltaDays: number) => {
      if (!supabase || !canEdit || deltaDays === 0) return;
      const ph = phases.find((p) => p.id === phaseId);
      if (!ph) return;
      const s = addDays(new Date(ph.startDate), deltaDays);
      const e = addDays(new Date(ph.endDate), deltaDays);
      const { error: err } = await supabase
        .from("project_phases")
        .update({ start_date: s.toISOString(), end_date: e.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", phaseId);
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, phases, reload],
  );

  const resizePhase = useCallback(
    async (phaseId: string, deltaDays: number) => {
      if (!supabase || !canEdit || deltaDays === 0) return;
      const ph = phases.find((p) => p.id === phaseId);
      if (!ph) return;
      const e = addDays(new Date(ph.endDate), deltaDays);
      if (e.getTime() <= new Date(ph.startDate).getTime()) return;
      const { error: err } = await supabase
        .from("project_phases")
        .update({ end_date: e.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", phaseId);
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, phases, reload],
  );

  const updatePhase = useCallback(
    async (phaseId: string, patch: Partial<{ title: string; goal: string; status: PhaseStatus; startDate: string; endDate: string }>) => {
      if (!supabase || !canEdit) return;
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.title !== undefined) row.title = patch.title.trim();
      if (patch.goal !== undefined) row.goal = patch.goal.trim();
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.startDate !== undefined) row.start_date = new Date(patch.startDate).toISOString();
      if (patch.endDate !== undefined) row.end_date = new Date(patch.endDate).toISOString();
      const { error: err } = await supabase.from("project_phases").update(row).eq("id", phaseId);
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, reload],
  );

  const deletePhase = useCallback(
    async (phaseId: string) => {
      if (!supabase || !canEdit) return;
      const { error: err } = await supabase.from("project_phases").delete().eq("id", phaseId);
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, reload],
  );

  const createPhase = useCallback(
    async (input: { title: string; goal?: string; startDate: string; endDate: string; status?: PhaseStatus }) => {
      if (!supabase || !canEdit) return;
      const maxOrder = phases.reduce((m, p) => Math.max(m, p.order), -1);
      const { error: err } = await supabase.from("project_phases").insert({
        project_id: projectId,
        title: input.title.trim(),
        goal: (input.goal ?? "").trim(),
        start_date: input.startDate,
        end_date: input.endDate,
        status: input.status ?? "planned",
        color: "purple",
        order: maxOrder + 1,
      });
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, phases, projectId, reload],
  );

  const bulkCreateFromTemplate = useCallback(
    async (businessType: RoadmapBusinessType) => {
      if (!supabase || !canEdit) return;
      const start = project?.startDate ? new Date(project.startDate) : new Date();
      const maxOrder = phases.reduce((m, p) => Math.max(m, p.order), -1);
      const rows = buildPhasesFromTemplate(projectId, businessType, start).map((row, i) => ({
        ...row,
        order: maxOrder + 1 + i,
        status: phases.length === 0 && i === 0 ? row.status : "planned",
      }));
      const { error: err } = await supabase.from("project_phases").insert(rows);
      if (err) throw new Error(err.message);
      await supabase.from("projects").update({ roadmap_business_type: businessType }).eq("id", projectId);
      await reload();
    },
    [canEdit, project, projectId, reload],
  );

  const createTask = useCallback(
    async (phaseId: string, title: string) => {
      if (!supabase || !canEdit) return;
      const { error: err } = await supabase.from("phase_tasks").insert({
        project_id: projectId,
        phase_id: phaseId,
        title: title.trim(),
        status: "todo",
        priority: "medium",
        is_today: false,
      });
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, projectId, reload],
  );

  const updateTask = useCallback(
    async (taskId: string, patch: Partial<{ title: string; status: PhaseTask["status"]; isToday: boolean; priority: PhaseTask["priority"] }>) => {
      if (!supabase || !canEdit) return;
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.title !== undefined) row.title = patch.title.trim();
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.isToday !== undefined) row.is_today = patch.isToday;
      if (patch.priority !== undefined) row.priority = patch.priority;
      const { error: err } = await supabase.from("phase_tasks").update(row).eq("id", taskId);
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, reload],
  );

  const toggleTaskToday = useCallback(
    async (taskId: string, next: boolean) => {
      if (!supabase || !canEdit) return;
      if (next) {
        await supabase.from("phase_tasks").update({ is_today: false }).eq("project_id", projectId).eq("is_today", true);
      }
      const { error: err } = await supabase.from("phase_tasks").update({ is_today: next, updated_at: new Date().toISOString() }).eq("id", taskId);
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, projectId, reload],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!supabase || !canEdit) return;
      const { error: err } = await supabase.from("phase_tasks").delete().eq("id", taskId);
      if (err) throw new Error(err.message);
      await reload();
    },
    [canEdit, reload],
  );

  return {
    loading,
    error,
    project,
    phases,
    canEdit,
    uid,
    reload,
    movePhase,
    resizePhase,
    updatePhase,
    deletePhase,
    createPhase,
    bulkCreateFromTemplate,
    createTask,
    updateTask,
    toggleTaskToday,
    deleteTask,
  };
}
