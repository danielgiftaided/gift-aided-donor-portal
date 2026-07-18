import type { VercelRequest } from '@vercel/node'
import { createHash } from 'crypto'
import { supabaseAdmin } from '../_utils/supabase.js'

export async function requirePlatformKey(req: VercelRequest) {
  const rawKey = req.headers['x-api-key'] as string | undefined
  if (!rawKey) throw new Error('Missing x-api-key header')

  const hash = createHash('sha256').update(rawKey).digest('hex')

  const { data: partner, error } = await supabaseAdmin
    .from('platform_partners')
    .select('id, name, status, webhook_url')
    .eq('api_key_hash', hash)
    .eq('status', 'active')
    .single()

  if (error || !partner) throw new Error('Invalid or inactive API key')

  return partner
}
