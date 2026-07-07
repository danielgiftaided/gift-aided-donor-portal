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
    const { firstName, lastName, address, postcode } = body

    if (!firstName || !lastName || !address || !postcode) {
      return send(res, 400, { ok: false, error: 'All fields are required.' })
    }

    const { error } = await supabaseAdmin
      .from('intermediary_donors')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        address: address.trim(),
        postcode: postcode.trim().toUpperCase(),
      })
      .eq('id', donor.id)

    if (error) return send(res, 500, { ok: false, error: error.message })

    return send(res, 200, { ok: true })

  } catch (e: any) {
    return send(res, 401, { ok: false, error: e.message ?? 'Server error' })
  }
}
