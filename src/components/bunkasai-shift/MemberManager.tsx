"use client";

import { useRef, useState } from "react";
import { CorePairPanel } from "./CorePairPanel";
import { SLOTS, formatSlotTitle } from "@/lib/bunkasai-shift/schedule";
import {
  scheduleServerSave,
  useBunkasaiShiftStore,
} from "@/lib/bunkasai-shift/store";
import {
  DEFAULT_MAX_SHIFTS,
  MAX_MAX_SHIFTS,
  MIN_MAX_SHIFTS,
  type Member,
} from "@/lib/bunkasai-shift/types";

export function MemberManager() {
  const members = useBunkasaiShiftStore((s) => s.members);
  const addMember = useBunkasaiShiftStore((s) => s.addMember);
  const removeMember = useBunkasaiShiftStore((s) => s.removeMember);
  const renameMember = useBunkasaiShiftStore((s) => s.renameMember);
  const setMaxShifts = useBunkasaiShiftStore((s) => s.setMaxShifts);
  const setAllMaxShifts = useBunkasaiShiftStore((s) => s.setAllMaxShifts);
  const toggleNg = useBunkasaiShiftStore((s) => s.toggleNg);
  const toggleMust = useBunkasaiShiftStore((s) => s.toggleMust);
  const replaceSnapshot = useBunkasaiShiftStore((s) => s.replaceSnapshot);
  const assignments = useBunkasaiShiftStore((s) => s.assignments);
  const warnings = useBunkasaiShiftStore((s) => s.warnings);
  const lastAssignedAt = useBunkasaiShiftStore((s) => s.lastAssignedAt);
  const coreMemberIds = useBunkasaiShiftStore((s) => s.coreMemberIds);
  const dependencies = useBunkasaiShiftStore((s) => s.dependencies);
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState("");
  const [bulkMax, setBulkMax] = useState(DEFAULT_MAX_SHIFTS);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-bunkasai-display)] text-2xl tracking-tight text-[var(--bs-ink)]">
          メンバー管理
        </h2>
        <p className="mt-1 text-sm text-[var(--bs-muted)]">
          名前・シフト上限・NGを設定。名簿はサーバー＋端末に保存され、自動割り当てでも消えません。
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
                  maxShifts: m.maxShifts ?? DEFAULT_MAX_SHIFTS,
                  mustSlotIds: Array.isArray(m.mustSlotIds) ? m.mustSlotIds : [],
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
        登録 {members.length} 人 ／ 必要人数は各コマ 9人（合計 63 枠） ／ 上限デフォルト{" "}
        {DEFAULT_MAX_SHIFTS}コマ
      </p>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--bs-line)] bg-white/70 p-3">
        <label className="text-xs font-medium text-[var(--bs-muted)]">
          全員の上限を一括
          <select
            className="mt-1 block rounded-lg border border-[var(--bs-line)] bg-white px-2 py-1.5 text-sm text-[var(--bs-ink)]"
            value={bulkMax}
            onChange={(e) => setBulkMax(Number(e.target.value))}
          >
            {Array.from({ length: MAX_MAX_SHIFTS - MIN_MAX_SHIFTS + 1 }, (_, i) => {
              const n = MIN_MAX_SHIFTS + i;
              return (
                <option key={n} value={n}>
                  {n}コマまで
                </option>
              );
            })}
          </select>
        </label>
        <button
          type="button"
          className="rounded-xl bg-[var(--bs-ink)] px-3 py-2 text-xs font-semibold text-white"
          onClick={() => {
            if (confirm(`全員のシフト上限を ${bulkMax} コマにしますか？`)) {
              setAllMaxShifts(bulkMax);
            }
          }}
        >
          全員に適用
        </button>
      </div>

      <CorePairPanel />

      <ul className="space-y-3">
        {members.map((m) => {
          const open = openId === m.id;
          return (
            <li
              key={m.id}
              className="rounded-2xl border border-[var(--bs-line)] bg-white/80 p-3 shadow-sm backdrop-blur"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={m.name}
                  onChange={(e) => renameMember(m.id, e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-semibold text-[var(--bs-ink)] outline-none focus:border-[var(--bs-line)] focus:bg-white"
                />
                <label className="flex shrink-0 items-center gap-1 text-xs text-[var(--bs-muted)]">
                  上限
                  <select
                    value={m.maxShifts ?? DEFAULT_MAX_SHIFTS}
                    onChange={(e) => setMaxShifts(m.id, Number(e.target.value))}
                    className="rounded-lg border border-[var(--bs-line)] bg-white px-1.5 py-1 text-sm font-semibold text-[var(--bs-ink)]"
                    aria-label={`${m.name}のシフト上限`}
                  >
                    {Array.from({ length: MAX_MAX_SHIFTS - MIN_MAX_SHIFTS + 1 }, (_, i) => {
                      const n = MIN_MAX_SHIFTS + i;
                      return (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <span className="shrink-0 text-xs text-[var(--bs-muted)]">
                  必{(m.mustSlotIds ?? []).length} / NG {m.ngSlotIds.length}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : m.id)}
                  className="rounded-lg border border-[var(--bs-line)] px-2.5 py-1.5 text-xs font-medium text-[var(--bs-ink-soft)] hover:bg-[var(--bs-soft)]"
                >
                  {open ? "閉じる" : "時間設定"}
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
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-[var(--bs-muted)]">
                    各コマで「必ず入る」か「参加不可」を選べます（同時には選べません）。
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SLOTS.map((slot) => {
                      const isNg = m.ngSlotIds.includes(slot.id);
                      const isMust = (m.mustSlotIds ?? []).includes(slot.id);
                      return (
                        <div
                          key={slot.id}
                          className={`rounded-xl border px-3 py-2 text-sm ${
                            isMust
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : isNg
                                ? "border-red-200 bg-red-50 text-red-800"
                                : "border-[var(--bs-line)] bg-[var(--bs-soft)] text-[var(--bs-ink-soft)]"
                          }`}
                        >
                          <p className="mb-2 font-medium">{formatSlotTitle(slot)}</p>
                          <div className="flex flex-wrap gap-3">
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={isMust}
                                onChange={() => toggleMust(m.id, slot.id)}
                                className="size-4 accent-emerald-600"
                              />
                              必ず入る
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={isNg}
                                onChange={() => toggleNg(m.id, slot.id)}
                                className="size-4 accent-red-600"
                              />
                              参加不可
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
