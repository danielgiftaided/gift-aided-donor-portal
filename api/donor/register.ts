/**
 * Creates the donor profile and initial authorisation record after the
 * Supabase auth user has been created client-side during registration.
 *
 * The explanation_shown_at timestamp is recorded client-side when step 2
 * renders and sent here — this is correct per SI 2016/1195, which requires
 * the date the explanation was GIVEN, not the date the donor clicked confirm.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../_utils/supabase.js'

function send(res: VercelResponse, status: number, body: object) {
  return res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' })

    // Authenticate the newly-created user
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return send(res, 401, { ok: false, error: 'Unauthorised' })
    const token = auth.split(' ')[1]

    const anonClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token)
    if (authErr || !user) return send(res, 401, { ok: false, error: 'Unauthorised' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { firstName, lastName, address, postcode, explanationShownAt, authorisationDate, taxYearFrom, taxYearTo } = body

    if (!firstName || !lastName || !address || !postcode) {
      return send(res, 400, { ok: false, error: 'Missing required fields' })
    }
    if (!explanationShownAt || !authorisationDate || !taxYearFrom || !taxYearTo) {
      return send(res, 400, { ok: false, error: 'Missing authorisation timestamps — required by Gift Aid Declarations Regulations 2016' })
    }

    // Check if a profile already exists (idempotent — safe to call twice)
    const { data: existing } = await supabaseAdmin
      .from('intermediary_donors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    let donorId: string

    if (existing) {
      donorId = existing.id
    } else {
      const { data: donor, error: donorErr } = await supabaseAdmin
        .from('intermediary_donors')
        .insert({
          user_id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          address: address.trim(),
          postcode: postcode.trim().toUpperCase(),
          email: user.email,
          status: 'active',
        })
        .select('id')
        .single()

      if (donorErr || !donor) {
        return send(res, 500, { ok: false, error: donorErr?.message || 'Failed to create donor profile' })
      }
      donorId = donor.id
    }

    // Create the authorisation record.
    // explanation_shown_at is the moment the legal explanation was displayed
    // to the donor — required to be stored per SI 2016/1195 regulation 6.
    const { error: authRecordErr } = await supabaseAdmin
      .from('donor_authorisations')
      .insert({
        donor_id: donorId,
        explanation_shown_at: explanationShownAt,
        authorisation_date: authorisationDate,
        tax_year_from: taxYearFrom,
        tax_year_to: taxYearTo,
        source: 'direct',
        ip_address: req.headers['x-forwarded-for'] as string || null,
        status: 'active',
      })

    if (authRecordErr) {
      return send(res, 500, { ok: false, error: authRecordErr.message })
    }

    return send(res, 200, { ok: true, donorId })

  } catch (e: any) {
    return send(res, 500, { ok: false, error: e.message ?? 'Server error' })
  }
}
