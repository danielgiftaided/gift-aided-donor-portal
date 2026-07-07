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

    const { data, error } = await supabaseAdmin
      .from('platform_donations')
      .select('id, charity_name, charity_hmrc_ref, amount, donation_date, gift_aid_status')
      .eq('matched_donor_id', donor.id)
      .order('donation_date', { ascending: false })

    if (error) return send(res, 500, { ok: false, error: error.message })

    const donations = (data || []).map(d => ({
      id: d.id,
      charityName: d.charity_name,
      charityHmrcRef: d.charity_hmrc_ref,
      amount: d.amount,
      donationDate: d.donation_date,
      giftAidStatus: d.gift_aid_status,
      giftAid: d.gift_aid_status === 'matched' ? Math.round(d.amount * 0.25 * 100) / 100 : 0,
    }))

    return send(res, 200, { ok: true, donations })

  } catch (e: any) {
    return send(res, 401, { ok: false, error: e.message ?? 'Server error' })
  }
}
