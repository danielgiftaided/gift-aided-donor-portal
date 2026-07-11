// api/admin/requireAdmin.ts
import type { VercelRequest } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Verifies the Bearer token from the request and checks the user carries
// the admin role (set via app_metadata.role in Supabase Auth). Throws if
// unauthenticated or not an admin.
export async function requireAdmin(req: VercelRequest) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) throw new Error('Unauthorised')

  const token = auth.split(' ')[1]

  const anonClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user }, error } = await anonClient.auth.getUser(token)
  if (error || !user) throw new Error('Unauthorised')

  if (user.app_metadata?.role !== 'admin') throw new Error('Forbidden')

  return { admin: user }
}
