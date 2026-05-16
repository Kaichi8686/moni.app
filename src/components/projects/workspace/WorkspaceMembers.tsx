"use client";

import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { Avatar } from "@/components/ui/Avatar";
import type { Member } from "@/lib/workspace/types";

function roleLabel(role: Member["role"]): string {
  if (role === "owner") return "オーナー";
  if (role === "viewer") return "閲覧者";
  return "メンバー";
}

export default function WorkspaceMembers() {
  const { project, loading } = useProjectWorkspace();
  if (loading) return <p className="text-sm text-[#6B7280]">読み込み中…</p>;
  if (!project) return null;
  return (
    <div className="overflow-hidden rounded-md border border-[#E5E7EB] bg-white">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-[#E5E7EB] bg-[#F7F8F8] text-[11px] font-semibold text-[#6B7280]">
          <tr>
            <th className="px-4 py-2">メンバー</th>
            <th className="px-4 py-2">権限</th>
          </tr>
        </thead>
        <tbody>
          {project.members.map((m) => (
            <tr key={m.id} className="border-b border-[#F7F8F8]">
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <Avatar name={m.name} url={m.avatarUrl} />
                  <span className="font-medium text-[#1A1A1A]">{m.name}</span>
                </div>
              </td>
              <td className="px-4 py-2 text-[#6B7280]">{roleLabel(m.role)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {project.members.length === 0 ? <p className="p-4 text-sm text-[#6B7280]">メンバー情報を取得できませんでした。</p> : null}
    </div>
  );
}
