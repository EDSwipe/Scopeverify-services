import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, getAuthenticatorAssuranceLevel } from './_supabaseAuth.js'

const ADMIN_EMAIL = process.env.VITE_ADMIN_EMAIL || 'sotbirida@yahoo.fr'

function getServiceClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const caller = await getAuthenticatedUser(request)
  if (!caller) return response.status(401).json({ error: 'Authentication required' })
  if (caller.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return response.status(403).json({ error: 'Only the configured administrator can invite clients' })
  }
  const assurance = await getAuthenticatorAssuranceLevel(request)
  if (!assurance || (assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2')) {
    return response.status(403).json({ error: 'Complete the configured MFA challenge before continuing' })
  }
  const serviceClient = getServiceClient()
  if (!serviceClient) return response.status(503).json({ error: 'Client invitations are not configured on this deployment' })

  const { data: callerProfile, error: callerProfileError } = await serviceClient
    .from('users').select('role,is_active').eq('id', caller.id).maybeSingle()
  if (callerProfileError) return response.status(500).json({ error: 'Could not verify administrator permissions' })
  if (callerProfile?.role !== 'admin' || callerProfile.is_active !== true) {
    return response.status(403).json({ error: 'An active administrator profile is required' })
  }

  const normalizedEmail = String(request.body?.email || '').trim().toLowerCase()
  const fullName = String(request.body?.fullName || '').trim()
  const company = String(request.body?.company || '').trim()
  if (!normalizedEmail || !normalizedEmail.includes('@') || !fullName) {
    return response.status(400).json({ error: 'A valid email and full name are required' })
  }
  if (normalizedEmail === ADMIN_EMAIL.toLowerCase()) {
    return response.status(400).json({ error: 'The configured administrator cannot be invited as a client' })
  }

  try {
    const { data: existingProfile, error: lookupError } = await serviceClient
      .from('users').select('id').eq('email', normalizedEmail).maybeSingle()
    if (lookupError) throw lookupError
    if (existingProfile) return response.status(409).json({ error: 'An account already uses this email' })

    const appUrl = process.env.SITE_URL || 'https://scopeverify-services.com'
    const { data: invitation, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: { full_name: fullName, company, role: 'client' },
      redirectTo: appUrl,
    })
    if (inviteError) throw inviteError
    if (!invitation.user) throw new Error('Supabase did not return the invited user')

    const { error: profileError } = await serviceClient.from('users').insert({
      id: invitation.user.id,
      email: normalizedEmail,
      full_name: fullName,
      company,
      role: 'client',
      is_active: true,
    })
    if (profileError) {
      await serviceClient.auth.admin.deleteUser(invitation.user.id)
      throw profileError
    }

    return response.status(200).json({ userId: invitation.user.id, invitationSent: true })
  } catch (error) {
    const message = error?.message || 'Client invitation failed'
    const status = /already (registered|exists)|already been registered/i.test(message) ? 409 : 500
    console.error('Client invitation failed:', message)
    return response.status(status).json({ error: message })
  }
}