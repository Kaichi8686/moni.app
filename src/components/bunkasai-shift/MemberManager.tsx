"use client";

import { useRef, useState } from "react";
import { CorePairPanel } from "./CorePairPanel";
import { SLOTS, formatSlotTitle } from "@/lib/bunkasai-shift/schedule";
import {
  scheduleServerSave,
  useBunkasaiShiftStore,
} from "@/lib/bunkasai-shift/store";
import type { Member } from "@/lib/bunkasai-shift/types";

export function MemberManager() {
  const members = useBunkasaiShiftStore((s) => s.members);
  const addMember = useBunkasaiShiftStore((s) => s.addMember);
  const removeMember = useBunkasaiShiftStore((s) => s.removeMember);
  const renameMember = useBunkasaiShiftStore((s) => s.renameMember);
  const toggleNg = useBunkasaiShiftStore((s) => s.toggleNg);
  const replaceSnapshot = useBunkasaiShiftStore((s) => s.replaceSnapshot);
  const assignments = useBunkasaiShiftStore((s) => s.assignments);
  const warnings = useBunkasaiShiftStore((s) => s.warnings);
  const lastAssignedAt = useBunkasaiShiftStore((s) => s.lastAssignedAt);
  const coreMemberIds = useBunkasaiShiftStore((s) => s.coreMemberIds);
  const dependencies = useBunkasaiShiftStore((s) => s.dependencies);
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-bunkasai-display)] text-2xl tracking-tight text-[var(--bs-ink)]">
          メンバー管理
        </h2>
        <p className="mt-1 text-sm text-[var(--bs-muted)]">
          名前を追加し、参加できない時間帯にチェック。名簿はサーバー＋端末の両方に保存されます。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl border border-[var(--bs-line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--bs-ink-soft)]"
          onClick={() => {
            const payload = {
              members,
              coreMemberIds,
              dependencies,
              exportedAt: new Date().toISOString(),
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "bunkasai-members.json";
            a.click();
            URL.revokeObjectURL(url);
            setBackupMsg("名簿バックアップをダウンロードしました");
          }}
        >
          名簿をバックアップ
        </button>
        <button
          type="button"
          className="rounded-xl border border-[var(--bs-line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--bs-ink-soft)]"
          onClick={() => fileRef.current?.click()}
        >
          バックアップから復元
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const text = await file.text();
              const parsed = JSON.parse(text) as {
                members?: Member[];
                coreMemberIds?: string[];
                dependencies?: {
                  id: string;
                  memberId: string;
                  requiresId: string;
                }[];
                pairs?: { id: string; memberIds: [string, string] }[];
              };
              if (!Array.isArray(parsed.members) || parsed.members.length === 0) {
                setBackupMsg("有効な名簿データがありません");
                return;
              }
              if (
                members.length > 0 &&
                !confirm(
                  `今の名簿（${members.length}人）を、バックアップの ${parsed.members.length}人で置き換えますか？`,
                )
              ) {
                return;
              }
              const deps =
                Array.isArray(parsed.dependencies) && parsed.dependencies.length > 0
                  ? parsed.dependencies
                  : Array.isArray(parsed.pairs)
                    ? parsed.pairs.map((p) => ({
                        id: p.id,
                        memberId: p.memberIds[0],
                        requiresId: p.memberIds[1],
                      }))
                    : [];
              replaceSnapshot({
                members: parsed.members.map((m) => ({
                  id: String(m.id || crypto.randomUUID()),
                  name: String(m.name || "").trim(),
                  ngSlotIds: Array.isArray(m.ngSlotIds) ? m.ngSlotIds : [],
                })),
                assignments,
                warnings,
                lastAssignedAt,
                coreMemberIds: Array.isArray(parsed.coreMemberIds)
                  ? parsed.coreMemberIds
                  : [],
                dependencies: deps,
              });
              scheduleServerSave(0);
              setBackupMsg(`${parsed.members.length}人を復元し、サーバーに保存しました`);
            } catch {
              setBackupMsg("ファイルの読み込みに失敗しました");
            }
          }}
        />
      </div>
      {backupMsg ? <p className="text-xs text-[var(--bs-accent-deep)]">{backupMsg}</p> : null}

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

      <CorePairPanel />

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
