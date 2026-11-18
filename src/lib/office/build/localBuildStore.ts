import type { RunStore } from "@/lib/office/build/runService";
import { ensureStarterCompany } from "@/lib/office/build/runService";
import type { BuildCompanyState, OfficeRun } from "@/lib/office/build/runTypes";

const KEY = "moni.office.build.v1";

type Blob = {
  company: BuildCompanyState | null;
  runs: OfficeRun[];
};

function read(): Blob {
  if (typeof localStorage === "undefined") return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { company: null, runs: [] };
    return JSON.parse(raw) as Blob;
  } catch {
    return { company: null, runs: [] };
  }
}

function write(blob: Blob) {
  memory = blob;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(blob));
  } catch {
    /* ignore */
  }
}

/** サーバー/テスト用メモリ */
let memory: Blob = { company: null, runs: [] };

export function resetLocalBuildStore() {
  memory = { company: null, runs: [] };
  if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
}

export function createMemoryRunStore(seed?: BuildCompanyState): RunStore {
  const state: Blob = {
    company: seed ? ensureStarterCompany(seed) : null,
    runs: [],
  };
  return {
    getCompany: (userId) =>
      state.company && state.company.userId === userId ? state.company : null,
    saveCompany: (company) => {
      state.company = company;
    },
    getRun: (runId) => state.runs.find((r) => r.id === runId) ?? null,
    findDailyRun: (userId, dateKey) =>
      state.runs.find((r) => r.userId === userId && r.mode === "daily" && r.dateKey === dateKey) ??
      null,
    saveRun: (run) => {
      const i = state.runs.findIndex((r) => r.id === run.id);
      if (i >= 0) state.runs[i] = run;
      else state.runs.push(run);
    },
    listFinishedRatios: (userId, limit) =>
      state.runs
        .filter((r) => r.userId === userId && r.status === "finished" && r.ratio != null)
        .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))
        .slice(0, limit)
        .map((r) => r.ratio!),
  };
}

/** ブラウザ localStorage 向け */
export function createBrowserRunStore(): RunStore {
  return {
    getCompany: (userId) => {
      const blob = read();
      return blob.company && blob.company.userId === userId ? blob.company : null;
    },
    saveCompany: (company) => {
      const blob = read();
      blob.company = company;
      write(blob);
    },
    getRun: (runId) => read().runs.find((r) => r.id === runId) ?? null,
    findDailyRun: (userId, dateKey) =>
      read().runs.find(
        (r) => r.userId === userId && r.mode === "daily" && r.dateKey === dateKey,
      ) ?? null,
    saveRun: (run) => {
      const blob = read();
      const i = blob.runs.findIndex((r) => r.id === run.id);
      if (i >= 0) blob.runs[i] = run;
      else blob.runs.push(run);
      write(blob);
    },
    listFinishedRatios: (userId, limit) =>
      read()
        .runs.filter((r) => r.userId === userId && r.status === "finished" && r.ratio != null)
        .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))
        .slice(0, limit)
        .map((r) => r.ratio!),
  };
}
