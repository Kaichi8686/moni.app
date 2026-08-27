"use client";

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { Avatar } from "@/components/ui/Avatar";
import { navigateToDirectMessage } from "@/lib/messages/openDirectMessage";
import { supabase } from "@/lib/supabase";
import type { Member } from "@/lib/workspace/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

function roleLabel(role: Member["role"], tx: (ja: string, en: string) => string): string {
  if (role === "owner") return tx("オーナー", "Owner");
  if (role === "viewer") return tx("閲覧者", "Viewer");
  return tx("メンバー", "Member");
}

export default function WorkspaceMembers() {
  const { tx } = useI18n();
  const router = useRouter();
  const { project, loading, uid } = useProjectWorkspace();

  if (loading) return <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p>;
  if (!project) return null;

  async function openTalk(peerId: string) {
    if (!uid) {
      router.push("/login");
      return;
    }
    if (peerId === uid || !supabase) return;
    await navigateToDirectMessage(supabase, router, peerId);
  }

  return (
    <div className="overflow-hidden rounded-md border border-[#E5E7EB] bg-white">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-[#E5E7EB] bg-[#F7F8F8] text-[11px] font-semibold text-[#6B7280]">
          <tr>
            <th className="px-4 py-2">{tx("メンバー", "Member")}</th>
            <th className="px-4 py-2">{tx("権限", "Role")}</th>
            <th className="w-24 px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {project.members.map((m) => {
            const isSelf = Boolean(uid && m.id === uid);
            return (
              <tr key={m.id} className="border-b border-[#F7F8F8]">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={m.name} url={m.avatarUrl} />
                    <span className="font-medium text-[#1A1A1A]">
                      {m.name}
                      {isSelf ? <span className="ml-1 text-[11px] font-normal text-[#6B7280]">{tx("（あなた）", "(you)")}</span> : null}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 text-[#6B7280]">{roleLabel(m.role, tx)}</td>
                <td className="px-4 py-2 text-right">
                  {isSelf ? (
                    <span className="text-[11px] text-[#9CA3AF]">—</span>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:bg-[#F7F8F8]"
                      onClick={() => openTalk(m.id)}
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[#5E6AD2]" aria-hidden />
                      {tx("トーク", "Chat")}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {project.members.length === 0 ? (
        <p className="p-4 text-sm text-[#6B7280]">{tx("メンバー情報を取得できませんでした。", "Couldn’t load members.")}</p>
      ) : null}
    </div>
  );
}
