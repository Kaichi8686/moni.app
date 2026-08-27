import { Resend } from "resend";

export type WeeklyReportPayload = {
  summary: string;
  good: string;
  challenge: string;
  cheer: string;
};

export async function sendWeeklyReportEmail(
  to: string,
  displayName: string,
  report: WeeklyReportPayload,
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim() || "moni <onboarding@resend.dev>";
  if (!key) return { ok: false, error: "RESEND_API_KEY が未設定です" };

  const resend = new Resend(key);
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h1 style="color:#7C3AED;font-size:20px">moni 週次レポート</h1>
      <p>${displayName} さん、おつかれさまです。</p>
      <p style="font-size:18px;font-weight:bold">${report.summary}</p>
      <p><strong>よかったこと</strong><br/>${report.good}</p>
      <p><strong>今週チャレンジ</strong><br/>${report.challenge}</p>
      <p style="color:#7C3AED">${report.cheer}</p>
      <p style="margin-top:32px;font-size:12px;color:#888">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://dream-spark-pro.vercel.app"}">moni を開く</a>
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: `【moni】週次レポート: ${report.summary}`,
    html,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
