"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CollabRequestMetadata } from "@/lib/types/messages";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  onClose: () => void;
  onSubmit: (metadata: CollabRequestMetadata) => void;
};

export function CollabRequestModal({ onClose, onSubmit }: Props) {
  const { tx } = useI18n();
  const [title, setTitle] = useState(tx("一緒にプロジェクトをやりませんか？", "Want to work on a project together?"));
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [skill, setSkill] = useState("");
  const [duration, setDuration] = useState(tx("1ヶ月程度", "About 1 month"));
  const [compensation, setCompensation] = useState(tx("成果報酬 or 経験として", "Revenue share or for experience"));
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(async ({ data }) => {
      const client = supabase;
      if (!client) return;
      const uid = data.session?.user.id;
      if (!uid) return;
      const { data: rows } = await client
        .from("projects")
        .select("id, name")
        .eq("owner_id", uid)
        .limit(20);
      const list = (rows ?? []) as Array<{ id: string; name: string }>;
      setProjects(list);
      if (list[0]) {
        setProjectId(list[0].id);
        setProjectName(list[0].name);
      }
    });
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{tx("コラボ依頼", "Collab request")}</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              title,
              project_id: projectId,
              project_name: projectName || tx("プロジェクト", "Project"),
              skill_needed: skill || tx("未設定", "Not set"),
              duration,
              compensation,
              status: "pending",
            });
          }}
        >
          <input className="w-full rounded-xl border px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx("タイトル", "Title")} />
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={projectId}
            onChange={(e) => {
              const id = e.target.value;
              setProjectId(id);
              setProjectName(projects.find((p) => p.id === id)?.name ?? "");
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input className="w-full rounded-xl border px-3 py-2 text-sm" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder={tx("必要なスキル", "Skills needed")} />
          <input className="w-full rounded-xl border px-3 py-2 text-sm" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={tx("期間", "Duration")} />
          <input className="w-full rounded-xl border px-3 py-2 text-sm" value={compensation} onChange={(e) => setCompensation(e.target.value)} placeholder={tx("報酬", "Compensation")} />
          <button type="submit" className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white">
            {tx("送信", "Send")}
          </button>
        </form>
      </div>
    </div>
  );
}
