import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin } from './requireAdmin.js'
import { supabaseAdmin } from '../_utils/supabase.js'

function send(res: VercelResponse, status: number, body: object) {
  return res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' })
    const { admin } = await requireAdmin(req)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { donor_id, reason } = body
    if (!donor_id) return send(res, 400, { ok: false, error: 'donor_id is required' })

    const now = new Date().toISOString()
    const cancelReason = reason || `Cancelled by admin (${admin.email})`

    await supabaseAdmin.from('donor_authorisations')
      .update({ status: 'cancelled', cancelled_at: now, cancellation_reason: cancelReason })
      .eq('donor_id', donor_id).eq('status', 'active')

    await supabaseAdmin.from('intermediary_donors')
      .update({ status: 'cancelled', cancelled_at: now, cancellation_reason: cancelReason })
      .eq('id', donor_id)

    return send(res, 200, { ok: true, message: 'Authorisation cancelled' })
  } catch (e: any) {
    return send(res, e.message?.includes('Forbidden') || e.message?.includes('Unauthorised') ? 403 : 500, { ok: false, error: e.message })
  }
}
