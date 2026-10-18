"use client";

import { useEffect, useState } from "react";
import { ExportPanel } from "./ExportPanel";
import { MemberManager } from "./MemberManager";
import { ShiftTimetable } from "./ShiftTimetable";
import { useBunkasaiShiftStore } from "@/lib/bunkasai-shift/store";

const TABS = [
  { id: "members" as const, label: "メンバー" },
  { id: "assign" as const, label: "シフト表" },
  { id: "export" as const, label: "共有" },
];

export function BunkasaiShiftApp() {
  const tab = useBunkasaiShiftStore((s) => s.tab);
  const setTab = useBunkasaiShiftStore((s) => s.setTab);
  const runAutoAssign = useBunkasaiShiftStore((s) => s.runAutoAssign);
  const clearAssignmentsOnly = useBunkasaiShiftStore((s) => s.clearAssignmentsOnly);
  const memberCount = useBunkasaiShiftStore((s) => s.members.length);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-[var(--bs-muted)]">読み込み中…</div>
    );
  }

  return (
    <div className="bunkasai-shift-root min-h-dvh">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[var(--bs-glow-a)] blur-3xl" />
        <div className="absolute -right-16 top-40 h-80 w-80 rounded-full bg-[var(--bs-glow-b)] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--bs-accent)]">
            Bunkasai Shift
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-bunkasai-display)] text-4xl leading-none tracking-tight text-[var(--bs-ink)] sm:text-5xl">
            文化祭シフト
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--bs-muted)] sm:text-base">
            登録したメンバーは端末に保存され、自動割り当てでも名簿は変わりません。連続シフトなし・1日目と2日目の回数をなるべく均等にします。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runAutoAssign()}
              className="rounded-xl bg-[var(--bs-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--bs-accent-deep)]"
            >
              自動割り当て実行
            </button>
            <button
              type="button"
              onClick={() => setTab("members")}
              className="rounded-xl border border-[var(--bs-line)] bg-white/80 px-4 py-2.5 text-sm font-medium text-[var(--bs-ink-soft)] backdrop-blur"
            >
              メンバー {memberCount}人
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("シフトの割り当てだけ消します。メンバー名簿はそのまま残ります。")) {
                  clearAssignmentsOnly();
                }
              }}
              className="rounded-xl px-3 py-2.5 text-sm text-[var(--bs-muted)] hover:text-[var(--bs-ink)]"
            >
              割当だけクリア
            </button>
          </div>
        </header>

        <nav className="mb-6 flex gap-1 rounded-2xl border border-[var(--bs-line)] bg-white/70 p-1 backdrop-blur">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                tab === t.id
                  ? "bg-[var(--bs-ink)] text-white shadow-sm"
                  : "text-[var(--bs-ink-soft)] hover:bg-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main className="rounded-[1.5rem] border border-[var(--bs-line)] bg-white/55 p-4 shadow-sm backdrop-blur-md sm:p-6">
          {tab === "members" ? <MemberManager /> : null}
          {tab === "assign" ? <ShiftTimetable /> : null}
          {tab === "export" ? <ExportPanel /> : null}
        </main>
      </div>
    </div>
  );
}
