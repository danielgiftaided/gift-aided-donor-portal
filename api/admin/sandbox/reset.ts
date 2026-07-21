/**
 * POST /api/admin/sandbox/reset
 *
 * Resets the sandbox environment by deleting all test donor data
 * and re-inserting the three standard test scenarios.
 *
 * Only works when SANDBOX_MODE=true — completely inert in production.
 * Requires admin authentication.
 *
 * LaunchGood developers can trigger this themselves via the
 * sandbox admin console, or Gift Aided can trigger it on their behalf.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../_utils/supabase.js'
import { requireAdmin } from '../requireAdmin.js'

function send(res: VercelResponse, status: number, body: object) {
  return res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hard guard — this endpoint does nothing outside sandbox
  if (process.env.SANDBOX_MODE !== 'true') {
    return send(res, 403, {
      ok: false,
      error: 'This endpoint is only available in the sandbox environment. SANDBOX_MODE must be true.',
    })
  }

  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' })
    await requireAdmin(req)

    // ── Step 1: Delete all test data ──────────────────────────────────────
    await supabaseAdmin.from('platform_donations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('donor_authorisations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('intermediary_donors').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Also delete auth users created during testing
    const { data: users } = await supabaseAdmin.auth.admin.listUsers()
    for (const user of (users?.users || [])) {
      // Keep the admin user, delete test users
      if (user.email?.includes('@test.giftaided.com') || user.email?.includes('@test.')) {
        await supabaseAdmin.auth.admin.deleteUser(user.id)
      }
    }

    // ── Step 2: Reseed Scenario 1 — Active registered donor ───────────────
    const { data: s1User } = await supabaseAdmin.auth.admin.createUser({
      email: 'sandbox-active@test.giftaided.com',
      password: 'SandboxTest2026!',
      email_confirm: true,
      user_metadata: { first_name: 'Sarah', last_name: 'TestDonor' },
    })

    if (s1User?.user) {
      const { data: s1Donor } = await supabaseAdmin
        .from('intermediary_donors')
        .insert({
          user_id: s1User.user.id,
          first_name: 'Sarah', last_name: 'TestDonor',
          address: '1 Test Street, London', postcode: 'EC1A 1BB',
          email: 'sandbox-active@test.giftaided.com', status: 'active',
        })
        .select('id').single()

      if (s1Donor) {
        await supabaseAdmin.from('donor_authorisations').insert({
          donor_id: s1Donor.id,
          explanation_shown_at: new Date(Date.now() - 90 * 86400000).toISOString(),
          authorisation_date:   new Date(Date.now() - 90 * 86400000).toISOString(),
          tax_year_from: '2025/26', tax_year_to: '2026/27',
          source: 'direct', status: 'active',
        })

        // Add a sample matched donation
        const { data: partner } = await supabaseAdmin
          .from('platform_partners').select('id').eq('name', 'LaunchGood Sandbox').single()

        if (partner) {
          await supabaseAdmin.from('platform_donations').insert({
            platform_partner_id: partner.id,
            platform_donation_ref: 'SANDBOX-DON-RESET-001',
            charity_hmrc_ref: 'TEST12345',
            charity_name: 'Gift Aided Test Charity',
            donor_name_submitted: 'Sarah TestDonor',
            donor_postcode_submitted: 'EC1A 1BB',
            donor_email_submitted: 'sandbox-active@test.giftaided.com',
            amount: 100.00,
            donation_date: new Date().toISOString().split('T')[0],
            matched_donor_id: s1Donor.id,
            declaration_created_at: new Date().toISOString(),
            gift_aid_status: 'matched',
          })
        }
      }
    }

    // ── Step 3: Reseed Scenario 2 — Cancelled donor ────────────────────────
    const { data: s2User } = await supabaseAdmin.auth.admin.createUser({
      email: 'sandbox-cancelled@test.giftaided.com',
      password: 'SandboxTest2026!',
      email_confirm: true,
      user_metadata: { first_name: 'Ahmed', last_name: 'TestDonor' },
    })

    if (s2User?.user) {
      const { data: s2Donor } = await supabaseAdmin
        .from('intermediary_donors')
        .insert({
          user_id: s2User.user.id,
          first_name: 'Ahmed', last_name: 'TestDonor',
          address: '2 Test Avenue, Manchester', postcode: 'M1 1AE',
          email: 'sandbox-cancelled@test.giftaided.com',
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Test cancellation scenario',
        })
        .select('id').single()

      if (s2Donor) {
        await supabaseAdmin.from('donor_authorisations').insert({
          donor_id: s2Donor.id,
          explanation_shown_at: new Date(Date.now() - 180 * 86400000).toISOString(),
          authorisation_date:   new Date(Date.now() - 180 * 86400000).toISOString(),
          tax_year_from: '2025/26', tax_year_to: '2025/26',
          source: 'direct', status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Test cancellation scenario',
        })
      }
    }

    return send(res, 200, {
      ok: true,
      message: 'Sandbox reset complete. Three test scenarios restored.',
      scenarios: {
        scenario1: {
          description: 'Active registered donor',
          email: 'sandbox-active@test.giftaided.com',
          expectedResponse: { registered: true, active: true },
        },
        scenario2: {
          description: 'Registered but cancelled donor',
          email: 'sandbox-cancelled@test.giftaided.com',
          expectedResponse: { registered: true, active: false },
        },
        scenario3: {
          description: 'Unregistered donor',
          email: 'any-other-email@example.com',
          expectedResponse: { registered: false, registrationUrl: '...' },
        },
      },
    })

  } catch (e: any) {
    return send(res, 500, { ok: false, error: e.message ?? 'Reset failed' })
  }
}
