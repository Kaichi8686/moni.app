import { Resend } from "resend";

export const REPORT_OWNER_EMAIL = "kigyouman@gmail.com";

export type UserReportEmailPayload = {
  reportedUserId: string;
  reportedDisplayName: string;
  reportedEmail?: string | null;
  reporterUserId: string;
  reporterDisplayName: string;
  reporterEmail?: string | null;
  reason: string;
  excerpt?: string;
  targetType?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** ユーザー通報をアプリオーナーへメール通知する */
export async function sendUserReportEmail(
  payload: UserReportEmailPayload,
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim() || "moni <onboarding@resend.dev>";
  const to = process.env.REPORT_OWNER_EMAIL?.trim() || REPORT_OWNER_EMAIL;
  if (!key) return { ok: false, error: "RESEND_API_KEY が未設定です" };

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://dream-spark-pro.vercel.app";
  const profileUrl = `${site.replace(/\/$/, "")}/profile/${payload.reportedUserId}`;
  const reportedName = escapeHtml(payload.reportedDisplayName);
  const reporterName = escapeHtml(payload.reporterDisplayName);
  const reason = escapeHtml(payload.reason);
  const excerpt = payload.excerpt ? escapeHtml(payload.excerpt) : "";

  const resend = new Resend(key);
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b">
      <h1 style="font-size:18px;margin:0 0 16px">moni ユーザー通報</h1>
      <p style="margin:0 0 12px">アプリ内でユーザー報告がありました。</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:8px 0;color:#71717a;width:120px">報告された人</td>
          <td style="padding:8px 0">
            <strong>${reportedName}</strong><br/>
            ID: ${escapeHtml(payload.reportedUserId)}
            ${payload.reportedEmail ? `<br/>Email: ${escapeHtml(payload.reportedEmail)}` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a">報告した人</td>
          <td style="padding:8px 0">
            ${reporterName}<br/>
            ID: ${escapeHtml(payload.reporterUserId)}
            ${payload.reporterEmail ? `<br/>Email: ${escapeHtml(payload.reporterEmail)}` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#71717a">理由</td>
          <td style="padding:8px 0">${reason}</td>
        </tr>
        ${
          excerpt
            ? `<tr><td style="padding:8px 0;color:#71717a">抜粋</td><td style="padding:8px 0">${excerpt}</td></tr>`
            : ""
        }
      </table>
      <p style="margin:20px 0 0;font-size:13px">
        <a href="${escapeHtml(profileUrl)}">報告されたユーザーのプロフィールを開く</a>
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: `【moni】ユーザー通報: ${payload.reportedDisplayName}`,
    html,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
