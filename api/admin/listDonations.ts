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

    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)
    const offset = parseInt(String(req.query.offset ?? '0'), 10) || 0
    const status = req.query.status as string | undefined

    let query = supabaseAdmin
      .from('platform_donations')
      .select('id, charity_name, charity_hmrc_ref, donor_name_submitted, donor_postcode_submitted, amount, donation_date, gift_aid_status, matched_donor_id, received_at', { count: 'exact' })
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') query = query.eq('gift_aid_status', status)

    const { data, error, count } = await query
    if (error) return send(res, 500, { ok: false, error: error.message })

    const matchedIds = (data || []).filter(d => d.matched_donor_id).map(d => d.matched_donor_id)
    let donorMap: Record<string, any> = {}
    if (matchedIds.length > 0) {
      const { data: donors } = await supabaseAdmin
        .from('intermediary_donors')
        .select('id, first_name, last_name, postcode')
        .in('id', matchedIds)
      for (const d of donors || []) donorMap[d.id] = d
    }

    const donations = (data || []).map(d => ({
      ...d,
      matchedDonor: d.matched_donor_id ? donorMap[d.matched_donor_id] || null : null,
      giftAid: d.gift_aid_status === 'matched' ? Math.round(d.amount * 0.25 * 100) / 100 : 0,
    }))

    return send(res, 200, { ok: true, donations, total: count ?? 0 })
  } catch (e: any) {
    return send(res, e.message?.includes('Forbidden') || e.message?.includes('Unauthorised') ? 403 : 500, { ok: false, error: e.message })
  }
}
