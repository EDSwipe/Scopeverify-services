import { createClient } from '@supabase/supabase-js'

// Shared helper for /api serverless functions (filename starts with "_" so
// Vercel does not expose it as its own route). Verifies the caller passed a
// valid Supabase session token, so these notification endpoints can't be used
// as an anonymous open email relay.
export async function getAuthenticatedUser(request) {
  const authHeader = request.headers.authorization || request.headers.Authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !supabaseUrl || !supabaseAnonKey) return null

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
