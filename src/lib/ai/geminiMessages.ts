/**
 * Google AI Studio / Gemini API（サーバー専用）
 * REST + x-goog-api-key（AIza / AQ. 両対応）
 */

/** 2.0-flash は無料枠0のアカウントあり → 2.5 を優先 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

const FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-3-flash-preview"] as const;

export type GeminiChatMessage = { role: "user" | "assistant"; content: string };

export type GeminiTextResult =
  | { ok: true; text: string }
  | { ok: false; code: "no_key" | "bad_response" | "quota" | "api_error"; message: string };

type GeminiApiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { code?: number; message?: string; status?: string };
};

export function friendlyGeminiError(raw: string): { code: "quota" | "api_error"; message: string } {
  const lower = raw.toLowerCase();
  if (
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota exceeded") ||
    lower.includes("exceeded your current quota")
  ) {
    return {
      code: "quota",
      message:
        "Gemini の利用上限に達しています。\n\n" +
        "・数分あとにもう一度試す\n" +
        "・Google AI Studio（https://aistudio.google.com/apikey）で別プロジェクトのキーを作る\n\n" +
        "キーは設定できていますが、Google 側の無料枠が足りない状態です。",
    };
  }
  if (lower.includes("403") || lower.includes("permission_denied") || lower.includes("api key not valid")) {
    return {
      code: "api_error",
      message: "APIキーが無効です。Google AI Studio でキーをコピーし直してください。",
    };
  }
  return { code: "api_error", message: "AIの応答に失敗しました。しばらくしてからもう一度お試しください。" };
}

async function callGeminiRest(
  key: string,
  model: string,
  params: {
    system: string;
    messages: GeminiChatMessage[];
    temperature?: number;
    responseSchema?: Record<string, unknown>;
  },
): Promise<GeminiTextResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const contents = params.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const generationConfig: Record<string, unknown> = {
    temperature: params.temperature ?? 0.7,
    maxOutputTokens: 4096,
  };
  if (params.responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = params.responseSchema;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": key,
    },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.system }] },
      contents,
      generationConfig,
    }),
  });

  const json = (await res.json()) as GeminiApiResponse;
  if (!res.ok || json.error) {
    const raw = JSON.stringify(json.error ?? { message: res.statusText, code: res.status });
    const friendly = friendlyGeminiError(raw);
    return { ok: false, code: friendly.code, message: friendly.message };
  }

  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) {
    return { ok: false, code: "bad_response", message: "AIからの応答が空でした。" };
  }
  return { ok: true, text };
}

export async function geminiChat(params: {
  system: string;
  messages: GeminiChatMessage[];
  model?: string;
  temperature?: number;
  responseSchema?: Record<string, unknown>;
}): Promise<GeminiTextResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return { ok: false, code: "no_key", message: "GEMINI_API_KEY が未設定です。" };
  }

  const primary = params.model?.trim() || process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const models = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];

  let lastMessage = "";
  for (const model of models) {
    try {
      const result = await callGeminiRest(key, model, params);
      if (result.ok) return result;
      lastMessage = result.message;
      if (result.code === "quota") continue;
      return result;
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e);
    }
  }

  const friendly = friendlyGeminiError(lastMessage);
  return { ok: false, code: friendly.code, message: friendly.message };
}
