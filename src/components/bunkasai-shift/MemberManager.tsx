"use client";

import { useState } from "react";
import { SLOTS, formatSlotTitle } from "@/lib/bunkasai-shift/schedule";
import { useBunkasaiShiftStore } from "@/lib/bunkasai-shift/store";

export function MemberManager() {
  const members = useBunkasaiShiftStore((s) => s.members);
  const addMember = useBunkasaiShiftStore((s) => s.addMember);
  const removeMember = useBunkasaiShiftStore((s) => s.removeMember);
  const renameMember = useBunkasaiShiftStore((s) => s.renameMember);
  const toggleNg = useBunkasaiShiftStore((s) => s.toggleNg);
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-bunkasai-display)] text-2xl tracking-tight text-[var(--bs-ink)]">
          メンバー管理
        </h2>
        <p className="mt-1 text-sm text-[var(--bs-muted)]">
          名前を追加し、各人が参加できない時間帯にチェックを付けます。
        </p>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          addMember(name);
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 山田太郎"
          className="min-w-0 flex-1 rounded-xl border border-[var(--bs-line)] bg-white px-3 py-2.5 text-[var(--bs-ink)] outline-none ring-[var(--bs-accent)] placeholder:text-[var(--bs-muted)] focus:ring-2"
        />
        <button
          type="submit"
          className="rounded-xl bg-[var(--bs-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--bs-accent-deep)]"
        >
          追加
        </button>
      </form>

      <p className="text-sm font-medium text-[var(--bs-ink-soft)]">
        登録 {members.length} 人 ／ 必要人数は各コマ 9人（合計 63 枠）
      </p>

      <ul className="space-y-3">
        {members.map((m) => {
          const open = openId === m.id;
          return (
            <li
              key={m.id}
              className="rounded-2xl border border-[var(--bs-line)] bg-white/80 p-3 shadow-sm backdrop-blur"
            >
              <div className="flex items-center gap-2">
                <input
                  value={m.name}
                  onChange={(e) => renameMember(m.id, e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-semibold text-[var(--bs-ink)] outline-none focus:border-[var(--bs-line)] focus:bg-white"
                />
                <span className="shrink-0 text-xs text-[var(--bs-muted)]">
                  NG {m.ngSlotIds.length}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : m.id)}
                  className="rounded-lg border border-[var(--bs-line)] px-2.5 py-1.5 text-xs font-medium text-[var(--bs-ink-soft)] hover:bg-[var(--bs-soft)]"
                >
                  {open ? "閉じる" : "NG設定"}
                </button>
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  削除
                </button>
              </div>

              {open ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {SLOTS.map((slot) => {
                    const checked = m.ngSlotIds.includes(slot.id);
                    return (
                      <label
                        key={slot.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                          checked
                            ? "border-red-200 bg-red-50 text-red-800"
                            : "border-[var(--bs-line)] bg-[var(--bs-soft)] text-[var(--bs-ink-soft)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleNg(m.id, slot.id)}
                          className="size-4 accent-red-600"
                        />
                        <span>
                          <span className="font-medium">{formatSlotTitle(slot)}</span>
                          <span className="ml-1 text-xs opacity-70">参加不可</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
