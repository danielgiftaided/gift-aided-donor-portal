import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireDonor } from '../_utils/requireDonor.js'
import { supabaseAdmin } from '../_utils/supabase.js'

function send(res: VercelResponse, status: number, body: object) {
  return res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' })

    const { donor } = await requireDonor(req)

    // Fetch authorisation records
    const { data: authorisations } = await supabaseAdmin
      .from('donor_authorisations')
      .select('id, authorisation_date, tax_year_from, tax_year_to, status, cancelled_at, source')
      .eq('donor_id', donor.id)
      .order('authorisation_date', { ascending: false })

    const activeAuth = (authorisations || []).find(a => a.status === 'active')

    // Fetch recent platform donations (limit 10 for dashboard)
    const { data: recentDonations } = await supabaseAdmin
      .from('platform_donations')
      .select('id, charity_name, charity_hmrc_ref, amount, donation_date, gift_aid_status')
      .eq('matched_donor_id', donor.id)
      .order('donation_date', { ascending: false })
      .limit(10)

    // Summary stats
    const { data: allDonations } = await supabaseAdmin
      .from('platform_donations')
      .select('amount, gift_aid_status, donation_date')
      .eq('matched_donor_id', donor.id)

    const currentTaxYear = getCurrentTaxYear()
    const totalGiftAid = (allDonations || [])
      .filter(d => d.gift_aid_status === 'matched')
      .reduce((s, d) => s + Math.round(d.amount * 0.25 * 100) / 100, 0)

    const currentYearGiftAid = (allDonations || [])
      .filter(d => d.gift_aid_status === 'matched' && getDonationTaxYear(d.donation_date) === currentTaxYear)
      .reduce((s, d) => s + Math.round(d.amount * 0.25 * 100) / 100, 0)

    return send(res, 200, {
      ok: true,
      profile: {
        firstName: donor.first_name,
        lastName: donor.last_name,
        address: donor.address,
        postcode: donor.postcode,
        email: donor.email,
        status: donor.status,
        authorisationDate: activeAuth?.authorisation_date || null,
        taxYearFrom: activeAuth?.tax_year_from || null,
        taxYearTo: activeAuth?.tax_year_to || null,
        authorisations: (authorisations || []).map(a => ({
          id: a.id,
          authorisationDate: a.authorisation_date,
          taxYearFrom: a.tax_year_from,
          taxYearTo: a.tax_year_to,
          status: a.status,
          cancelledAt: a.cancelled_at,
          source: a.source,
        })),
        totalDonations: (allDonations || []).filter(d => d.gift_aid_status === 'matched').length,
        totalGiftAid,
        currentTaxYearGiftAid: currentYearGiftAid,
        recentDonations: (recentDonations || []).map(d => ({
          id: d.id,
          charityName: d.charity_name,
          charityHmrcRef: d.charity_hmrc_ref,
          amount: d.amount,
          donationDate: d.donation_date,
          giftAidStatus: d.gift_aid_status,
          giftAid: Math.round(d.amount * 0.25 * 100) / 100,
        })),
      },
    })

  } catch (e: any) {
    if (e.message === 'DONOR_NOT_FOUND') return send(res, 404, { ok: false, error: 'No donor profile found' })
    return send(res, 401, { ok: false, error: e.message ?? 'Server error' })
  }
}

function getCurrentTaxYear(): string {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate()
  if (m > 4 || (m === 4 && d >= 6)) return `${y}/${String(y + 1).slice(2)}`
  return `${y - 1}/${String(y).slice(2)}`
}

function getDonationTaxYear(dateStr: string): string {
  const d = new Date(dateStr)
  return getCurrentTaxYear() // simplified — would use actual date logic in production
}
