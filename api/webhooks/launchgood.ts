import type { VercelRequest, VercelResponse } from '@vercel/node'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '../_utils/supabase.js'

function send(res: VercelResponse, status: number, body: object) {
  return res.status(status).json(body)
}

// Placeholder auth — a shared secret sent by LaunchGood in a header.
// Swap for their actual signing scheme (e.g. HMAC signature) once known.
function verifySecret(req: VercelRequest): boolean {
  const expected = process.env.LAUNCHGOOD_WEBHOOK_SECRET
  if (!expected) return false
  const provided = req.headers['x-launchgood-secret']
  if (typeof provided !== 'string') return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' })
    if (!verifySecret(req)) return send(res, 401, { ok: false, error: 'Unauthorised' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    // Field names are provisional — confirm against LaunchGood's actual
    // webhook payload shape once we have their API docs.
    const externalId = String(body.donation_id ?? body.id ?? '').trim()
    const amount = Number(body.amount)
    const charityHmrcRef = String(body.charity_hmrc_ref ?? '').trim()
    const donationDate = String(body.donation_date ?? new Date().toISOString())
    const donorName = String(body.donor_name ?? '').trim()
    const donorPostcode = String(body.donor_postcode ?? '').trim().toUpperCase()
    const charityName = body.charity_name ? String(body.charity_name).trim() : null

    if (!externalId) return send(res, 400, { ok: false, error: 'Missing donation id' })
    if (!amount || amount <= 0) return send(res, 400, { ok: false, error: 'Invalid amount' })
    if (!charityHmrcRef) return send(res, 400, { ok: false, error: 'charity_hmrc_ref is required' })

    // Idempotent — LaunchGood may retry the same webhook delivery.
    const { data: existing } = await supabaseAdmin
      .from('platform_donations')
      .select('id')
      .eq('source', 'launchgood')
      .eq('external_id', externalId)
      .maybeSingle()

    if (existing) return send(res, 200, { ok: true, donationId: existing.id, alreadyExists: true })

    const { data: donation, error } = await supabaseAdmin
      .from('platform_donations')
      .insert({
        source: 'launchgood',
        external_id: externalId,
        donor_name_submitted: donorName,
        donor_postcode_submitted: donorPostcode,
        amount,
        donation_date: donationDate,
        charity_name: charityName,
        charity_hmrc_ref: charityHmrcRef,
        gift_aid_status: 'pending',
        received_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) return send(res, 500, { ok: false, error: error.message })

    return send(res, 200, { ok: true, donationId: donation.id })
  } catch (e: any) {
    return send(res, 500, { ok: false, error: e.message })
  }
}
