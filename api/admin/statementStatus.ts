// GET /api/admin/statementStatus?taxYear=2024/25
// Returns counts of generated/sent/unsent statements for a given tax year.

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

    const taxYear = req.query.taxYear as string

    const { data, error } = await supabaseAdmin
      .from('annual_statements')
      .select('id, sent_at, total_gift_aid')
      .eq('tax_year', taxYear || '')

    if (error) return send(res, 500, { ok: false, error: error.message })

    const rows = data || []
    const sent = rows.filter(r => r.sent_at).length
    const unsent = rows.filter(r => !r.sent_at).length
    const totalGiftAid = rows.reduce((s, r) => s + (r.total_gift_aid || 0), 0)

    // Days until 31 May deadline
    const currentYear = new Date().getFullYear()
    const deadline = new Date(`${currentYear}-05-31`)
    const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

    return send(res, 200, {
      ok: true,
      taxYear,
      total: rows.length,
      sent,
      unsent,
      totalGiftAid,
      daysUntilDeadline,
      deadlinePassed: daysUntilDeadline < 0,
    })

  } catch (e: any) {
    return send(res, e.message?.includes('Forbidden') ? 403 : 500, { ok: false, error: e.message })
  }
}
