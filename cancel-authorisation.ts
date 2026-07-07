import type { VercelRequest } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabase.js'

// Verifies the Bearer token from the request, returns the donor's
// profile row. Throws if unauthenticated or if no donor profile exists.
export async function requireDonor(req: VercelRequest) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) throw new Error('Unauthorised')

  const token = auth.split(' ')[1]

  // Use the anon key + token to get the authenticated user
  const anonClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user }, error } = await anonClient.auth.getUser(token)
  if (error || !user) throw new Error('Unauthorised')

  const { data: donor, error: donorErr } = await supabaseAdmin
    .from('intermediary_donors')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (donorErr || !donor) throw new Error('DONOR_NOT_FOUND')

  return { user, donor }
}
