/**
 * Server-only: Anthropic Messages API（プロジェクトコーチ用）
 */

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

export type AnthropicTextResult =
  | { ok: true; text: string }
  | { ok: false; code: "no_key" | "bad_response" | "api_error"; message: string };

export async function anthropicTextMessage(params: {
  system?: string;
  user: string;
  maxTokens?: number;
  model?: string;
  temperature?: number;
}): Promise<AnthropicTextResult> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return { ok: false, code: "no_key", message: "ANTHROPIC_API_KEY が未設定です。" };
  }

  const model = params.model?.trim() || process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
  const max_tokens = Math.min(Math.max(params.maxTokens ?? 900, 64), 4096);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        max_tokens,
        ...(typeof params.temperature === "number" ? { temperature: params.temperature } : {}),
        ...(params.system ? { system: params.system } : {}),
        messages: [{ role: "user", content: params.user }],
      }),
    });

    const json = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string; type?: string };
    };

    if (!res.ok) {
      const detail = json.error?.message ?? res.statusText;
      return { ok: false, code: "api_error", message: detail };
    }

    const block = json.content?.find((c) => c.type === "text" && typeof c.text === "string");
    const text = block?.text?.trim();
    if (!text) {
      return { ok: false, code: "bad_response", message: "空の応答でした。" };
    }

    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "api_error", message: msg };
  }
}
