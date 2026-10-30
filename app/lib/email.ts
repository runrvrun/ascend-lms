// Email templates. Each builder returns a message for the queue: app code sends it
// with sendEmails() (app/lib/sendEmail.ts), cron scripts with enqueueEmails()
// (app/lib/emailOutbox.ts). Delivery, rate limits and retries live in emailOutbox.ts.

import type { EmailMessage } from "./emailOutbox"

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://ycp-ascend-lms.vercel.app"

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

export function accountActivationEmail(to: string, userName: string, token: string): EmailMessage {
  const link = `${BASE_URL}/auth/activate?token=${token}`
  return {
    to,
    subject: "Set your Ascend LMS password",
    html: layout(`
      <p>Hi <strong>${userName}</strong>,</p>
      <p>An account has been created for you on <strong>Ascend LMS</strong>. Click the button below to set your password and activate your account.</p>
      <p style="margin-top:24px;">
        <a href="${link}"
           style="background:#194693;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          Set My Password
        </a>
      </p>
      <p style="margin-top:20px;font-size:12px;color:#64748b;">This link expires in 48 hours. If you did not expect this email, you can safely ignore it.</p>
    `),
  }
}

export function enrollmentApprovedEmail(to: string, userName: string, pathwayName: string): EmailMessage {
  return {
    to,
    subject: `Your enrollment in "${pathwayName}" has been approved`,
    html: layout(`
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Your request to enroll in <strong>${pathwayName}</strong> has been
        <span style="color:#16a34a;font-weight:600;">approved</span>. You can now start learning!</p>
      <p style="margin-top:24px;">
        <a href="${BASE_URL}/pathways"
           style="background:#194693;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          Go to Pathways
        </a>
      </p>
    `),
  }
}

export function enrollmentRejectedEmail(
  to: string,
  userName: string,
  pathwayName: string,
  reason: string,
  managerName: string
): EmailMessage {
  return {
    to,
    subject: `Your enrollment request for "${pathwayName}" was not approved`,
    html: layout(`
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Your request to enroll in <strong>${pathwayName}</strong> was
        <span style="color:#dc2626;font-weight:600;">not approved</span>.</p>
      <div style="background:#fef2f2;border-left:3px solid #dc2626;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0;font-size:13px;"><strong>Reason:</strong> ${reason}</p>
      </div>
      <p>Please speak with your manager (<strong>${managerName}</strong>) if you have any questions.</p>
    `),
  }
}

export function pathwayAssignedEmail(
  to: string,
  userName: string,
  pathwayName: string,
  pathwayId: string,
  cohortName?: string,
  deadline?: Date | null
): EmailMessage {
  const link = `${BASE_URL}/pathways/${pathwayId}`
  return {
    to,
    subject: `You've been assigned to "${pathwayName}"`,
    html: layout(`
      <p>Hi <strong>${userName}</strong>,</p>
      <p>${
        cohortName
          ? `A new pathway has been assigned to your cohort <strong>${cohortName}</strong>:`
          : `You have been assigned to a new pathway:`
      }</p>
      <p style="font-size:16px;font-weight:600;margin:12px 0 20px;">${pathwayName}</p>
      ${deadline ? `<p>Please complete it by <strong>${formatDeadline(deadline)}</strong>.</p>` : ""}
      <p>
        <a href="${link}"
           style="background:#194693;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          View Pathway
        </a>
      </p>
    `),
  }
}

export function pathwaySharedEmail(
  to: string,
  userName: string,
  sharerName: string,
  pathwayName: string,
  pathwayId: string
): EmailMessage {
  const link = `${BASE_URL}/pathways/${pathwayId}/preview`
  return {
    to,
    subject: `${sharerName} shared "${pathwayName}" with you`,
    html: layout(`
      <p>Hi <strong>${userName}</strong>,</p>
      <p><strong>${sharerName}</strong> thought you might be interested in this pathway:</p>
      <p style="font-size:16px;font-weight:600;margin:12px 0 20px;">${pathwayName}</p>
      <p>
        <a href="${link}"
           style="background:#194693;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          Preview Pathway
        </a>
      </p>
      <p style="margin-top:20px;font-size:12px;color:#64748b;">You have not been enrolled. Preview the pathway and enroll if it interests you.</p>
    `),
  }
}

// Deadlines are calendar dates stored as UTC midnight — format in UTC so the day never shifts.
function formatDeadline(deadline: Date) {
  return deadline.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}

export function deadlineReminderEmail(
  to: string,
  userName: string,
  pathwayName: string,
  deadline: Date,
  dueToday: boolean,
  graceDays: number,
  continueUrl: string
): EmailMessage {
  const when = dueToday ? "today" : "tomorrow"
  return {
    to,
    subject: `Reminder: "${pathwayName}" is due ${when}`,
    html: layout(`
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Your pathway <strong>${pathwayName}</strong> is due <strong>${when}, ${formatDeadline(deadline)}</strong>.</p>
      <p>After ${graceDays} days past the deadline you will no longer be able to complete courses or submit assignments in this pathway.</p>
      <p>
        <a href="${continueUrl}"
           style="background:#194693;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          Continue Learning
        </a>
      </p>
    `),
  }
}

export function learningReminderEmail(
  to: string,
  userName: string,
  message: string,
  pathways: { pathwayId: string; pathwayName: string; nextCourseName: string }[],
  startLearningUrl: string
): EmailMessage {
  const pathwayItems = pathways
    .map(
      (p) => `
      <li style="margin-bottom:8px;">
        <strong>${p.pathwayName}</strong> — Next up: ${p.nextCourseName}
      </li>`
    )
    .join("")

  return {
    to,
    subject: message,
    html: layout(`
      <p>Hi <strong>${userName}</strong>,</p>
      <p style="font-size:16px;font-weight:600;margin:12px 0 20px;">${message}</p>
      <ul style="margin:0 0 20px;padding-left:20px;">${pathwayItems}</ul>
      <p>
        <a href="${startLearningUrl}"
           style="background:#194693;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          Start Learning
        </a>
      </p>
    `),
  }
}

export function newEnrollmentRequestEmail(
  to: string,
  managerName: string,
  learnerName: string,
  pathwayName: string,
  note: string | null
): EmailMessage {
  return {
    to,
    subject: `${learnerName} has requested enrollment in "${pathwayName}"`,
    html: layout(`
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
    `),
  }
}
