/**
 * Creates the donor profile and initial authorisation record.
 *
 * Called in two scenarios:
 * 1. After email confirmation — body is empty, profile data is read from
 *    user.user_metadata (stored during signUp with options.data).
 * 2. Direct call with body fields — used for testing or future flows.
 *
 * Idempotent — safe to call twice. Returns 200 if profile already exists.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../_utils/supabase.js'
import { sendEmail, buildFullRegistrationWelcome } from '../_utils/mailer.js'

function send(res: VercelResponse, status: number, body: object) {
  return res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' })

    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return send(res, 401, { ok: false, error: 'Unauthorised' })
    const token = auth.split(' ')[1]

    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token)
    if (authErr || !user) return send(res, 401, { ok: false, error: 'Unauthorised' })

    // Check if profile already exists — idempotent
    const { data: existing } = await supabaseAdmin
      .from('intermediary_donors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return send(res, 200, { ok: true, donorId: existing.id, alreadyExists: true })
    }

    // Read profile data from request body, falling back to user metadata
    // (which was stored during signUp using options.data).
    const body = (() => {
      try {
        return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
      } catch { return {} }
    })()

    const meta = user.user_metadata || {}

    const firstName             = String(body.firstName          || meta.first_name         || '').trim()
    const lastName              = String(body.lastName           || meta.last_name          || '').trim()
    const address               = String(body.address            || meta.address            || '').trim()
    const postcode              = String(body.postcode           || meta.postcode           || '').trim().toUpperCase()
    const explanationShownAt    = String(body.explanationShownAt || meta.explanation_shown_at || new Date().toISOString())
    const authorisationDate     = String(body.authorisationDate  || meta.authorisation_date  || new Date().toISOString())
    const taxYearFrom           = String(body.taxYearFrom        || meta.tax_year_from      || getCurrentTaxYear())
    const taxYearTo             = String(body.taxYearTo          || meta.tax_year_to        || getCurrentTaxYear())

    if (!firstName || !lastName || !address || !postcode) {
      return send(res, 400, {
        ok: false,
        error: 'Missing required profile fields. These should have been stored in user metadata during registration.',
      })
    }

    const { data: donor, error: donorErr } = await supabaseAdmin
      .from('intermediary_donors')
      .insert({
        user_id:    user.id,
        first_name: firstName,
        last_name:  lastName,
        address,
        postcode,
        email:      user.email,
        status:     'active',
      })
      .select('id')
      .single()

    if (donorErr || !donor) {
      return send(res, 500, { ok: false, error: donorErr?.message || 'Failed to create donor profile' })
    }

    const { error: authRecordErr } = await supabaseAdmin
      .from('donor_authorisations')
      .insert({
        donor_id:             donor.id,
        explanation_shown_at: explanationShownAt,
        authorisation_date:   authorisationDate,
        tax_year_from:        taxYearFrom,
        tax_year_to:          taxYearTo,
        source:               'direct',
        ip_address:           (req.headers['x-forwarded-for'] as string) || null,
        status:               'active',
      })

    if (authRecordErr) {
      return send(res, 500, { ok: false, error: authRecordErr.message })
    }

    // Send welcome email — non-blocking so a send failure doesn't
    // prevent the registration from completing successfully.
    const emailName = String(firstName || meta.first_name || '').trim()
    sendEmail({
      to: user.email!,
      subject: 'Welcome to Gift Aided — your Gift Aid is now active',
      html: buildFullRegistrationWelcome(emailName),
    }).catch(err => {
      console.error('Welcome email failed (non-fatal):', err?.message)
    })

    return send(res, 200, { ok: true, donorId: donor.id })

  } catch (e: any) {
    return send(res, 500, { ok: false, error: e.message ?? 'Server error' })
  }
}

function getCurrentTaxYear(): string {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate()
  if (m > 4 || (m === 4 && d >= 6)) return `${y}/${String(y + 1).slice(2)}`
  return `${y - 1}/${String(y).slice(2)}`
}
