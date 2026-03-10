import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "onboarding@resend.dev";

export async function sendInviteEmail({
  to,
  sessionName,
  inviteUrl,
}: {
  to: string;
  sessionName: string;
  inviteUrl: string;
}) {
  const subject = `You're invited to find a time — ${sessionName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #d4d4d4;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(180deg,#6CB4F7 0%,#4A9BF5 100%);padding:20px 24px;text-align:center;">
              <span style="font-size:18px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.2);">
                Sometime.Chat
              </span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#1a1a1a;">
                ${escapeHtml(sessionName)}
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.5;">
                Someone invited you to share your availability so you can all find a time that works.
              </p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:linear-gradient(180deg,#6CB4F7 0%,#3D8CE8 100%);color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px;text-shadow:0 -1px 0 rgba(0,0,0,0.15);box-shadow:0 1px 3px rgba(0,0,0,0.15),inset 0 1px 0 rgba(255,255,255,0.25);">
                      Add Your Availability
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#999;line-height:1.5;text-align:center;">
                Or open this link directly:<br />
                <a href="${escapeHtml(inviteUrl)}" style="color:#4A9BF5;word-break:break-all;">${escapeHtml(inviteUrl)}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px;border-top:1px solid #eee;text-align:center;">
              <p style="margin:0;font-size:11px;color:#aaa;">
                Sent via Sometime.Chat &mdash; find a time that works for everyone.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { error } = await getResend().emails.send({
    from: `Sometime.Chat <${FROM_ADDRESS}>`,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
