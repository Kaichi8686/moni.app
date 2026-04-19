"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { BOOTSTRAP_FALLBACK } from "@/lib/business-seed/copy";
import { defaultRoadmapFromIdea } from "@/lib/business-seed/default-roadmap";
import type { BizSeedChatMessage, LocalBizSeedState, RoadmapDay } from "@/lib/business-seed/types";
import type { BizSeedApiMessage } from "@/app/api/business-seed/brainstorm/route";

const STORAGE_KEY = "moni-biz-seed-v1";

type Phase = "interests" | "brainstorm" | "finalizing" | "challenge";

function loadLocal(): Partial<LocalBizSeedState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<LocalBizSeedState>;
  } catch {
    return null;
  }
}

function saveLocal(state: Partial<LocalBizSeedState>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1 as const, ...state }));
}

export function BusinessSeedApp() {
  const [phase, setPhase] = useState<Phase>("interests");
  const [interests, setInterests] = useState("");
  const [messages, setMessages] = useState<BizSeedChatMessage[]>([]);
  const [stepIndex, setStepIndex] = useState(1);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [finalizedIdea, setFinalizedIdea] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapDay[] | null>(null);
  const [activeDay, setActiveDay] = useState(1);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ id: string; logDate: string; did: string; insight: string }>>([]);
  const [logDid, setLogDid] = useState("");
  const [logInsight, setLogInsight] = useState("");
  const [sessionUid, setSessionUid] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadLocal();
    if (saved?.interests) setInterests(saved.interests);
    if (saved?.messages?.length) setMessages(saved.messages as BizSeedChatMessage[]);
    if (typeof saved?.stepIndex === "number") setStepIndex(saved.stepIndex);
    if (saved?.finalizedIdea) setFinalizedIdea(saved.finalizedIdea);
    if (saved?.roadmap?.length) setRoadmap(saved.roadmap);
    if (typeof saved?.activeChallengeDay === "number") setActiveDay(saved.activeChallengeDay);
    if (saved?.projectId) setProjectId(saved.projectId);
    if (saved?.messages?.length && saved?.finalizedIdea && saved?.roadmap?.length) {
      setPhase("challenge");
    } else if (saved?.messages?.length) {
      setPhase("brainstorm");
    }
  }, []);

  useEffect(() => {
    if (!supabase || !supabaseEnabled) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSessionUid(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionUid(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const persist = useCallback(
    (patch: Partial<LocalBizSeedState>) => {
      saveLocal({
        interests,
        messages,
        stepIndex,
        finalizedIdea,
        roadmap,
        activeChallengeDay: activeDay,
        projectId,
        ...patch,
      });
    },
    [interests, messages, stepIndex, finalizedIdea, roadmap, activeDay, projectId],
  );

  useEffect(() => {
    persist({});
  }, [interests, messages, stepIndex, finalizedIdea, roadmap, activeDay, projectId, persist]);

  const syncProjectRemote = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!supabase || !sessionUid) return;
      const pid = projectId ?? crypto.randomUUID();
      if (!projectId) setProjectId(pid);
      const row = {
        id: pid,
        user_id: sessionUid,
        interests,
        brainstorm_step: stepIndex,
        messages,
        finalized_idea: finalizedIdea,
        roadmap_days: roadmap,
        active_challenge_day: activeDay,
        updated_at: new Date().toISOString(),
        ...patch,
      };
      await supabase.from("business_seed_projects").upsert(row);
    },
    [supabase, sessionUid, projectId, interests, stepIndex, messages, finalizedIdea, roadmap, activeDay],
  );

  const fetchLogs = useCallback(async () => {
    if (!supabase || !sessionUid) return;
    const { data } = await supabase
      .from("business_seed_logs")
      .select("id,log_date,did_text,insight_text")
      .eq("user_id", sessionUid)
      .order("log_date", { ascending: false })
      .limit(40);
    setLogs(
      (data ?? []).map((r) => ({
        id: r.id as string,
        logDate: r.log_date as string,
        did: r.did_text as string,
        insight: r.insight_text as string,
      })),
    );
  }, [supabase, sessionUid]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs, sessionUid]);

  const progressLabel = useMemo(() => `STEP ${stepIndex} / 5`, [stepIndex]);

  const runFinalizeAndRoadmap = useCallback(
    async (msgs: BizSeedChatMessage[]) => {
      setPhase("finalizing");
      setLoading(true);
      try {
        const finRes = await fetch("/api/business-seed/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interests, messages: msgs as BizSeedApiMessage[] }),
        });
        const finData = (await finRes.json()) as { finalizedIdea?: string };
        const idea = finData.finalizedIdea ?? "（要約に失敗）";
        setFinalizedIdea(idea);

        const roadRes = await fetch("/api/business-seed/roadmap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ finalizedIdea: idea, interests }),
        });
        const roadData = (await roadRes.json()) as { days?: RoadmapDay[] };
        const days = roadData.days?.length ? roadData.days : defaultRoadmapFromIdea(idea);
        setRoadmap(days);
        setActiveDay(1);
        setPhase("challenge");
        await syncProjectRemote({
          brainstorm_step: 7,
          finalized_idea: idea,
          roadmap_days: days,
          active_challenge_day: 1,
        });
      } finally {
        setLoading(false);
      }
    },
    [interests, syncProjectRemote],
  );

  const bootstrapChat = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/business-seed/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests, stepIndex: 1, messages: [], bootstrap: true }),
      });
      const data = (await res.json()) as { reply?: string; offline?: boolean; advance?: boolean };
      if (data.offline) {
        setMessages([{ role: "assistant", content: BOOTSTRAP_FALLBACK[1] }]);
      } else {
        setMessages([{ role: "assistant", content: data.reply ?? BOOTSTRAP_FALLBACK[1] }]);
      }
      setPhase("brainstorm");
    } finally {
      setLoading(false);
    }
  }, [interests]);

  const sendBrainstorm = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    const nextMsgs: BizSeedChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMsgs);
    setDraft("");
    setLoading(true);
    try {
      const res = await fetch("/api/business-seed/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests,
          stepIndex,
          messages: nextMsgs as BizSeedApiMessage[],
          bootstrap: false,
        }),
      });
      const data = (await res.json()) as { reply?: string; advance?: boolean; offline?: boolean; error?: string };

      if (data.error && !data.reply) {
        setMessages([...nextMsgs, { role: "assistant", content: data.error }]);
        return;
      }

      const reply = data.reply ?? "";
      const advance = Boolean(data.advance);

      if (data.offline) {
        const ok = text.trim().length >= 16;
        if (!ok) {
          setMessages([
            ...nextMsgs,
            {
              role: "assistant",
              content: "もう少しだけ具体的に書いてください（誰の・どんな場面か）。15文字以上を目安に。",
            },
          ]);
          return;
        }
        const bridge = reply ? `${reply}\n\n` : "";
        if (stepIndex >= 5) {
          const closing: BizSeedChatMessage[] = [
            ...nextMsgs,
            { role: "assistant", content: `${bridge || "OK。まとめに進みます。"}` },
          ];
          setMessages(closing);
          await runFinalizeAndRoadmap(closing);
          return;
        }
        const nextStep = stepIndex + 1;
        const intro = BOOTSTRAP_FALLBACK[nextStep] ?? "次のステップへ。";
        setStepIndex(nextStep);
        setMessages([...nextMsgs, { role: "assistant", content: `${bridge}${intro}` }]);
        return;
      }

      if (!advance) {
        setMessages([...nextMsgs, { role: "assistant", content: reply }]);
        return;
      }

      const after = [...nextMsgs, { role: "assistant", content: reply } as BizSeedChatMessage];

      if (stepIndex >= 5) {
        setMessages(after);
        await runFinalizeAndRoadmap(after);
        return;
      }

      setStepIndex(stepIndex + 1);
      setMessages(after);
    } finally {
      setLoading(false);
    }
  }, [draft, interests, messages, runFinalizeAndRoadmap, stepIndex]);

  const resetAll = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setPhase("interests");
    setMessages([]);
    setStepIndex(1);
    setFinalizedIdea(null);
    setRoadmap(null);
    setActiveDay(1);
    setDraft("");
    setProjectId(null);
  };

  const completeToday = () => {
    if (!roadmap || activeDay > 7) return;
    const next = activeDay + 1;
    setActiveDay(next);
    persist({ activeChallengeDay: next });
    void syncProjectRemote({ active_challenge_day: next });
  };

  const submitLog = async () => {
    const did = logDid.trim();
    const insight = logInsight.trim();
    if (!did && !insight) return;
    const today = new Date().toISOString().slice(0, 10);
    if (supabase && sessionUid) {
      await supabase.from("business_seed_logs").insert({
        user_id: sessionUid,
        project_id: projectId,
        log_date: today,
        did_text: did,
        insight_text: insight,
      });
      void fetchLogs();
    }
    setLogs((prev) => [
      { id: `local-${Date.now()}`, logDate: today, did, insight },
      ...prev.filter((x) => x.id !== "preview"),
    ]);
    setLogDid("");
    setLogInsight("");
  };

  const todayTask = roadmap && activeDay >= 1 && activeDay <= 7 ? roadmap[activeDay - 1]?.task : null;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-zinc-50 to-zinc-100 pb-24 text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold text-sky-700 hover:underline">
            ← moni へ
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">7日チャレンジ</span>
          <button type="button" className="text-xs text-zinc-500 underline decoration-zinc-300" onClick={resetAll}>
            最初から
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-6">
        {!sessionUid ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
            ログインすると行動ログがクラウドに保存されます。未ログインでもこの端末内では進められます。
          </p>
        ) : null}

        {phase === "interests" ? (
          <section className="space-y-4">
            <h1 className="text-xl font-bold leading-snug">7日でビジネスの「種」をつくる</h1>
            <p className="text-sm leading-relaxed text-zinc-600">
              まずはあなたの興味・関心を書いてください（例：地域のカフェ / 中学生のバイト / アプリ開発）。
            </p>
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none ring-zinc-900/5 focus:border-sky-500 focus:ring-2"
              placeholder="気になることを自由に…"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
            />
            <button
              type="button"
              disabled={interests.trim().length < 2 || loading}
              className="min-h-[48px] w-full rounded-2xl bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-40"
              onClick={() => void bootstrapChat()}
            >
              {loading ? "準備中…" : "壁打ちを始める（約3分）"}
            </button>
          </section>
        ) : null}

        {phase === "brainstorm" ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-sky-700">{progressLabel}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-sky-600 transition-all"
                  style={{ width: `${(stepIndex / 5) * 100}%` }}
                />
              </div>
            </div>
            <div className="max-h-[48vh] space-y-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              {messages.map((m, i) => (
                <div key={`${i}-${m.role}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"
                    }`}
                  >
                    <span className="block whitespace-pre-wrap">{m.content}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                className="min-h-[52px] flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                placeholder="回答を入力…"
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendBrainstorm();
                  }
                }}
              />
              <button
                type="button"
                disabled={loading || !draft.trim()}
                className="min-w-[72px] rounded-2xl bg-zinc-900 px-3 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => void sendBrainstorm()}
              >
                送信
              </button>
            </div>
          </section>
        ) : null}

        {phase === "finalizing" ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" aria-hidden />
            <p className="text-sm font-medium text-zinc-700">アイデアをまとめて、7日プランを生成しています…</p>
          </div>
        ) : null}

        {phase === "challenge" && roadmap ? (
          <section className="space-y-8">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">ビジネスの種（要約）</p>
              <p className="mt-2 text-sm leading-relaxed text-emerald-950">{finalizedIdea}</p>
            </div>

            <div>
              <h2 className="text-sm font-bold text-zinc-900">7日ロードマップ</h2>
              <ol className="mt-3 space-y-2">
                {roadmap.map((d) => (
                  <li
                    key={d.day}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      d.day === activeDay
                        ? "border-sky-400 bg-sky-50"
                        : d.day < activeDay
                          ? "border-zinc-100 bg-zinc-50 opacity-70"
                          : "border-zinc-200 bg-white"
                    }`}
                  >
                    <span className="font-semibold text-zinc-900">
                      Day{d.day} · {d.title}
                    </span>
                    <p className="mt-1 text-xs text-zinc-600">{d.detail}</p>
                  </li>
                ))}
              </ol>
            </div>

            {activeDay <= 7 ? (
              <div className="rounded-2xl border-2 border-zinc-900 bg-white p-4 shadow-md">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">今日やること</p>
                <p className="mt-2 text-base font-semibold leading-snug text-zinc-900">{todayTask}</p>
                <button
                  type="button"
                  className="mt-4 w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
                  onClick={completeToday}
                >
                  完了した（次の日へ）
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-center text-sm font-medium text-sky-950">
                7日間おつかれさま！振り返りログを残して、次の挑戦へつなげよう。
              </div>
            )}

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900">行動ログ</h3>
              <p className="mt-1 text-xs text-zinc-500">やったこと・気づきを短く残す（後から一覧で見られる）</p>
              <input
                className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                placeholder="やったこと"
                value={logDid}
                onChange={(e) => setLogDid(e.target.value)}
              />
              <textarea
                className="mt-2 min-h-[72px] w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                placeholder="気づき・次の一手"
                value={logInsight}
                onChange={(e) => setLogInsight(e.target.value)}
              />
              <button
                type="button"
                className="mt-3 w-full rounded-xl border border-zinc-300 bg-zinc-50 py-2.5 text-sm font-semibold text-zinc-900"
                onClick={() => void submitLog()}
              >
                ログを追加
              </button>
              <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-3">
                {logs.length === 0 ? <li className="text-xs text-zinc-400">まだログがありません</li> : null}
                {logs.map((l) => (
                  <li key={l.id} className="rounded-lg bg-zinc-50 px-2 py-2 text-xs">
                    <span className="font-mono text-zinc-500">{l.logDate}</span>
                    {l.did ? <p className="mt-1 text-zinc-800">{l.did}</p> : null}
                    {l.insight ? <p className="mt-1 text-zinc-600">{l.insight}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
