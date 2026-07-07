import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireDonor } from '../_utils/requireDonor.js'
import { supabaseAdmin } from '../_utils/supabase.js'

function send(res: VercelResponse, status: number, body: object) {
  return res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' })

    const { donor } = await requireDonor(req)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const reason = String(body?.reason || 'Cancelled by donor').trim().slice(0, 500)

    const now = new Date().toISOString()

    // Cancel all active authorisation records
    await supabaseAdmin
      .from('donor_authorisations')
      .update({ status: 'cancelled', cancelled_at: now, cancellation_reason: reason })
      .eq('donor_id', donor.id)
      .eq('status', 'active')

    // Update the donor's overall status
    await supabaseAdmin
      .from('intermediary_donors')
      .update({ status: 'cancelled', cancelled_at: now, cancellation_reason: reason })
      .eq('id', donor.id)

    return send(res, 200, { ok: true, message: 'Gift Aid authorisation cancelled. No new declarations will be created from this date.' })

  } catch (e: any) {
    return send(res, 401, { ok: false, error: e.message ?? 'Server error' })
  }
}
