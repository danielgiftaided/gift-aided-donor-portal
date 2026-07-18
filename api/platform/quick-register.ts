/**
 * POST /api/platform/quick-register
 *
 * Creates a Gift Aid registration in a single API call, bypassing email
 * verification and MFA. Used by the micro-registration widget when a donor
 * completes the quick-register form during a LaunchGood donation.
 *
 * The donor's Supabase auth account is created with email_confirm: true
 * (no verification email required). A "complete your account" email is
 * sent separately after the donation is confirmed, non-blocking.
 *
 * Auth: x-api-key header (platform partner key)
 *
 * Body:
 * {
 *   email, firstName, lastName, address, postcode,
 *   campaignId?, campaignName?, charityHmrcRef?
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requirePlatformKey } from './_requirePlatformKey.js'
import { supabaseAdmin } from '../_utils/supabase.js'
import { randomBytes } from 'crypto'

function send(res: VercelResponse, status: number, body: object) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'x-api-key, content-type')
  return res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'x-api-key, content-type')
    return res.status(200).end()
  }

  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' })

    const partner = await requirePlatformKey(req)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    const {
      email, firstName, lastName, address, postcode,
      campaignId, campaignName, charityHmrcRef,
    } = body

    if (!email || !firstName || !lastName || !address || !postcode) {
      return send(res, 400, { ok: false, error: 'email, firstName, lastName, address and postcode are all required' })
    }

    const emailClean    = String(email).trim().toLowerCase()
    const firstNameClean = String(firstName).trim()
    const lastNameClean  = String(lastName).trim()
    const addressClean   = String(address).trim()
    const postcodeClean  = String(postcode).trim().toUpperCase()

    // Check if a donor is already registered with this email
    const { data: existing } = await supabaseAdmin
      .from('intermediary_donors')
      .select('id, status')
      .eq('email', emailClean)
      .maybeSingle()

    if (existing && existing.status === 'active') {
      return send(res, 200, { ok: true, alreadyRegistered: true, donorId: existing.id })
    }

    const now          = new Date()
    const taxYearFrom  = getTaxYear(now)
    const taxYearTo    = now.getMonth() >= 2 ? getNextTaxYear(taxYearFrom) : taxYearFrom

    // Generate a secure random temporary password.
    // The donor never uses this directly — they set their own password
    // via the "complete your account" email link sent afterwards.
    const tempPassword = randomBytes(24).toString('base64')

    // Create Supabase auth user with email_confirm:true — no verification
    // email is sent, the account is immediately active.
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: emailClean,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name:          firstNameClean,
        last_name:           lastNameClean,
        address:             addressClean,
        postcode:            postcodeClean,
        source:              `platform:${partner.name}`,
        explanation_shown_at: now.toISOString(),
        authorisation_date:   now.toISOString(),
        tax_year_from:        taxYearFrom,
        tax_year_to:          taxYearTo,
      },
    })

    if (authErr) {
      // If the auth user already exists but has no donor profile,
      // look them up and create the profile below.
      if (!authErr.message?.includes('already been registered')) {
        return send(res, 500, { ok: false, error: authErr.message })
      }
    }

    const userId = authData?.user?.id
    if (!userId) return send(res, 500, { ok: false, error: 'Could not create user account' })

    // Create donor profile
    const { data: donor, error: donorErr } = await supabaseAdmin
      .from('intermediary_donors')
      .insert({
        user_id:    userId,
        first_name: firstNameClean,
        last_name:  lastNameClean,
        address:    addressClean,
        postcode:   postcodeClean,
        email:      emailClean,
        status:     'active',
      })
      .select('id')
      .single()

    if (donorErr || !donor) {
      return send(res, 500, { ok: false, error: donorErr?.message || 'Failed to create donor profile' })
    }

    // Create authorisation record with the legal explanation timestamp.
    // For the quick-register flow, the explanation is shown on the
    // micro-registration page itself, so we record that timestamp here.
    const { error: authRecordErr } = await supabaseAdmin
      .from('donor_authorisations')
      .insert({
        donor_id:             donor.id,
        explanation_shown_at: now.toISOString(),
        authorisation_date:   now.toISOString(),
        tax_year_from:        taxYearFrom,
        tax_year_to:          taxYearTo,
        source:               'platform',
        platform_id:          partner.id,
        status:               'active',
      })

    if (authRecordErr) {
      return send(res, 500, { ok: false, error: authRecordErr.message })
    }

    // If a charity HMRC ref was provided, immediately create a platform donation
    // record so this donation is queued for Gift Aid matching.
    if (charityHmrcRef) {
      await supabaseAdmin.from('platform_donations').insert({
        platform_partner_id:     partner.id,
        charity_hmrc_ref:        charityHmrcRef,
        donor_name_submitted:    `${firstNameClean} ${lastNameClean}`,
        donor_postcode_submitted: postcodeClean,
        donor_email_submitted:   emailClean,
        matched_donor_id:        donor.id,
        campaign_id:             campaignId || null,
        campaign_name:           campaignName || null,
        amount:                  0,       // actual amount sent separately via donation webhook
        donation_date:           now.toISOString().split('T')[0],
        gift_aid_status:         'matched',
        declaration_created_at:  now.toISOString(),
      })
    }

    // Send "complete your account" email via Supabase magic link
    // This is non-blocking — registration is confirmed regardless of whether
    // this email succeeds.
    supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: emailClean,
      options: {
        redirectTo: `${process.env.DONOR_PORTAL_URL || 'https://donors.giftaided.com'}/mfa-setup`,
      },
    }).catch(() => {
      // Non-fatal — donor can request a new link later
    })

    return send(res, 200, {
      ok: true,
      donorId: donor.id,
      alreadyRegistered: false,
      message: 'Gift Aid registration created successfully',
    })

  } catch (e: any) {
    const status = e.message?.includes('API key') ? 401 : 500
    return send(res, status, { ok: false, error: e.message ?? 'Server error' })
  }
}

function getTaxYear(date: Date): string {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate()
  if (m > 4 || (m === 4 && d >= 6)) return `${y}/${String(y + 1).slice(2)}`
  return `${y - 1}/${String(y).slice(2)}`
}
function getNextTaxYear(ty: string): string {
  const start = parseInt(ty.split('/')[0], 10) + 1
  return `${start}/${String(start + 1).slice(2)}`
}
