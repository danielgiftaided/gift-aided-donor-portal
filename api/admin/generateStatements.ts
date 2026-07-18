/**
 * POST /api/admin/generateStatements
 *
 * Calculates annual Gift Aid statements for all donors who had matched
 * donations in the given tax year. Upserts rows into annual_statements.
 * Does NOT send emails — that's a separate /sendStatements call.
 *
 * Body: { taxYear: "2024/25" }
 *
 * Tax year format: "YYYY/YY" where YYYY is the start year.
 * 2024/25 covers 6 April 2024 to 5 April 2025.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin } from './requireAdmin.js'
import { supabaseAdmin } from '../_utils/supabase.js'

function send(res: VercelResponse, status: number, body: object) {
  return res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' })
    await requireAdmin(req)

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { taxYear } = body

    if (!taxYear || !/^\d{4}\/\d{2}$/.test(taxYear)) {
      return send(res, 400, { ok: false, error: 'taxYear must be in format YYYY/YY e.g. "2024/25"' })
    }

    // Derive the date range for the tax year
    const startYear = parseInt(taxYear.split('/')[0], 10)
    const dateFrom  = `${startYear}-04-06`       // 6 April start year
    const dateTo    = `${startYear + 1}-04-05`   // 5 April following year

    // Fetch all matched donations in this tax year
    const { data: donations, error: donErr } = await supabaseAdmin
      .from('platform_donations')
      .select('id, matched_donor_id, charity_name, charity_hmrc_ref, amount, donation_date')
      .eq('gift_aid_status', 'matched')
      .gte('donation_date', dateFrom)
      .lte('donation_date', dateTo)
      .not('matched_donor_id', 'is', null)

    if (donErr) return send(res, 500, { ok: false, error: donErr.message })
    if (!donations?.length) return send(res, 200, { ok: true, generated: 0, message: 'No matched donations found for this tax year.' })

    // Group donations by donor
    const byDonor: Record<string, typeof donations> = {}
    for (const d of donations) {
      if (!byDonor[d.matched_donor_id]) byDonor[d.matched_donor_id] = []
      byDonor[d.matched_donor_id].push(d)
    }

    const now = new Date().toISOString()
    let generated = 0

    for (const [donorId, donorDonations] of Object.entries(byDonor)) {
      const totalDonated  = donorDonations.reduce((s, d) => s + (d.amount || 0), 0)
      const totalGiftAid  = Math.round(totalDonated * 0.25 * 100) / 100

      const statementData = {
        taxYear,
        dateFrom,
        dateTo,
        donations: donorDonations.map(d => ({
          charityName:  d.charity_name || d.charity_hmrc_ref,
          amount:       d.amount,
          giftAid:      Math.round((d.amount || 0) * 0.25 * 100) / 100,
          donationDate: d.donation_date,
        })),
      }

      const { error: upsertErr } = await supabaseAdmin
        .from('annual_statements')
        .upsert({
          donor_id:       donorId,
          tax_year:       taxYear,
          total_donated:  totalDonated,
          total_gift_aid: totalGiftAid,
          donation_count: donorDonations.length,
          statement_data: statementData,
          generated_at:   now,
        }, { onConflict: 'donor_id,tax_year' })

      if (!upsertErr) generated++
    }

    return send(res, 200, {
      ok: true,
      generated,
      taxYear,
      totalDonors: Object.keys(byDonor).length,
      message: `Statements generated for ${generated} donors covering ${donations.length} matched donations.`,
    })

  } catch (e: any) {
    return send(res, e.message?.includes('Forbidden') ? 403 : 500, { ok: false, error: e.message })
  }
}
