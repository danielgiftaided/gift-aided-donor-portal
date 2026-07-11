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
    const { donation_id, donor_id } = body

    // If donor_id is provided, apply that specific match directly.
    // If not, run the auto-matching logic to find candidates.
    if (!donation_id) return send(res, 400, { ok: false, error: 'donation_id is required' })

    const { data: donation, error: donErr } = await supabaseAdmin
      .from('platform_donations')
      .select('*')
      .eq('id', donation_id)
      .single()

    if (donErr || !donation) return send(res, 404, { ok: false, error: 'Donation not found' })

    // If a specific donor_id was provided, apply that match directly
    if (donor_id) {
      const { data: donor, error: dErr } = await supabaseAdmin
        .from('intermediary_donors')
        .select('id, status')
        .eq('id', donor_id)
        .single()

      if (dErr || !donor) return send(res, 404, { ok: false, error: 'Donor not found' })
      if (donor.status !== 'active') return send(res, 400, { ok: false, error: 'This donor has cancelled their authorisation' })

      await supabaseAdmin
        .from('platform_donations')
        .update({ matched_donor_id: donor_id, gift_aid_status: 'matched', declaration_created_at: new Date().toISOString() })
        .eq('id', donation_id)

      return send(res, 200, { ok: true, message: 'Match applied successfully' })
    }

    // Auto-matching — search by name and postcode
    const nameParts = (donation.donor_name_submitted || '').trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    const postcode = (donation.donor_postcode_submitted || '').trim().toUpperCase()

    let query = supabaseAdmin
      .from('intermediary_donors')
      .select('id, first_name, last_name, postcode, status')
      .eq('status', 'active')

    if (firstName) query = query.ilike('first_name', firstName)
    if (lastName) query = query.ilike('last_name', lastName)

    const { data: candidates, error: cErr } = await query
    if (cErr) return send(res, 500, { ok: false, error: cErr.message })

    const scored = (candidates || []).map(c => {
      const postcodeMatch = postcode && c.postcode?.toUpperCase() === postcode
      const confidence = postcodeMatch ? 'high' : candidates!.length === 1 ? 'medium' : 'low'
      return { ...c, confidence }
    }).sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.confidence as keyof typeof order] - order[b.confidence as keyof typeof order]
    })

    return send(res, 200, { ok: true, candidates: scored, autoMatched: false })

  } catch (e: any) {
    return send(res, e.message?.includes('Forbidden') || e.message?.includes('Unauthorised') ? 403 : 500, { ok: false, error: e.message })
  }
}
