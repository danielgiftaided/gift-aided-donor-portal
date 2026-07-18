/**
 * GET /api/platform/check-donor
 *
 * Real-time donor lookup by email. LaunchGood calls this BEFORE showing
 * the donation button, so the result determines the entire donor experience:
 *
 *   registered: true  → Gift Aid applied silently, no donor prompt needed
 *   registered: false → LaunchGood shows "Add Gift Aid" button with registrationUrl
 *
 * Required header: x-api-key
 * Required query:  email
 * Optional query:  name (donor's full name — used to pre-fill registration page)
 *                  campaign_id, campaign_name (for tracking)
 *                  redirect_url (LaunchGood page to return to after registration)
 *
 * Response:
 * {
 *   "ok": true,
 *   "registered": true,
 *   "active": true,
 *   "firstName": "Ahmed"         // only first name returned — privacy
 * }
 * or
 * {
 *   "ok": true,
 *   "registered": false,
 *   "active": false,
 *   "registrationUrl": "https://donors.giftaided.com/quick-register?..."
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requirePlatformKey } from './_requirePlatformKey.js'
import { supabaseAdmin } from '../_utils/supabase.js'

function send(res: VercelResponse, status: number, body: object) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'x-api-key, content-type')
  return res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight from LaunchGood's browser-side JS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'x-api-key, content-type')
    return res.status(200).end()
  }

  try {
    if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' })

    const partner = await requirePlatformKey(req)

    const email = (req.query.email as string || '').trim().toLowerCase()
    if (!email) return send(res, 400, { ok: false, error: 'email is required' })

    // Look up donor by email — join to intermediary_donors to get name and status.
    // We look up via the donor's email field in intermediary_donors which matches
    // the email they used to register their Gift Aid account.
    const { data: donor } = await supabaseAdmin
      .from('intermediary_donors')
      .select('id, first_name, status')
      .eq('email', email)
      .maybeSingle()

    if (donor && donor.status === 'active') {
      // Donor is registered and active — Gift Aid can be applied immediately.
      // Return only the first name for a personalised prompt; never return
      // address or full details to the platform.
      return send(res, 200, {
        ok: true,
        registered: true,
        active: true,
        firstName: donor.first_name,
      })
    }

    if (donor && donor.status === 'cancelled') {
      // Donor is known but has cancelled their authorisation.
      // Offer them the chance to re-register.
      return send(res, 200, {
        ok: true,
        registered: true,
        active: false,
        registrationUrl: buildRegistrationUrl(req),
      })
    }

    // Donor not found — return a registration URL pre-filled with their details
    // so the experience on the registration page is as frictionless as possible.
    return send(res, 200, {
      ok: true,
      registered: false,
      active: false,
      registrationUrl: buildRegistrationUrl(req),
    })

  } catch (e: any) {
    const status = e.message?.includes('API key') ? 401 : 500
    return send(res, status, { ok: false, error: e.message ?? 'Server error' })
  }
}

function buildRegistrationUrl(req: VercelRequest): string {
  const base = process.env.DONOR_PORTAL_URL || 'https://donors.giftaided.com'
  const params = new URLSearchParams()

  // Pass through query params LaunchGood included, so the registration page
  // can pre-fill the donor's name and return them to the right place.
  const passThrough = ['email', 'name', 'campaign_id', 'campaign_name', 'redirect_url']
  for (const key of passThrough) {
    const val = req.query[key] as string | undefined
    if (val) params.set(key, val)
  }

  return `${base}/quick-register?${params.toString()}`
}
