import { supabase } from "@/lib/supabase";

export type SubmitUserReportInput = {
  targetUserId: string;
  reason?: string;
  excerpt?: string;
  targetType?: string;
  targetId?: string;
};

export type SubmitUserReportResult =
  | { ok: true; emailSent?: boolean; warning?: string }
  | { ok: false; error: string; needsLogin?: boolean };

/** ログイン中ユーザーが他ユーザーを通報し、オーナーへ通知する */
export async function submitUserReport(input: SubmitUserReportInput): Promise<SubmitUserReportResult> {
  if (!supabase) return { ok: false, error: "Supabase が未設定です" };

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "ログインが必要です", needsLogin: true };

  const targetUserId = input.targetUserId.trim();
  if (!targetUserId) return { ok: false, error: "報告対象がありません" };

  const res = await fetch("/api/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      targetUserId,
      reason: input.reason,
      excerpt: input.excerpt,
      targetType: input.targetType ?? "profile",
      targetId: input.targetId ?? targetUserId,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    emailSent?: boolean;
    warning?: string;
  };

  if (!res.ok) {
    return { ok: false, error: json.error ?? "通報の送信に失敗しました" };
  }
  return { ok: true, emailSent: json.emailSent, warning: json.warning };
}
