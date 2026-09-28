"use client";

import type { Member } from "@/lib/workspace/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** 課題の担当者を複数選択するチェックボックス一覧 */
export function AssigneeMultiSelect({
  members,
  selectedIds,
  onChange,
  idPrefix = "assignee",
}: {
  members: Member[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  idPrefix?: string;
}) {
  const { tx } = useI18n();
  const selected = new Set(selectedIds);

  function toggle(memberId: string) {
    const next = new Set(selected);
    if (next.has(memberId)) next.delete(memberId);
    else next.add(memberId);
    onChange(members.map((m) => m.id).filter((id) => next.has(id)));
  }

  if (members.length === 0) {
    return <p className="mt-1 text-[13px] text-zinc-500">{tx("メンバーがいません", "No members")}</p>;
  }

  return (
    <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2">
      {members.map((member) => {
        const checked = selected.has(member.id);
        const inputId = `${idPrefix}-${member.id}`;
        return (
          <label
            key={member.id}
            htmlFor={inputId}
            className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50"
          >
            <input
              id={inputId}
              type="checkbox"
              checked={checked}
              onChange={() => toggle(member.id)}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
            />
            <span className="truncate">{member.name}</span>
          </label>
        );
      })}
    </div>
  );
}
