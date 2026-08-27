import { NextResponse } from "next/server";
import { geminiChat, type GeminiChatMessage } from "@/lib/ai/geminiMessages";
import {
  IDEAS_RESPONSE_SCHEMA,
  extractJsonBlock,
  normalizeRoadmapPayload,
  parseRoadmapPayload,
  roadmapSummaryReply,
  ROADMAP_RESPONSE_SCHEMA,
  stripJsonBlock,
  systemPromptForMode,
  type GeminiAgentMode,
  type IdeasAgentPayload,
  type RoadmapAgentPayload,
} from "@/lib/ai/geminiAgents/types";

type Body = {
  mode?: GeminiAgentMode;
  messages?: GeminiChatMessage[];
  projectName?: string;
  projectDescription?: string;
  phaseSummary?: string;
  /** 課題の進捗・未完了タイトルなど（自由文） */
  issueSummary?: string;
  /** ユーザー状況ラベル（文化祭・探究など） */
  userSituationLabel?: string;
};

const MODES: GeminiAgentMode[] = ["roadmap", "general", "ideas"];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const mode = MODES.includes(body.mode as GeminiAgentMode) ? (body.mode as GeminiAgentMode) : "general";

    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.trim() }))
      .filter((m) => m.content.length > 0)
      .slice(-20);

    if (messages.length === 0) {
      return NextResponse.json({ error: "メッセージを入力してください。" }, { status: 400 });
    }

    const projectName = (body.projectName ?? "").trim().slice(0, 120);
    const projectDescription = (body.projectDescription ?? "").trim().slice(0, 800);
    const phaseSummary = (body.phaseSummary ?? "").trim().slice(0, 600);
    const issueSummary = (body.issueSummary ?? "").trim().slice(0, 1200);
    const userSituationLabel = (body.userSituationLabel ?? "").trim().slice(0, 120);

    const context = [
      projectName ? `プロジェクト名: ${projectName}` : "",
      projectDescription ? `説明: ${projectDescription}` : "",
      userSituationLabel ? `ユーザーの状況: ${userSituationLabel}` : "",
      phaseSummary ? `いまのロードマップ:\n${phaseSummary}` : "",
      issueSummary ? `課題の進捗:\n${issueSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const system = context
      ? `${systemPromptForMode(mode)}\n\n【プロジェクト情報】\n${context}`
      : systemPromptForMode(mode);

    const responseSchema =
      mode === "roadmap"
        ? (ROADMAP_RESPONSE_SCHEMA as unknown as Record<string, unknown>)
        : mode === "ideas"
          ? (IDEAS_RESPONSE_SCHEMA as unknown as Record<string, unknown>)
          : undefined;

    // 相談は一貫性重視、アイデア編はやや発散、ロードマップは構造寄り
    const temperature = mode === "general" ? 0.6 : mode === "ideas" ? 0.75 : 0.45;

    const result = await geminiChat({ system, messages, responseSchema, temperature });

    if (!result.ok) {
      if (result.code === "no_key") {
        return NextResponse.json({
          reply:
            "Gemini AI はまだ設定されていません。\n\n管理者が Google AI Studio で API キーを取得し、GEMINI_API_KEY を設定すると使えます。\nhttps://aistudio.google.com/apikey",
          source: "paused",
          mode,
        });
      }
      return NextResponse.json(
        { error: result.message },
        { status: result.code === "quota" ? 429 : 502 },
      );
    }

    let roadmap: RoadmapAgentPayload | undefined;
    let ideas: IdeasAgentPayload | undefined;

    if (mode === "roadmap") {
      try {
        roadmap = normalizeRoadmapPayload(JSON.parse(result.text)) ?? undefined;
      } catch {
        roadmap = parseRoadmapPayload(result.text) ?? undefined;
      }
    } else if (mode === "ideas") {
      ideas = extractJsonBlock<IdeasAgentPayload>(result.text) ?? undefined;
    }

    const reply =
      mode === "general"
        ? result.text.trim()
        : mode === "roadmap" && roadmap
          ? roadmapSummaryReply(roadmap)
          : stripJsonBlock(result.text) ||
            (ideas ? "アイデアを出しました。気に入ったものを投票一覧に追加できます。" : result.text.trim());

    return NextResponse.json({
      reply,
      roadmap,
      ideas,
      mode,
      source: "gemini",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AIの処理に失敗しました。" },
      { status: 500 },
    );
  }
}
