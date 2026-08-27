import { supabase } from "@/lib/supabase";
import {
  DEFAULT_IDEA_VOTING_SETTINGS,
  type IdeaVoteEvent,
  type IdeaVotingSettings,
  type ProjectIdea,
} from "@/lib/projects/ideaVoting/types";

export type IdeaVoteRow = {
  ideaId: string;
  userId: string;
  count: number;
};

export type IdeaBoardSettings = IdeaVotingSettings & {
  closed: boolean;
  anonymous: boolean;
};

export const DEFAULT_BOARD_SETTINGS: IdeaBoardSettings = {
  ...DEFAULT_IDEA_VOTING_SETTINGS,
  closed: false,
  anonymous: true,
};

/** dedicated tables | existing project_tasks (SQL未適用でも動く) */
export type IdeaVotingBackend = "tables" | "tasks";

export const LEGACY_EVENT_ID = "__legacy__";

export type IdeaVoteEventWithCount = IdeaVoteEvent & { optionCount: number };

type IdeaDbRow = {
  id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
  event_id?: string | null;
};

type VoteDbRow = {
  idea_id: string;
  user_id: string;
  count: number;
};

type SettingsDbRow = {
  votes_per_person: number;
  max_votes_per_idea: number;
  closed: boolean;
  anonymous: boolean;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  meta: Record<string, unknown> | null;
};

const IDEA_KIND = "idea_vote";
const BALLOT_KIND = "idea_ballot";
const SETTINGS_KIND = "idea_settings";
const EVENT_KIND = "idea_event";
const SETTINGS_TITLE = "__idea_voting_settings__";

let cachedBackend: IdeaVotingBackend | null = null;
let cachedEventsTable: boolean | null = null;
let cachedIdeaEventColumn: boolean | null = null;

function requireClient() {
  if (!supabase) throw new Error("Supabase が未設定です。");
  return supabase;
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(10, Math.max(1, Math.round(value)));
}

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    msg.includes("Could not find the table") ||
    msg.includes("does not exist")
  );
}

/** 一度だけ dedicated テーブルの有無を判定 */
export async function resolveIdeaVotingBackend(): Promise<IdeaVotingBackend> {
  if (cachedBackend) return cachedBackend;
  const client = requireClient();
  const probe = await client.from("project_ideas").select("id").limit(1);
  if (!probe.error) {
    cachedBackend = "tables";
    return cachedBackend;
  }
  if (isMissingRelation(probe.error)) {
    cachedBackend = "tasks";
    return cachedBackend;
  }
  // 権限エラー等でも tasks にフォールバック（一覧は空で返る）
  cachedBackend = "tasks";
  return cachedBackend;
}

export function ideaVotingRealtimeTable(backend: IdeaVotingBackend): string {
  return backend === "tables" ? "project_ideas" : "project_tasks";
}

async function hasEventsTable(): Promise<boolean> {
  if (cachedEventsTable !== null) return cachedEventsTable;
  const client = requireClient();
  const probe = await client.from("project_idea_events").select("id").limit(1);
  if (!probe.error) {
    cachedEventsTable = true;
    return true;
  }
  cachedEventsTable = !isMissingRelation(probe.error);
  return cachedEventsTable;
}

async function hasIdeaEventColumn(): Promise<boolean> {
  if (cachedIdeaEventColumn !== null) return cachedIdeaEventColumn;
  const client = requireClient();
  const probe = await client.from("project_ideas").select("id,event_id").limit(1);
  if (!probe.error) {
    cachedIdeaEventColumn = true;
    return true;
  }
  const msg = (probe.error.message ?? "").toLowerCase();
  cachedIdeaEventColumn = !(isMissingRelation(probe.error) || msg.includes("event_id"));
  return cachedIdeaEventColumn;
}

type EventDbRow = {
  id: string;
  project_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  closes_at: string | null;
  closed: boolean;
  anonymous: boolean;
  votes_per_person: number;
  max_votes_per_idea: number;
  created_at: string;
};

function mapEventRow(r: EventDbRow): IdeaVoteEvent {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description ?? "",
    createdAt: r.created_at,
    createdBy: r.created_by,
    closesAt: r.closes_at,
    closed: Boolean(r.closed),
    anonymous: r.anonymous !== false,
    votesPerPerson: clampLimit(r.votes_per_person),
    maxVotesPerIdea: clampLimit(r.max_votes_per_idea),
  };
}

function eventFromTask(r: TaskRow, projectId: string): IdeaVoteEvent | null {
  const m = metaOf(r);
  if (m.kind !== EVENT_KIND) return null;
  return {
    id: r.id,
    projectId,
    title: r.title.replace(/^__event__:/, "") || "投票",
    description: (r.description ?? "").trim(),
    createdAt: r.created_at,
    createdBy: r.created_by,
    closesAt: typeof m.closesAt === "string" ? m.closesAt : null,
    closed: Boolean(m.closed),
    anonymous: m.anonymous === undefined ? true : Boolean(m.anonymous),
    votesPerPerson: clampLimit(Number(m.votesPerPerson) || 1),
    maxVotesPerIdea: clampLimit(Number(m.maxVotesPerIdea) || 1),
  };
}

async function loadEventTasks(projectId: string): Promise<TaskRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("project_tasks")
    .select("id,title,description,status,created_by,created_at,updated_at,meta")
    .eq("project_id", projectId)
    .contains("meta", { kind: EVENT_KIND })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    const all = await client
      .from("project_tasks")
      .select("id,title,description,status,created_by,created_at,updated_at,meta")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (all.error) throw new Error(all.error.message);
    return ((all.data as TaskRow[] | null) ?? []).filter((r) => metaOf(r).kind === EVENT_KIND);
  }
  return (data as TaskRow[] | null) ?? [];
}

function metaOf(row: TaskRow): Record<string, unknown> {
  return row.meta && typeof row.meta === "object" ? row.meta : {};
}

async function loadIdeaTasks(projectId: string): Promise<TaskRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("project_tasks")
    .select("id,title,description,status,created_by,created_at,updated_at,meta")
    .eq("project_id", projectId)
    .contains("meta", { kind: IDEA_KIND })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    // contains が古い環境で落ちる場合は全件からフィルタ
    const all = await client
      .from("project_tasks")
      .select("id,title,description,status,created_by,created_at,updated_at,meta")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (all.error) throw new Error(all.error.message);
    return ((all.data as TaskRow[] | null) ?? []).filter((r) => metaOf(r).kind === IDEA_KIND);
  }
  return (data as TaskRow[] | null) ?? [];
}

async function loadBallotTasks(projectId: string): Promise<TaskRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("project_tasks")
    .select("id,title,description,status,created_by,created_at,updated_at,meta")
    .eq("project_id", projectId)
    .contains("meta", { kind: BALLOT_KIND })
    .limit(5000);
  if (error) {
    const all = await client
      .from("project_tasks")
      .select("id,title,description,status,created_by,created_at,updated_at,meta")
      .eq("project_id", projectId)
      .limit(5000);
    if (all.error) throw new Error(all.error.message);
    return ((all.data as TaskRow[] | null) ?? []).filter((r) => metaOf(r).kind === BALLOT_KIND);
  }
  return (data as TaskRow[] | null) ?? [];
}

async function loadSettingsTask(projectId: string): Promise<TaskRow | null> {
  const client = requireClient();
  const { data, error } = await client
    .from("project_tasks")
    .select("id,title,description,status,created_by,created_at,updated_at,meta")
    .eq("project_id", projectId)
    .eq("title", SETTINGS_TITLE)
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    // ignore and try contains
  }
  if (data) return data as TaskRow;
  const { data: rows } = await client
    .from("project_tasks")
    .select("id,title,description,status,created_by,created_at,updated_at,meta")
    .eq("project_id", projectId)
    .contains("meta", { kind: SETTINGS_KIND })
    .limit(1);
  return ((rows as TaskRow[] | null) ?? [])[0] ?? null;
}

export async function fetchIdeas(projectId: string, eventId?: string | null): Promise<ProjectIdea[]> {
  const backend = await resolveIdeaVotingBackend();
  const client = requireClient();
  if (backend === "tables") {
    const withEventCol = await hasIdeaEventColumn();
    if (withEventCol) {
      let q = client
        .from("project_ideas")
        .select("id, author_id, author_name, body, created_at, event_id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (eventId === LEGACY_EVENT_ID) q = q.is("event_id", null);
      else if (eventId) q = q.eq("event_id", eventId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return ((data as IdeaDbRow[] | null) ?? []).map((r) => ({
        id: r.id,
        text: r.body,
        votes: 0,
        createdAt: r.created_at,
        authorName: r.author_name ?? undefined,
        authorId: r.author_id,
      }));
    }
    if (eventId && eventId !== LEGACY_EVENT_ID) return [];
    const { data, error } = await client
      .from("project_ideas")
      .select("id, author_id, author_name, body, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return ((data as IdeaDbRow[] | null) ?? []).map((r) => ({
      id: r.id,
      text: r.body,
      votes: 0,
      createdAt: r.created_at,
      authorName: r.author_name ?? undefined,
      authorId: r.author_id,
    }));
  }

  const rows = await loadIdeaTasks(projectId);
  return rows
    .filter((r) => {
      const m = metaOf(r);
      const rid = typeof m.eventId === "string" ? m.eventId : LEGACY_EVENT_ID;
      if (!eventId) return true;
      return rid === eventId;
    })
    .map((r) => {
      const m = metaOf(r);
      const full =
        (r.description || "").trim().length > 0 && (r.description || "").trim() !== r.title.trim()
          ? `${r.title}\n${r.description}`
          : r.title;
      return {
        id: r.id,
        text: full,
        votes: 0,
        createdAt: r.created_at,
        authorName: typeof m.authorName === "string" ? m.authorName : undefined,
        authorId: r.created_by,
      };
    });
}

export async function fetchVotes(projectId: string): Promise<IdeaVoteRow[]> {
  const backend = await resolveIdeaVotingBackend();
  const client = requireClient();
  if (backend === "tables") {
    const { data, error } = await client
      .from("project_idea_votes")
      .select("idea_id, user_id, count")
      .eq("project_id", projectId)
      .limit(5000);
    if (error) throw new Error(error.message);
    return ((data as VoteDbRow[] | null) ?? []).map((r) => ({
      ideaId: r.idea_id,
      userId: r.user_id,
      count: r.count,
    }));
  }

  const rows = await loadBallotTasks(projectId);
  return rows
    .map((r) => {
      const m = metaOf(r);
      const ideaId = typeof m.ideaId === "string" ? m.ideaId : "";
      const count = typeof m.count === "number" ? m.count : Number(m.count) || 0;
      if (!ideaId || count <= 0) return null;
      return { ideaId, userId: r.created_by, count };
    })
    .filter((x): x is IdeaVoteRow => x !== null);
}

export async function fetchSettings(projectId: string): Promise<IdeaBoardSettings> {
  const backend = await resolveIdeaVotingBackend();
  const client = requireClient();
  if (backend === "tables") {
    const { data, error } = await client
      .from("project_idea_settings")
      .select("votes_per_person, max_votes_per_idea, closed, anonymous")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    const row = data as SettingsDbRow | null;
    if (!row) return { ...DEFAULT_BOARD_SETTINGS };
    return {
      votesPerPerson: clampLimit(row.votes_per_person),
      maxVotesPerIdea: clampLimit(row.max_votes_per_idea),
      closed: Boolean(row.closed),
      anonymous: Boolean(row.anonymous),
    };
  }

  const row = await loadSettingsTask(projectId);
  if (!row) return { ...DEFAULT_BOARD_SETTINGS };
  const m = metaOf(row);
  return {
    votesPerPerson: clampLimit(Number(m.votesPerPerson)),
    maxVotesPerIdea: clampLimit(Number(m.maxVotesPerIdea)),
    closed: Boolean(m.closed),
    anonymous: m.anonymous === undefined ? true : Boolean(m.anonymous),
  };
}

export async function createIdea(
  projectId: string,
  uid: string,
  body: string,
  authorName: string | null,
  eventId?: string | null,
): Promise<ProjectIdea> {
  const backend = await resolveIdeaVotingBackend();
  const client = requireClient();
  const scopedEventId = eventId && eventId !== LEGACY_EVENT_ID ? eventId : null;
  if (backend === "tables") {
    const row: Record<string, unknown> = { project_id: projectId, author_id: uid, author_name: authorName, body };
    if (scopedEventId && (await hasIdeaEventColumn())) row.event_id = scopedEventId;
    let { data, error } = await client
      .from("project_ideas")
      .insert(row)
      .select("id, author_id, author_name, body, created_at")
      .single();
    if (error && scopedEventId && /event_id|column/i.test(error.message)) {
      delete row.event_id;
      ({ data, error } = await client
        .from("project_ideas")
        .insert(row)
        .select("id, author_id, author_name, body, created_at")
        .single());
    }
    if (error || !data) throw new Error(error?.message ?? "投稿に失敗しました。");
    const r = data as IdeaDbRow;
    return {
      id: r.id,
      text: r.body,
      votes: 0,
      createdAt: r.created_at,
      authorName: r.author_name ?? undefined,
      authorId: r.author_id,
    };
  }

  const { data, error } = await client
    .from("project_tasks")
    .insert({
      project_id: projectId,
      title: body.slice(0, 180) || "アイデア",
      description: body,
      status: "not_started",
      priority: "medium",
      created_by: uid,
      ai_generated: false,
      meta: { kind: IDEA_KIND, authorName, authorId: uid, eventId: scopedEventId ?? LEGACY_EVENT_ID },
    })
    .select("id,title,description,status,created_by,created_at,updated_at,meta")
    .single();
  if (error || !data) throw new Error(error?.message ?? "投稿に失敗しました。");
  const r = data as TaskRow;
  return {
    id: r.id,
    text: body,
    votes: 0,
    createdAt: r.created_at,
    authorName: authorName ?? undefined,
    authorId: uid,
  };
}

export async function deleteIdea(ideaId: string): Promise<void> {
  const backend = await resolveIdeaVotingBackend();
  const client = requireClient();
  if (backend === "tables") {
    const { error } = await client.from("project_ideas").delete().eq("id", ideaId);
    if (error) throw new Error(error.message);
    return;
  }

  // project_tasks に DELETE ポリシーが無い環境があるため soft-delete
  const { data: related } = await client
    .from("project_tasks")
    .select("id,meta,project_id")
    .eq("id", ideaId)
    .maybeSingle();
  const projectId = (related as { project_id?: string } | null)?.project_id;
  if (projectId) {
    const allBallots = await loadBallotTasks(projectId);
    for (const b of allBallots.filter((r) => metaOf(r).ideaId === ideaId)) {
      await client
        .from("project_tasks")
        .update({ meta: { kind: "idea_ballot_deleted", ideaId }, updated_at: new Date().toISOString() })
        .eq("id", b.id);
    }
  }
  const { error } = await client
    .from("project_tasks")
    .update({
      meta: { kind: "idea_vote_deleted" },
      updated_at: new Date().toISOString(),
    })
    .eq("id", ideaId);
  if (error) throw new Error(error.message);
}

/** 自分の票数を「絶対値」で設定する（0なら削除）。 */
export async function setMyVote(
  projectId: string,
  ideaId: string,
  uid: string,
  count: number,
): Promise<void> {
  const backend = await resolveIdeaVotingBackend();
  const client = requireClient();
  if (backend === "tables") {
    if (count <= 0) {
      const { error } = await client
        .from("project_idea_votes")
        .delete()
        .eq("idea_id", ideaId)
        .eq("user_id", uid);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await client.from("project_idea_votes").upsert(
      { project_id: projectId, idea_id: ideaId, user_id: uid, count, updated_at: new Date().toISOString() },
      { onConflict: "idea_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return;
  }

  const ballots = await loadBallotTasks(projectId);
  const mine = ballots.find((r) => r.created_by === uid && metaOf(r).ideaId === ideaId);

  if (count <= 0) {
    if (mine) {
      const { error } = await client
        .from("project_tasks")
        .update({
          meta: { kind: "idea_ballot_deleted", ideaId, count: 0 },
          updated_at: new Date().toISOString(),
        })
        .eq("id", mine.id);
      if (error) throw new Error(error.message);
    }
    return;
  }

  if (mine) {
    const { error } = await client
      .from("project_tasks")
      .update({
        meta: { kind: BALLOT_KIND, ideaId, count },
        updated_at: new Date().toISOString(),
      })
      .eq("id", mine.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from("project_tasks").insert({
    project_id: projectId,
    title: `__vote__:${ideaId.slice(0, 8)}`,
    description: "",
    status: "done",
    priority: "low",
    created_by: uid,
    ai_generated: false,
    meta: { kind: BALLOT_KIND, ideaId, count },
  });
  if (error) throw new Error(error.message);
}

export async function saveBoardSettings(projectId: string, settings: IdeaBoardSettings): Promise<void> {
  const backend = await resolveIdeaVotingBackend();
  const client = requireClient();
  if (backend === "tables") {
    const { error } = await client.from("project_idea_settings").upsert(
      {
        project_id: projectId,
        votes_per_person: clampLimit(settings.votesPerPerson),
        max_votes_per_idea: clampLimit(settings.maxVotesPerIdea),
        closed: settings.closed,
        anonymous: settings.anonymous,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" },
    );
    if (error) throw new Error(error.message);
    return;
  }

  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("ログインが必要です。");

  const existing = await loadSettingsTask(projectId);
  const meta = {
    kind: SETTINGS_KIND,
    votesPerPerson: clampLimit(settings.votesPerPerson),
    maxVotesPerIdea: clampLimit(settings.maxVotesPerIdea),
    closed: settings.closed,
    anonymous: settings.anonymous,
  };

  if (existing) {
    const { error } = await client
      .from("project_tasks")
      .update({ meta, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from("project_tasks").insert({
    project_id: projectId,
    title: SETTINGS_TITLE,
    description: "idea voting settings",
    status: "done",
    priority: "low",
    created_by: uid,
    ai_generated: false,
    meta,
  });
  if (error) throw new Error(error.message);
}

export type CreateVoteEventInput = {
  title: string;
  description?: string;
  closesAt?: string | null;
  anonymous?: boolean;
  votesPerPerson?: number;
  maxVotesPerIdea?: number;
};

export type UpdateVoteEventInput = Partial<{
  title: string;
  description: string;
  closesAt: string | null;
  closed: boolean;
  anonymous: boolean;
  votesPerPerson: number;
  maxVotesPerIdea: number;
}>;

async function optionCountsByEvent(projectId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const backend = await resolveIdeaVotingBackend();
  const client = requireClient();
  if (backend === "tables" && (await hasIdeaEventColumn())) {
    const { data } = await client.from("project_ideas").select("id,event_id").eq("project_id", projectId).limit(2000);
    for (const r of (data as Array<{ id: string; event_id?: string | null }> | null) ?? []) {
      const key = r.event_id || LEGACY_EVENT_ID;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }
  if (backend === "tables") {
    const all = await fetchIdeas(projectId);
    counts.set(LEGACY_EVENT_ID, all.length);
    return counts;
  }
  const rows = await loadIdeaTasks(projectId);
  for (const r of rows) {
    const key = typeof metaOf(r).eventId === "string" ? String(metaOf(r).eventId) : LEGACY_EVENT_ID;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export async function fetchEvents(projectId: string): Promise<IdeaVoteEventWithCount[]> {
  const client = requireClient();
  const settings = await fetchSettings(projectId);
  let events: IdeaVoteEvent[] = [];

  if (await hasEventsTable()) {
    const { data, error } = await client
      .from("project_idea_events")
      .select(
        "id,project_id,created_by,title,description,closes_at,closed,anonymous,votes_per_person,max_votes_per_idea,created_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error && !isMissingRelation(error)) throw new Error(error.message);
    if (!error) events = ((data as EventDbRow[] | null) ?? []).map(mapEventRow);
  }

  const taskEvents = (await loadEventTasks(projectId))
    .map((r) => eventFromTask(r, projectId))
    .filter((x): x is IdeaVoteEvent => x !== null);
  const byId = new Set(events.map((e) => e.id));
  for (const ev of taskEvents) {
    if (!byId.has(ev.id)) events.push(ev);
  }

  const counts = await optionCountsByEvent(projectId);
  const legacyCount = counts.get(LEGACY_EVENT_ID) ?? 0;
  if (legacyCount > 0 && !events.some((e) => e.id === LEGACY_EVENT_ID)) {
    events.push({
      id: LEGACY_EVENT_ID,
      projectId,
      title: "これまでの投票",
      description: "イベント機能の前に投稿された案です。",
      createdAt: "",
      createdBy: null,
      closesAt: null,
      closed: settings.closed,
      anonymous: settings.anonymous,
      votesPerPerson: settings.votesPerPerson,
      maxVotesPerIdea: settings.maxVotesPerIdea,
    });
  }

  events.sort((a, b) => {
    if (a.id === LEGACY_EVENT_ID) return 1;
    if (b.id === LEGACY_EVENT_ID) return -1;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });

  return events.map((ev) => ({ ...ev, optionCount: counts.get(ev.id) ?? 0 }));
}

export async function createVoteEvent(projectId: string, uid: string, input: CreateVoteEventInput): Promise<IdeaVoteEvent> {
  const title = input.title.trim();
  if (!title) throw new Error("タイトルを入力してください。");
  const client = requireClient();
  const payload = {
    project_id: projectId,
    created_by: uid,
    title,
    description: (input.description ?? "").trim(),
    closes_at: input.closesAt || null,
    closed: false,
    anonymous: input.anonymous !== false,
    votes_per_person: clampLimit(input.votesPerPerson ?? 1),
    max_votes_per_idea: clampLimit(input.maxVotesPerIdea ?? 1),
  };

  if (await hasEventsTable()) {
    const { data, error } = await client
      .from("project_idea_events")
      .insert(payload)
      .select(
        "id,project_id,created_by,title,description,closes_at,closed,anonymous,votes_per_person,max_votes_per_idea,created_at",
      )
      .single();
    if (!error && data) return mapEventRow(data as EventDbRow);
    if (error && !isMissingRelation(error) && !/column/i.test(error.message)) throw new Error(error.message);
    cachedEventsTable = false;
  }

  const { data, error } = await client
    .from("project_tasks")
    .insert({
      project_id: projectId,
      title: `__event__:${title.slice(0, 160)}`,
      description: payload.description,
      status: "not_started",
      priority: "medium",
      created_by: uid,
      ai_generated: false,
      meta: {
        kind: EVENT_KIND,
        closesAt: payload.closes_at,
        closed: false,
        anonymous: payload.anonymous,
        votesPerPerson: payload.votes_per_person,
        maxVotesPerIdea: payload.max_votes_per_idea,
      },
    })
    .select("id,title,description,status,created_by,created_at,updated_at,meta")
    .single();
  if (error || !data) throw new Error(error?.message ?? "投票の作成に失敗しました。");
  const mapped = eventFromTask(data as TaskRow, projectId);
  if (!mapped) throw new Error("投票の作成に失敗しました。");
  return mapped;
}

export async function updateVoteEvent(event: IdeaVoteEvent, patch: UpdateVoteEventInput): Promise<void> {
  if (event.id === LEGACY_EVENT_ID) {
    await saveBoardSettings(event.projectId, {
      votesPerPerson: patch.votesPerPerson ?? event.votesPerPerson,
      maxVotesPerIdea: patch.maxVotesPerIdea ?? event.maxVotesPerIdea,
      closed: patch.closed ?? event.closed,
      anonymous: patch.anonymous ?? event.anonymous,
    });
    return;
  }
  const client = requireClient();
  if (await hasEventsTable()) {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) row.title = patch.title.trim();
    if (patch.description !== undefined) row.description = patch.description.trim();
    if (patch.closesAt !== undefined) row.closes_at = patch.closesAt;
    if (patch.closed !== undefined) row.closed = patch.closed;
    if (patch.anonymous !== undefined) row.anonymous = patch.anonymous;
    if (patch.votesPerPerson !== undefined) row.votes_per_person = clampLimit(patch.votesPerPerson);
    if (patch.maxVotesPerIdea !== undefined) row.max_votes_per_idea = clampLimit(patch.maxVotesPerIdea);
    const { error } = await client.from("project_idea_events").update(row).eq("id", event.id);
    if (!error) return;
    if (!isMissingRelation(error) && !/column/i.test(error.message)) throw new Error(error.message);
  }

  const existingMeta = {
    kind: EVENT_KIND,
    closesAt: patch.closesAt !== undefined ? patch.closesAt : event.closesAt,
    closed: patch.closed ?? event.closed,
    anonymous: patch.anonymous ?? event.anonymous,
    votesPerPerson: clampLimit(patch.votesPerPerson ?? event.votesPerPerson),
    maxVotesPerIdea: clampLimit(patch.maxVotesPerIdea ?? event.maxVotesPerIdea),
  };
  const title = patch.title !== undefined ? `__event__:${patch.title.trim().slice(0, 160)}` : undefined;
  const description = patch.description !== undefined ? patch.description : undefined;
  const { error } = await client
    .from("project_tasks")
    .update({
      ...(title ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      meta: existingMeta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", event.id);
  if (error) throw new Error(error.message);
}

export async function deleteVoteEvent(event: IdeaVoteEvent): Promise<void> {
  if (event.id === LEGACY_EVENT_ID) throw new Error("この投票は削除できません。");
  const client = requireClient();
  if (await hasEventsTable()) {
    const { error } = await client.from("project_idea_events").delete().eq("id", event.id);
    if (!error) return;
    if (!isMissingRelation(error)) throw new Error(error.message);
  }
  const ideas = await fetchIdeas(event.projectId, event.id);
  for (const idea of ideas) {
    await deleteIdea(idea.id);
  }
  const { error } = await client
    .from("project_tasks")
    .update({ meta: { kind: "idea_event_deleted" }, updated_at: new Date().toISOString() })
    .eq("id", event.id);
  if (error) throw new Error(error.message);
}
