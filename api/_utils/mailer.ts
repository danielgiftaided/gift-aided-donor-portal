/**
 * Mailer utility — production sends via Brevo SMTP.
 * Sandbox mode (SANDBOX_MODE=true) logs emails to console instead of sending.
 * This prevents real emails going out during LaunchGood integration testing.
 */

import nodemailer from 'nodemailer'

function isSandbox() {
  return process.env.SANDBOX_MODE === 'true'
}

function getTransporter() {
  if (isSandbox()) return null   // no transporter needed in sandbox

  const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com'
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS environment variables are required.')
  }

  return nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
  })
}

interface SendOptions { to: string; subject: string; html: string }

export async function sendEmail({ to, subject, html }: SendOptions) {
  if (isSandbox()) {
    // In sandbox, log the email instead of sending it.
    // Visible in Vercel function logs so LaunchGood can verify the
    // email would have been sent correctly.
    console.log('[SANDBOX] Email suppressed — would have sent:')
    console.log(`  To:      ${to}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  HTML:    ${html.slice(0, 200)}…`)
    return
  }

  const transporter = getTransporter()!
  const from = `"${process.env.SMTP_FROM_NAME || 'Gift Aided'}" <${process.env.SMTP_FROM || 'daniel@giftaided.com'}>`
  await transporter.sendMail({ from, to, subject, html })
}

// ── Email builders (same in both environments) ────────────────────────────

export function buildFullRegistrationWelcome(firstName: string): string {
  const portalUrl = process.env.DONOR_PORTAL_URL || 'https://donors.giftaided.com'
  const sandboxNotice = isSandbox()
    ? `<tr><td style="background:#fef3c7;padding:10px 32px;border-top:2px solid #f59e0b;font-size:12px;color:#92400e;font-weight:bold;text-align:center;">
        ⚠️ SANDBOX — this is a test email, no real Gift Aid has been registered
       </td></tr>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FCF8EF;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FCF8EF;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="padding-bottom:20px;">
        <span style="font-size:24px;font-weight:800;color:#0c745d;">gift aided</span>
      </td></tr>
      <tr><td style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#0c745d;height:4px;"></td></tr>
          ${sandboxNotice}
          <tr><td style="padding:32px 32px 24px;">
            <div style="text-align:center;margin-bottom:20px;">
              <div style="width:56px;height:56px;background:#f0faf7;border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:26px;">✓</div>
            </div>
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#304675;text-align:center;">Welcome to Gift Aided, ${firstName}!</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;text-align:center;line-height:1.6;">Your Gift Aid authorisation is confirmed. Gift Aid will now be applied automatically to every eligible donation through connected charities — no forms, no tick boxes.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="background:#f0faf7;border-radius:12px;padding:16px;text-align:center;">
                <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">For every £1 you donate</div>
                <div style="font-size:28px;font-weight:800;color:#0c745d;">+25p Gift Aid</div>
                <div style="font-size:12px;color:#9ca3af;margin-top:4px;">from HMRC, at no cost to you</div>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${portalUrl}/dashboard" style="display:inline-block;background:#0c745d;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">View my dashboard</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Gift Aided Ltd · <a href="${portalUrl}" style="color:#0c745d;">donors.giftaided.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export function buildQuickRegisterWelcome(firstName: string, setupLink: string, campaignName?: string): string {
  const sandboxNotice = isSandbox()
    ? `<p style="background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;border-radius:6px;font-size:12px;color:#92400e;font-weight:bold;margin-bottom:16px;text-align:center;">⚠️ SANDBOX — test email only</p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FCF8EF;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FCF8EF;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="padding-bottom:20px;"><span style="font-size:24px;font-weight:800;color:#0c745d;">gift aided</span></td></tr>
      <tr><td style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#0c745d;height:4px;"></td></tr>
          <tr><td style="padding:32px;">
            ${sandboxNotice}
            <div style="text-align:center;margin-bottom:20px;">
              <div style="width:56px;height:56px;background:#f0faf7;border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:26px;">✓</div>
            </div>
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#304675;text-align:center;">Gift Aid is active, ${firstName}</h1>
            <p style="margin:0 0 20px;font-size:15px;color:#6b7280;text-align:center;line-height:1.6;">HMRC will add an extra 25p for every £1 you donated${campaignName ? ` to ${campaignName}` : ''} — at no cost to you.</p>
            <div style="background:#f0faf7;border-radius:12px;padding:14px;text-align:center;margin-bottom:24px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#0c745d;">25% Gift Aid applied automatically ✓</p>
            </div>
            <p style="font-size:13px;font-weight:700;color:#304675;margin:0 0 8px;">Set up your Gift Aided account (optional)</p>
            <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 20px;">View your giving history and manage your Gift Aid from one place.</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${setupLink}" style="display:inline-block;background:#304675;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">Set up my account</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">Link expires in 24 hours · Gift Aided Ltd · donors.giftaided.com</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}
