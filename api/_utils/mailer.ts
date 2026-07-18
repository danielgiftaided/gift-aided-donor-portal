/**
 * Shared email utility for the donor portal.
 * Sends via Brevo SMTP using the same credentials configured in Supabase.
 *
 * Required Vercel environment variables (same values as Supabase SMTP):
 *   SMTP_HOST      = smtp-relay.brevo.com
 *   SMTP_PORT      = 587
 *   SMTP_USER      = your Brevo login email
 *   SMTP_PASS      = your Brevo SMTP key
 *   SMTP_FROM      = daniel@giftaided.com
 *   SMTP_FROM_NAME = Gift Aided
 */

import nodemailer from 'nodemailer'

// Lazily create the transporter so env vars are read at call time,
// not at module load time (important for Vercel cold starts).
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com'
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS environment variables are required for email sending.')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

interface SendOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendOptions) {
  const transporter = getTransporter()
  const from = `"${process.env.SMTP_FROM_NAME || 'Gift Aided'}" <${process.env.SMTP_FROM || 'daniel@giftaided.com'}>`

  await transporter.sendMail({ from, to, subject, html })
}

// ── Shared email shell — matches the design of all Gift Aided emails ─────────

function emailShell(accentColor: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#FCF8EF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FCF8EF;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:24px;">
              <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;color:#0c745d;letter-spacing:-0.5px;">gift aided</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
              <!-- Accent bar -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="background-color:${accentColor};height:4px;"></td></tr>
              </table>
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">
                This email was sent by <strong>Gift Aided Ltd</strong>.
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Manage your account at
                <a href="https://donors.giftaided.com" style="color:#0c745d;text-decoration:none;">donors.giftaided.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Welcome email — full registration (donor has MFA set up) ─────────────────

export function buildFullRegistrationWelcome(firstName: string): string {
  const portalUrl = process.env.DONOR_PORTAL_URL || 'https://donors.giftaided.com'

  const body = `
    <!-- Body -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:40px 40px 32px;">

          <!-- Icon -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="width:56px;height:56px;background-color:#f0faf7;border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:26px;">✓</div>
              </td>
            </tr>
          </table>

          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#304675;text-align:center;line-height:1.3;">
            Welcome to Gift Aided, ${firstName}!
          </h1>
          <p style="margin:0 0 28px;font-size:15px;color:#6b7280;text-align:center;line-height:1.6;">
            Your Gift Aid authorisation is confirmed and active. Gift Aid will now be
            applied automatically to every eligible donation you make through connected
            charities and platforms — no forms, no tick boxes, nothing to remember.
          </p>

          <!-- Gift Aid stat -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td style="background-color:#f0faf7;border-radius:12px;padding:16px 20px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">For every £1 you donate</p>
                <p style="margin:0;font-size:28px;font-weight:800;color:#0c745d;">+25p Gift Aid</p>
                <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">claimed from HMRC on your behalf at no cost to you</p>
              </td>
            </tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding-bottom:28px;">
                <a href="${portalUrl}/dashboard"
                   style="display:inline-block;background-color:#0c745d;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">
                  View my dashboard
                </a>
              </td>
            </tr>
          </table>

          <!-- Divider -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-top:1px solid #f3f4f6;padding-top:24px;"></td></tr>
          </table>

        </td>
      </tr>
    </table>

    <!-- What happens now box -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background-color:#f9fafb;padding:20px 40px 24px;border-top:1px solid #f3f4f6;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#304675;">What happens next</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${['Every eligible donation you make through a connected charity or platform will automatically attract Gift Aid.',
               'We submit Gift Aid claims to HMRC on behalf of your charities — you never need to fill in a declaration again.',
               'Each May, you will receive your free annual Gift Aid statement summarising everything claimed on your behalf.',
               'If you are a higher-rate taxpayer, you can claim additional personal tax relief through Self Assessment on top of what your charities receive.']
              .map(item => `
            <tr>
              <td style="padding:4px 0;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:10px;vertical-align:top;font-size:14px;color:#0c745d;">✓</td>
                    <td style="font-size:13px;color:#6b7280;line-height:1.5;">${item}</td>
                  </tr>
                </table>
              </td>
            </tr>`).join('')}
          </table>
        </td>
      </tr>
    </table>`

  return emailShell('#0c745d', body)
}

// ── Welcome email — quick registration (donor needs to set up account) ────────

export function buildQuickRegisterWelcome(firstName: string, setupLink: string, charityOrCampaignName?: string): string {
  const context = charityOrCampaignName
    ? `your donation to <strong>${charityOrCampaignName}</strong>`
    : 'your recent donation'

  const body = `
    <!-- Body -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:40px 40px 32px;">

          <!-- Icon -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="width:56px;height:56px;background-color:#f0faf7;border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:26px;">✓</div>
              </td>
            </tr>
          </table>

          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#304675;text-align:center;line-height:1.3;">
            Gift Aid is active, ${firstName}
          </h1>
          <p style="margin:0 0 20px;font-size:15px;color:#6b7280;text-align:center;line-height:1.6;">
            HMRC will add an extra 25p for every £1 you donated to ${context} — at no cost to you.
            Gift Aid is already working. This email gives you the option to set up a full account
            so you can track your giving history and manage your Gift Aid.
          </p>

          <!-- Gift Aid badge -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td style="background-color:#f0faf7;border-radius:12px;padding:14px 20px;text-align:center;">
                <p style="margin:0;font-size:14px;font-weight:600;color:#0c745d;">
                  25% Gift Aid will be added to your donation automatically
                </p>
                <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">No action needed from you — we handle everything</p>
              </td>
            </tr>
          </table>

          <!-- Divider -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-top:1px solid #f3f4f6;padding-top:24px;"></td></tr>
          </table>

          <!-- Account setup section -->
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#304675;">Set up your Gift Aided account (optional)</p>
          <p style="margin:0 0 20px;font-size:13px;color:#6b7280;line-height:1.6;">
            With a full account you can see all your giving history, view your annual Gift Aid statements,
            manage your authorisation, and check how much Gift Aid has been claimed on your behalf.
            Your Gift Aid is already active — this step is entirely optional.
          </p>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding-bottom:16px;">
                <a href="${setupLink}"
                   style="display:inline-block;background-color:#304675;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">
                  Set up my account
                </a>
              </td>
            </tr>
          </table>

          <!-- Link fallback -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-top:1px solid #f3f4f6;padding-top:20px;">
                <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;text-align:center;">
                  Button not working? Copy and paste this link into your browser:
                </p>
                <p style="margin:0;font-size:11px;color:#0c745d;text-align:center;word-break:break-all;">
                  ${setupLink}
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>

    <!-- Legal note -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background-color:#f9fafb;padding:16px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">
            Gift Aided Ltd holds your name and address solely to create Gift Aid declarations.
            You will receive one annual statement each May. You can cancel your Gift Aid authorisation at any time.
            This link expires in 24 hours — you can request a new one at
            <a href="https://donors.giftaided.com/forgot-password" style="color:#0c745d;">donors.giftaided.com</a>
          </p>
        </td>
      </tr>
    </table>`

  return emailShell('#0c745d', body)
}
