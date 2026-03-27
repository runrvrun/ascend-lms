// Email utility — currently routes through Mailtrap sandbox (emails captured, not delivered).
// To switch to Resend in production, replace `send()` with the Resend API call.

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://ycp-ascend-lms.vercel.app"

async function send(to: string, subject: string, html: string) {
  const token = process.env.MAILTRAP_TOKEN
  const inboxId = process.env.MAILTRAP_INBOX_ID

  if (!token || !inboxId) {
    console.warn("[email] MAILTRAP_TOKEN or MAILTRAP_INBOX_ID not set — skipping email to", to)
    return
  }

  try {
    const res = await fetch(`https://sandbox.api.mailtrap.io/api/send/${inboxId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        from: { email: "noreply-ascend@ycp.com", name: "Ascend LMS" },
        to: [{ email: to }],
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error("[email] Mailtrap error:", res.status, body)
    }
  } catch (err) {
    console.error("[email] Failed to send to", to, err)
  }
}

function layout(body: string) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#194693,#03368C);padding:24px 32px;">
            <span style="color:#fff;font-size:20px;font-weight:700;">Ascend LMS</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#1e293b;font-size:14px;line-height:1.7;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;">
            You received this from Ascend LMS. Do not reply to this email.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendAccountActivation(to: string, userName: string, token: string) {
  const link = `${BASE_URL}/auth/activate?token=${token}`
  await send(
    to,
    "Set your Ascend LMS password",
    layout(`
      <p>Hi <strong>${userName}</strong>,</p>
      <p>An account has been created for you on <strong>Ascend LMS</strong>. Click the button below to set your password and activate your account.</p>
      <p style="margin-top:24px;">
        <a href="${link}"
           style="background:#194693;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          Set My Password
        </a>
      </p>
      <p style="margin-top:20px;font-size:12px;color:#64748b;">This link expires in 48 hours. If you did not expect this email, you can safely ignore it.</p>
    `)
  )
}

export async function sendEnrollmentApproved(to: string, userName: string, pathwayName: string) {
  await send(
    to,
    `Your enrollment in "${pathwayName}" has been approved`,
    layout(`
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Your request to enroll in <strong>${pathwayName}</strong> has been
        <span style="color:#16a34a;font-weight:600;">approved</span>. You can now start learning!</p>
      <p style="margin-top:24px;">
        <a href="${BASE_URL}/pathways"
           style="background:#194693;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          Go to Pathways
        </a>
      </p>
    `)
  )
}

export async function sendEnrollmentRejected(
  to: string,
  userName: string,
  pathwayName: string,
  reason: string,
  managerName: string
) {
  await send(
    to,
    `Your enrollment request for "${pathwayName}" was not approved`,
    layout(`
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Your request to enroll in <strong>${pathwayName}</strong> was
        <span style="color:#dc2626;font-weight:600;">not approved</span>.</p>
      <div style="background:#fef2f2;border-left:3px solid #dc2626;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0;font-size:13px;"><strong>Reason:</strong> ${reason}</p>
      </div>
      <p>Please speak with your manager (<strong>${managerName}</strong>) if you have any questions.</p>
    `)
  )
}

export async function sendNewEnrollmentRequest(
  to: string,
  managerName: string,
  learnerName: string,
  pathwayName: string,
  note: string | null
) {
  await send(
    to,
    `${learnerName} has requested enrollment in "${pathwayName}"`,
    layout(`
      <p>Hi <strong>${managerName}</strong>,</p>
      <p><strong>${learnerName}</strong> has requested to enroll in the pathway
        <strong>${pathwayName}</strong>.</p>
      ${note ? `<div style="background:#f8fafc;border-left:3px solid #3b82f6;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0;font-size:13px;"><strong>Their reason:</strong> ${note}</p>
      </div>` : ""}
      <p style="margin-top:24px;">
        <a href="${BASE_URL}/manager/pathway-request"
           style="background:#194693;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          Review Request
        </a>
      </p>
    `)
  )
}
