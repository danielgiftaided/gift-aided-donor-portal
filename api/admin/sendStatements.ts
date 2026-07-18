/**
 * POST /api/admin/sendStatements
 *
 * Dispatches annual Gift Aid statements to donors who have not yet
 * received theirs for the given tax year. Sends via Supabase email
 * (which routes through Brevo SMTP).
 *
 * Body: { taxYear: "2024/25", dryRun?: boolean }
 *
 * dryRun: if true, calculates who would be sent to but sends nothing.
 * Use dryRun first to confirm the count before triggering live sends.
 *
 * LEGAL NOTE: Statements MUST be sent by 31 May following the tax year.
 * Late dispatch is a penalty-bearing offence under SI 2016/1195 reg 6.
 * The admin UI shows a countdown warning from 1 May.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin } from './requireAdmin.js'
import { supabaseAdmin } from '../_utils/supabase.js'

function send(res: VercelResponse, status: number, body: object) {
  return res.status(status).json(body)
}

function buildStatementEmail(
  firstName: string,
  taxYear: string,
  totalDonated: number,
  totalGiftAid: number,
  donationCount: number,
  donations: Array<{ charityName: string; amount: number; giftAid: number; donationDate: string }>
): string {
  const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const rows = donations.map(d => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;">${d.charityName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;text-align:right;">${fmtDate(d.donationDate)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;text-align:right;">${fmt(d.amount)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600;color:#0c745d;text-align:right;">${fmt(d.giftAid)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FCF8EF;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FCF8EF;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

      <tr><td style="padding-bottom:20px;">
        <span style="font-size:22px;font-weight:800;color:#0c745d;">gift aided</span>
      </td></tr>

      <tr><td style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#0c745d;height:4px;"></td></tr>
          <tr><td style="padding:32px 32px 24px;">
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#304675;">
              Your Gift Aid Statement — ${taxYear}
            </h1>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
              Hi ${firstName}, here is your annual Gift Aid summary. This statement covers
              donations made under your Gift Aided authorisation during the ${taxYear} tax year.
              Please keep this for your records.
            </p>

            <!-- Totals -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#f0faf7;border-radius:12px;padding:16px 20px;text-align:center;">
                  <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total Gift Aid Claimed</div>
                  <div style="font-size:28px;font-weight:800;color:#0c745d;">${fmt(totalGiftAid)}</div>
                  <div style="font-size:12px;color:#9ca3af;margin-top:4px;">across ${donationCount} donation${donationCount === 1 ? '' : 's'} totalling ${fmt(totalDonated)}</div>
                </td>
              </tr>
            </table>

            <!-- Breakdown table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f3f4f6;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;">Charity</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;">Date</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;">Donated</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;">Gift Aid</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>

          </td></tr>

          <!-- Legal notice -->
          <tr><td style="background:#fffbeb;padding:16px 32px;border-top:1px solid #fef3c7;">
            <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">
              <strong>Important:</strong> This statement covers only donations made through Gift Aided.
              It does not include donations made directly to charities or through other Gift Aid intermediaries.
              To qualify for Gift Aid you must have paid enough UK Income Tax or Capital Gains Tax to cover
              the amount claimed. If this has changed, please cancel your Gift Aid authorisation immediately
              by logging into your account at donors.giftaided.com.
            </p>
          </td></tr>

          <!-- Higher rate prompt -->
          <tr><td style="background:#eef2f9;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#304675;line-height:1.6;">
              <strong>Higher-rate taxpayer?</strong> If you pay 40% or 45% Income Tax you may be able to
              claim personal tax relief on your donations through Self Assessment. For ${fmt(totalDonated)} of
              Gift Aided donations you could potentially claim an additional
              <strong>${fmt(Math.round(totalDonated * 0.25 * 100) / 100)}</strong> back personally.
              Visit <a href="https://www.gov.uk/donating-to-charity/gift-aid" style="color:#0c745d;">gov.uk/donating-to-charity/gift-aid</a> to learn more.
            </p>
          </td></tr>

        </table>
      </td></tr>

      <tr><td style="padding-top:20px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">
          This statement was issued by Gift Aided Ltd under the requirements of SI 2016/1195.
          Manage your account at <a href="https://donors.giftaided.com" style="color:#0c745d;">donors.giftaided.com</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' })
    await requireAdmin(req)

    const body    = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const taxYear = body.taxYear as string
    const dryRun  = Boolean(body.dryRun)

    if (!taxYear) return send(res, 400, { ok: false, error: 'taxYear is required' })

    // Fetch all unsent statements for this tax year
    const { data: statements, error: stErr } = await supabaseAdmin
      .from('annual_statements')
      .select('id, donor_id, tax_year, total_donated, total_gift_aid, donation_count, statement_data, sent_at')
      .eq('tax_year', taxYear)
      .is('sent_at', null)

    if (stErr) return send(res, 500, { ok: false, error: stErr.message })
    if (!statements?.length) return send(res, 200, { ok: true, sent: 0, message: 'No unsent statements found. Run generateStatements first.' })

    if (dryRun) {
      return send(res, 200, { ok: true, dryRun: true, wouldSend: statements.length, taxYear })
    }

    // Fetch donor emails for all statements
    const donorIds = statements.map(s => s.donor_id)
    const { data: donors } = await supabaseAdmin
      .from('intermediary_donors')
      .select('id, first_name, email')
      .in('id', donorIds)

    const donorMap: Record<string, { firstName: string; email: string }> = {}
    for (const d of donors || []) donorMap[d.id] = { firstName: d.first_name, email: d.email }

    let sent = 0; let failed = 0
    const now = new Date().toISOString()

    for (const stmt of statements) {
      const donor = donorMap[stmt.donor_id]
      if (!donor?.email) { failed++; continue }

      const data = stmt.statement_data as any
      const html = buildStatementEmail(
        donor.firstName,
        taxYear,
        stmt.total_donated,
        stmt.total_gift_aid,
        stmt.donation_count,
        data?.donations || []
      )

      // Send via Supabase admin email (routes through configured Brevo SMTP)
      const { error: emailErr } = await supabaseAdmin.auth.admin.sendRawEmail({
        to: donor.email,
        subject: `Your Gift Aid Statement ${taxYear} — Gift Aided`,
        html,
      } as any)

      if (emailErr) {
        // Log failure but continue — partial sends are better than no sends
        console.error(`Statement email failed for donor ${stmt.donor_id}:`, emailErr.message)
        failed++
        continue
      }

      // Mark as sent
      await supabaseAdmin
        .from('annual_statements')
        .update({ sent_at: now, sent_to_email: donor.email })
        .eq('id', stmt.id)

      sent++
    }

    return send(res, 200, {
      ok: true,
      sent,
      failed,
      taxYear,
      message: `${sent} statements sent successfully.${failed > 0 ? ` ${failed} failed — check server logs.` : ''}`,
    })

  } catch (e: any) {
    return send(res, e.message?.includes('Forbidden') ? 403 : 500, { ok: false, error: e.message })
  }
}
