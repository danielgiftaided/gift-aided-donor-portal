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
    const search = req.query.search as string | undefined

    let query = supabaseAdmin
      .from('intermediary_donors')
      .select('id, first_name, last_name, email, postcode, status, created_at, cancelled_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') query = query.eq('status', status)
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error, count } = await query
    if (error) return send(res, 500, { ok: false, error: error.message })

    return send(res, 200, { ok: true, donors: data || [], total: count ?? 0 })
  } catch (e: any) {
    return send(res, e.message?.includes('Forbidden') || e.message?.includes('Unauthorised') ? 403 : 500, { ok: false, error: e.message })
  }
}
