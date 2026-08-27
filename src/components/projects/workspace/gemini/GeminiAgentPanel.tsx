"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type {
  GeminiAgentMode,
  IdeasAgentPayload,
  RoadmapAgentPayload,
} from "@/lib/ai/geminiAgents/types";
import { GEMINI_AGENT_META, parseRoadmapPayload } from "@/lib/ai/geminiAgents/types";
import { appendIdeasToVoting } from "@/lib/projects/ideaVoting/appendIdeas";
import { applyAgentRoadmapToProject, type ApplyRoadmapMode } from "@/lib/projects/applyAgentRoadmap";
import { useI18n } from "@/lib/i18n/I18nProvider";

type ChatMessage = { role: "user" | "assistant"; content: string };

function chatStorageKey(projectId: string, mode: GeminiAgentMode) {
  return `moni-gemini-chat:${projectId}:${mode}`;
}

function loadStoredChat(projectId: string, mode: GeminiAgentMode): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(chatStorageKey(projectId, mode));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-80);
  } catch {
    return [];
  }
}

function saveStoredChat(projectId: string, mode: GeminiAgentMode, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(chatStorageKey(projectId, mode), JSON.stringify(messages.slice(-80)));
  } catch {
    /* ignore */
  }
}

type Props = {
  mode: GeminiAgentMode;
  projectId: string;
  projectName: string;
  projectDescription?: string;
  phaseSummary: string;
  issueSummary?: string;
  userSituationLabel?: string;
  phasesCount: number;
  canEdit: boolean;
  onReload: () => Promise<void>;
  /** Prefill draft / seed first user message (e.g. idea-interview handoff) */
  initialUserMessage?: string;
};

export function GeminiAgentPanel({
  mode,
  projectId,
  projectName,
  projectDescription,
  phaseSummary,
  issueSummary,
  userSituationLabel,
  phasesCount,
  canEdit,
  onReload,
  initialUserMessage,
}: Props) {
  const { tx } = useI18n();
  const router = useRouter();
  const meta = GEMINI_AGENT_META[mode];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roadmap, setRoadmap] = useState<RoadmapAgentPayload | null>(null);
  const [ideas, setIdeas] = useState<IdeasAgentPayload | null>(null);
  const [applyMode, setApplyMode] = useState<ApplyRoadmapMode>("append");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = loadStoredChat(projectId, mode);
    if (initialUserMessage?.trim()) {
      const seed =
        initialUserMessage.split("\n").find((l) => l.startsWith("選んだ種:"))?.replace("選んだ種: ", "") ??
        tx("このアイデア", "this idea");
      setMessages([...stored, { role: "user", content: initialUserMessage.trim() }]);
      setDraft(
        tx(
          `「${seed}」を深掘りしたいです。次の一手を提案してください。`,
          `I want to go deeper on “${seed}”. Suggest a next small step.`,
        ),
      );
    } else {
      setMessages(stored);
      setDraft("");
    }
    setRoadmap(null);
    setIdeas(null);
    setError("");
    setApplied(false);
    setApplyMode(phasesCount > 0 ? "append" : "replace");
  }, [mode, projectId, phasesCount, initialUserMessage, tx]);

  useEffect(() => {
    if (messages.length === 0) return;
    saveStoredChat(projectId, mode, messages);
  }, [messages, projectId, mode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, roadmap, ideas]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setError("");
      setDraft("");
      setApplied(false);
      const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      setLoading(true);
      setRoadmap(null);
      setIdeas(null);

      try {
        const res = await fetch("/api/projects/gemini", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode,
            messages: next,
            projectName,
            projectDescription,
            phaseSummary,
            issueSummary,
            userSituationLabel,
          }),
        });
        const json = (await res.json()) as {
          reply?: string;
          roadmap?: RoadmapAgentPayload;
          ideas?: IdeasAgentPayload;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? tx("送信に失敗しました", "Failed to send"));

        const replyText = json.reply?.trim() || "…";
        setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);

        if (json.roadmap?.phases?.length) {
          setRoadmap(json.roadmap);
        } else if (mode === "roadmap") {
          const parsed = parseRoadmapPayload(replyText);
          if (parsed) setRoadmap(parsed);
        }
        if (json.ideas) setIdeas(json.ideas);
      } catch (e) {
        setError(e instanceof Error ? e.message : tx("送信に失敗しました", "Failed to send"));
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, mode, phaseSummary, issueSummary, userSituationLabel, projectDescription, projectName, tx],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await send(draft);
  }

  async function applyRoadmap() {
    if (!roadmap || !canEdit) return;
    setApplying(true);
    setError("");
    try {
      const r = await applyAgentRoadmapToProject(projectId, roadmap, { mode: applyMode });
      setApplied(true);
      setRoadmap(null);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `ロードマップに反映しました（フェーズ${r.phasesCreated}・やること${r.issuesCreated}件）。ロードマップ画面で確認できます。`,
        },
      ]);
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("反映に失敗しました", "Failed to apply"));
    } finally {
      setApplying(false);
    }
  }

  async function addIdeasToVote() {
    if (!ideas?.ideas?.length) return;
    try {
      const n = await appendIdeasToVoting(projectId, ideas.ideas);
      setIdeas(null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `投票に ${n} 件追加しました。「投票」画面で確認できます。` },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("投票への追加に失敗しました", "Failed to add to voting"));
    }
  }

  return (
    <div className="flex min-h-[420px] flex-col rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="border-b border-[#F3F4F6] px-4 py-3">
        <p className="text-[14px] font-bold text-[#1A1A1A]">
          {tx(meta.label, mode === "roadmap" ? "Roadmap" : mode === "general" ? "Ask anything" : "Ideas")}
        </p>
        <p className="mt-0.5 text-[12px] text-[#6B7280]">
          {tx(
            meta.desc,
            mode === "roadmap"
              ? "Break work into phases and plan"
              : mode === "general"
                ? "Stuck points, chat, questions — anything"
                : "Generate lots of project ideas",
          )}{" "}
          · Google Gemini
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="rounded-lg bg-[#FAFAFA] px-3 py-4 text-[13px] leading-relaxed text-[#6B7280]">
            {mode === "roadmap" &&
              tx(
                "「〇〇の計画を作って」と送ると、ロードマップ案が出ます。反映ボタンで保存できます。",
                "Send “make a plan for …” and you’ll get a roadmap draft. Use Apply to save it.",
              )}
            {mode === "general" && tx("困っていることや質問を、そのまま送ってください。", "Send whatever you’re stuck on or curious about.")}
            {mode === "ideas" && tx("「アイデアを10個出して」と送ると、案のリストが出ます。", "Send “give me 10 ideas” and you’ll get a list.")}
          </p>
        ) : null}

        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap ${
              m.role === "user" ? "ml-auto bg-violet-600 text-white" : "bg-[#F3F4F6] text-[#1A1A1A]"
            }`}
          >
            {m.content}
          </div>
        ))}

        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tx("考え中…", "Thinking…")}
          </div>
        ) : null}

        {roadmap ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[13px]">
            <p className="font-bold text-emerald-900">
              {tx(`計画案（${roadmap.phases.length}段階）`, `Draft plan (${roadmap.phases.length} phases)`)}
            </p>
            <ol className="mt-2 space-y-2">
              {roadmap.phases.map((p, i) => (
                <li key={i} className="rounded-lg bg-white/90 px-2 py-1.5">
                  <span className="font-semibold">
                    {i + 1}. {p.phase_name}
                  </span>
                  {p.tasks?.length ? (
                    <ul className="mt-1 text-[12px] text-emerald-900">
                      {p.tasks.map((t, ti) => (
                        <li key={ti}>・ {t.task_title}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
            {canEdit ? (
              <>
                {phasesCount > 0 ? (
                  <div className="mt-3 space-y-2 text-[12px]">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="apply-mode"
                        checked={applyMode === "append"}
                        onChange={() => setApplyMode("append")}
                      />
                      {tx("いまのロードマップの後ろに追加", "Append after the current roadmap")}
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="apply-mode"
                        checked={applyMode === "replace"}
                        onChange={() => setApplyMode("replace")}
                      />
                      {tx("いまのロードマップを消して入れ替え", "Replace the current roadmap")}
                    </label>
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={applying}
                  onClick={() => void applyRoadmap()}
                  className="mt-3 min-h-[48px] w-full rounded-xl bg-emerald-600 font-bold text-white disabled:opacity-50"
                >
                  {applying ? tx("反映中…", "Applying…") : tx("ロードマップに反映する", "Apply to roadmap")}
                </button>
              </>
            ) : (
              <p className="mt-2 text-[12px] text-emerald-800">{tx("編集権限があるメンバーだけ反映できます。", "Only members with edit access can apply this.")}</p>
            )}
          </div>
        ) : null}

        {applied ? (
          <button
            type="button"
            onClick={() => router.push(`/projects/${projectId}/roadmap`)}
            className="min-h-[48px] w-full rounded-xl border border-emerald-300 bg-white font-bold text-emerald-800"
          >
            {tx("ロードマップ画面を開く →", "Open roadmap →")}
          </button>
        ) : null}

        {ideas?.ideas?.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px]">
            <p className="font-bold text-amber-900">{tx(`アイデア ${ideas.ideas.length} 件`, `${ideas.ideas.length} ideas`)}</p>
            <ul className="mt-2 space-y-2">
              {ideas.ideas.map((idea, i) => (
                <li key={i} className="rounded-lg bg-white/90 px-2 py-1.5">
                  <p className="font-semibold">{idea.title}</p>
                  {idea.pitch ? <p className="text-[12px] text-amber-900">{idea.pitch}</p> : null}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void addIdeasToVote()}
              className="mt-2 min-h-[44px] w-full rounded-xl bg-amber-500 font-bold text-white"
            >
              {tx("投票に追加する", "Add to voting")}
            </button>
          </div>
        ) : null}

        {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="border-t border-[#E5E7EB] p-3">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={loading}
            placeholder={tx(
              meta.placeholder,
              mode === "roadmap"
                ? "e.g. Make a 3-month plan to ship an MVP"
                : mode === "general"
                  ? "e.g. The team can’t agree"
                  : "e.g. 10 feature ideas users would love",
            )}
            className="min-h-[48px] flex-1 rounded-xl border border-[#E5E7EB] px-3 text-[15px] outline-none ring-violet-300 focus:ring-2"
          />
          <button
            type="submit"
            disabled={loading || !draft.trim()}
            className="min-h-[48px] shrink-0 rounded-xl bg-violet-600 px-4 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {tx("送信", "Send")}
          </button>
        </div>
      </form>
    </div>
  );
}
