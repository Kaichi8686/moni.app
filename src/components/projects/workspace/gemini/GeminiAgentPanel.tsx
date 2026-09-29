"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, Lightbulb, Loader2, MessageCircle, MessageSquarePlus, X } from "lucide-react";
import type {
  GeminiAgentMode,
  IdeasAgentPayload,
  RoadmapAgentPayload,
} from "@/lib/ai/geminiAgents/types";
import { GEMINI_AGENT_META, parseRoadmapPayload } from "@/lib/ai/geminiAgents/types";
import {
  conversationFromLegacyMessages,
  loadConversationStore,
  newAiId,
  saveConversationStore,
  upsertActiveConversation,
  type AiChatMessage,
  type AiSavedConversation,
} from "@/lib/ai/chatConversations";
import { appendIdeasToVoting } from "@/lib/projects/ideaVoting/appendIdeas";
import { applyAgentRoadmapToProject, type ApplyRoadmapMode } from "@/lib/projects/applyAgentRoadmap";
import { AiChatHistoryRail } from "@/components/ai/AiChatHistoryRail";
import { AiChatStreamingRichText } from "@/components/ai/AiChatStreamingRichText";
import { useI18n } from "@/lib/i18n/I18nProvider";

function conversationsKey(projectId: string, mode: GeminiAgentMode) {
  return `moni-gemini-conversations.v1:${projectId}:${mode}`;
}

function legacyChatKey(projectId: string, mode: GeminiAgentMode) {
  return `moni-gemini-chat:${projectId}:${mode}`;
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
  /** fullscreen = ChatGPT-like full viewport (coach page) */
  variant?: "card" | "fullscreen";
  backHref?: string;
  /** Switch between 相談 / アイデア (general | ideas) */
  onModeChange?: (mode: "general" | "ideas") => void;
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
  variant = "card",
  backHref,
  onModeChange,
}: Props) {
  const { tx, locale } = useI18n();
  const router = useRouter();
  const meta = GEMINI_AGENT_META[mode];
  const newTitle = tx("新しいチャット", "New chat");

  const [conversations, setConversations] = useState<AiSavedConversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roadmap, setRoadmap] = useState<RoadmapAgentPayload | null>(null);
  const [ideas, setIdeas] = useState<IdeasAgentPayload | null>(null);
  const [applyMode, setApplyMode] = useState<ApplyRoadmapMode>("append");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const handoffAppliedRef = useRef(false);

  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const resetPanels = useCallback(() => {
    setRoadmap(null);
    setIdeas(null);
    setError("");
    setApplied(false);
    setStreamingId(null);
    setApplyMode(phasesCount > 0 ? "append" : "replace");
  }, [phasesCount]);

  useEffect(() => {
    setHydrated(false);
    handoffAppliedRef.current = false;
    const storeKey = conversationsKey(projectId, mode);
    const existing = loadConversationStore(storeKey);
    if (existing) {
      setConversations(existing.conversations);
      setActiveId(existing.activeId);
      const active = existing.conversations.find((c) => c.id === existing.activeId) ?? existing.conversations[0]!;
      setMessages(active.messages);
    } else {
      const migrated = conversationFromLegacyMessages(legacyChatKey(projectId, mode), newTitle);
      if (migrated) {
        setConversations([migrated]);
        setActiveId(migrated.id);
        setMessages(migrated.messages);
        saveConversationStore(storeKey, { activeId: migrated.id, conversations: [migrated] });
        try {
          window.localStorage.removeItem(legacyChatKey(projectId, mode));
        } catch {
          /* ignore */
        }
      } else {
        const id = newAiId("gemini");
        setConversations([{ id, title: newTitle, updatedAt: new Date().toISOString(), messages: [] }]);
        setActiveId(id);
        setMessages([]);
      }
    }
    setDraft("");
    resetPanels();
    setHistoryOpen(false);
    setHydrated(true);
  }, [mode, projectId, newTitle, resetPanels]);

  useEffect(() => {
    if (!hydrated || !initialUserMessage?.trim() || handoffAppliedRef.current) return;
    handoffAppliedRef.current = true;
    const seed =
      initialUserMessage.split("\n").find((l) => l.startsWith("選んだ種:"))?.replace("選んだ種: ", "") ??
      tx("このアイデア", "this idea");
    const handoffMsg: AiChatMessage = {
      id: newAiId("u"),
      role: "user",
      content: initialUserMessage.trim(),
    };
    setMessages((prev) => [...prev, handoffMsg]);
    setDraft(
      tx(
        `「${seed}」を深掘りしたいです。次の一手を提案してください。`,
        `I want to go deeper on “${seed}”. Suggest a next small step.`,
      ),
    );
  }, [hydrated, initialUserMessage, tx]);

  useEffect(() => {
    if (!hydrated || !activeId) return;
    setConversations((prev) => upsertActiveConversation(prev, activeId, messages, newTitle));
  }, [messages, activeId, hydrated, newTitle]);

  useEffect(() => {
    if (!hydrated || !activeId) return;
    saveConversationStore(conversationsKey(projectId, mode), {
      activeId,
      conversations,
    });
  }, [activeId, conversations, hydrated, mode, projectId]);

  useEffect(() => {
    scrollToEnd();
  }, [messages, loading, roadmap, ideas, scrollToEnd]);

  function startNewChat() {
    if (!messages.some((m) => m.role === "user") && messages.length === 0) {
      setDraft("");
      resetPanels();
      setHistoryOpen(false);
      return;
    }
    const id = newAiId("gemini");
    const next: AiSavedConversation = {
      id,
      title: newTitle,
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    setConversations((prev) => [next, ...prev].slice(0, 30));
    setActiveId(id);
    setMessages([]);
    setDraft("");
    resetPanels();
    setHistoryOpen(false);
  }

  function openConversation(conversation: AiSavedConversation) {
    setActiveId(conversation.id);
    setMessages(conversation.messages);
    setDraft("");
    resetPanels();
    setHistoryOpen(false);
  }

  function deleteConversation(conversationId: string) {
    const remaining = conversations.filter((c) => c.id !== conversationId);
    if (conversationId !== activeId) {
      setConversations(remaining);
      return;
    }
    if (remaining[0]) {
      setConversations(remaining);
      setActiveId(remaining[0].id);
      setMessages(remaining[0].messages);
      resetPanels();
      return;
    }
    const id = newAiId("gemini");
    setConversations([{ id, title: newTitle, updatedAt: new Date().toISOString(), messages: [] }]);
    setActiveId(id);
    setMessages([]);
    resetPanels();
  }

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setError("");
      setDraft("");
      setApplied(false);
      const userMsg: AiChatMessage = { id: newAiId("u"), role: "user", content: trimmed };
      const next: AiChatMessage[] = [...messages, userMsg];
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
            messages: next.map(({ role, content }) => ({ role, content })),
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
        const assistantId = newAiId("a");
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: replyText }]);
        setStreamingId(assistantId);

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
      const assistantId = newAiId("a");
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: `ロードマップに反映しました（フェーズ${r.phasesCreated}・やること${r.issuesCreated}件）。ロードマップ画面で確認できます。`,
        },
      ]);
      setStreamingId(assistantId);
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
      const assistantId = newAiId("a");
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: `投票に ${n} 件追加しました。「投票」画面で確認できます。` },
      ]);
      setStreamingId(assistantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("投票への追加に失敗しました", "Failed to add to voting"));
    }
  }

  const historyRail = (
    <AiChatHistoryRail
      conversations={conversations}
      activeId={activeId}
      onSelect={openConversation}
      onNew={startNewChat}
      onDelete={deleteConversation}
      locale={locale === "en" ? "en-US" : "ja-JP"}
      title={tx("チャット履歴", "Chat history")}
      newLabel={newTitle}
      emptyLabel={tx("まだ会話がありません", "No chats yet")}
      className="h-full"
    />
  );

  const fullscreen = variant === "fullscreen";
  const activeTitle = conversations.find((c) => c.id === activeId)?.title || newTitle;

  return (
    <div
      className={
        fullscreen
          ? "flex h-full min-h-0 w-full overflow-hidden bg-white"
          : "flex min-h-[520px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm"
      }
    >
      <div
        className={`hidden shrink-0 border-r border-[#E5E7EB] md:block ${fullscreen ? "w-[260px]" : "w-[240px]"}`}
      >
        {historyRail}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 shrink-0 border-b border-[#F3F4F6] bg-white/95 px-3 py-2.5 backdrop-blur sm:px-4">
          <div className="flex items-center gap-2">
            {fullscreen && backHref ? (
              <Link
                href={backHref}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#374151] transition hover:bg-[#F3F4F6]"
                aria-label={tx("プロジェクトに戻る", "Back to project")}
              >
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </Link>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-[#1A1A1A]">
                {fullscreen
                  ? "AI"
                  : tx(meta.label, mode === "roadmap" ? "Roadmap" : mode === "general" ? "Ask anything" : "Ideas")}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[12px] text-[#6B7280]">
                {fullscreen
                  ? `${mode === "ideas" ? tx("アイデア", "Ideas") : tx("相談", "Chat")} · ${activeTitle}`
                  : activeTitle}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E5E7EB] px-2.5 text-[12px] font-semibold text-[#374151] md:hidden"
              >
                <History className="h-3.5 w-3.5" aria-hidden />
                {tx("履歴", "History")}
              </button>
              <button
                type="button"
                onClick={startNewChat}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] font-semibold text-[#374151] hover:bg-[#F9FAFB]"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                {tx("新規", "New")}
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 px-2 py-6">
              {onModeChange && (mode === "general" || mode === "ideas") ? (
                <div className="grid w-full max-w-md grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onModeChange("general")}
                    className={`flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center transition ${
                      mode === "general"
                        ? "border-violet-300 bg-violet-50 text-violet-900"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-violet-200"
                    }`}
                  >
                    <MessageCircle className="h-6 w-6" aria-hidden />
                    <span className="text-[15px] font-bold">{tx("相談", "Chat")}</span>
                    <span className="text-[11px] leading-snug opacity-80">
                      {tx("困りごと・次の一手", "Stuck points & next steps")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onModeChange("ideas")}
                    className={`flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center transition ${
                      mode === "ideas"
                        ? "border-violet-300 bg-violet-50 text-violet-900"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-violet-200"
                    }`}
                  >
                    <Lightbulb className="h-6 w-6" aria-hidden />
                    <span className="text-[15px] font-bold">{tx("アイデア", "Ideas")}</span>
                    <span className="text-[11px] leading-snug opacity-80">
                      {tx("企画の案をたくさん出す", "Brainstorm many ideas")}
                    </span>
                  </button>
                </div>
              ) : null}
              <p className="max-w-md text-center text-[13px] leading-relaxed text-[#6B7280]">
                {mode === "roadmap" &&
                  tx(
                    "「〇〇の計画を作って」と送ると、ロードマップ案が出ます。反映ボタンで保存できます。",
                    "Send “make a plan for …” and you’ll get a roadmap draft. Use Apply to save it.",
                  )}
                {mode === "general" &&
                  tx(
                    "困っていることや質問を、そのまま送ってください。会話は自動保存され、履歴からいつでも続けられます。",
                    "Send whatever you’re stuck on. Chats are saved automatically — continue anytime from History.",
                  )}
                {mode === "ideas" &&
                  tx(
                    "「アイデアを出して」と送ると、方向性を太字・絵文字で伝えてから案のリストが出ます。会話は自動保存されます。",
                    "Send “give me ideas” — I’ll outline the direction with bold and emojis, then list options. Chats are saved automatically.",
                  )}
              </p>
            </div>
          ) : null}

          {messages.map((m, i) => (
            <div
              key={m.id ?? `${m.role}-${i}`}
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-[14px] leading-relaxed ${
                m.role === "user" ? "ml-auto bg-violet-600 text-white" : "bg-[#F3F4F6] text-[#1A1A1A]"
              }`}
            >
              {m.role === "assistant" ? (
                <AiChatStreamingRichText
                  text={m.content}
                  className="break-words"
                  animate={Boolean(m.id && m.id === streamingId)}
                  onTick={scrollToEnd}
                  onComplete={() => setStreamingId((cur) => (cur === m.id ? null : cur))}
                />
              ) : (
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              )}
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
                <p className="mt-2 text-[12px] text-emerald-800">
                  {tx("編集権限があるメンバーだけ反映できます。", "Only members with edit access can apply this.")}
                </p>
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

          {ideas?.ideas?.length && !streamingId ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px]">
              <p className="font-bold text-amber-900">
                {tx(`💡 アイデア ${ideas.ideas.length} 件`, `💡 ${ideas.ideas.length} ideas`)}
              </p>
              <ul className="mt-2 space-y-2">
                {ideas.ideas.map((idea, i) => (
                  <li key={i} className="rounded-lg bg-white/90 px-2 py-1.5">
                    <p className="font-semibold">{idea.title}</p>
                    {idea.pitch ? <p className="text-[12px] text-amber-900">{idea.pitch}</p> : null}
                    {idea.first_step ? (
                      <p className="mt-0.5 text-[11px] text-amber-800/90">
                        {tx("最初の一歩: ", "First step: ")}
                        {idea.first_step}
                      </p>
                    ) : null}
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

        <form onSubmit={(e) => void onSubmit(e)} className="shrink-0 border-t border-[#E5E7EB] bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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

      {historyOpen ? (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={tx("チャット履歴", "Chat history")}
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="flex h-full w-[min(100%,320px)] flex-col bg-[#f7f7f8] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-3 py-2">
              <p className="text-sm font-semibold text-[#111827]">{tx("チャット履歴", "Chat history")}</p>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#6b7280] hover:bg-white"
                aria-label={tx("閉じる", "Close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{historyRail}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
