import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin } from './requireAdmin.js'
import { supabaseAdmin } from '../_utils/supabase.js'

function send(res: VercelResponse, status: number, body: object) {
  return res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' })
    await requireAdmin(req)

    const [donors, donations, authorisations] = await Promise.all([
      supabaseAdmin.from('intermediary_donors').select('id, status, created_at'),
      supabaseAdmin.from('platform_donations').select('id, amount, gift_aid_status, donation_date, charity_name'),
      supabaseAdmin.from('donor_authorisations').select('id, status, tax_year_from'),
    ])

    const totalDonors = donors.data?.length || 0
    const activeDonors = donors.data?.filter(d => d.status === 'active').length || 0
    const totalDonations = donations.data?.length || 0
    const matchedDonations = donations.data?.filter(d => d.gift_aid_status === 'matched').length || 0
    const unmatchedDonations = donations.data?.filter(d => d.gift_aid_status === 'no_match' || d.gift_aid_status === 'pending').length || 0
    const totalGiftAid = (donations.data || [])
      .filter(d => d.gift_aid_status === 'matched')
      .reduce((s, d) => s + Math.round((d.amount || 0) * 0.25 * 100) / 100, 0)
    const matchRate = totalDonations > 0 ? Math.round((matchedDonations / totalDonations) * 100) : 0

    // New donors in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const newDonors = donors.data?.filter(d => d.created_at > thirtyDaysAgo).length || 0

    // Charity breakdown
    const charityMap: Record<string, { name: string; donations: number; giftAid: number }> = {}
    for (const d of donations.data || []) {
      const key = d.charity_name || 'Unknown'
      if (!charityMap[key]) charityMap[key] = { name: key, donations: 0, giftAid: 0 }
      charityMap[key].donations++
      if (d.gift_aid_status === 'matched') {
        charityMap[key].giftAid += Math.round((d.amount || 0) * 0.25 * 100) / 100
      }
    }
    const charityBreakdown = Object.values(charityMap).sort((a, b) => b.giftAid - a.giftAid).slice(0, 10)

    return send(res, 200, {
      ok: true,
      totalDonors, activeDonors, newDonors,
      totalDonations, matchedDonations, unmatchedDonations,
      matchRate, totalGiftAid, charityBreakdown,
    })
  } catch (e: any) {
    return send(res, e.message?.includes('Forbidden') || e.message?.includes('Unauthorised') ? 403 : 500, { ok: false, error: e.message })
  }
}
