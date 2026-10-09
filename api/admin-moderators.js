import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, getAuthenticatorAssuranceLevel } from './_supabaseAuth.js'

const ADMIN_EMAIL = process.env.VITE_ADMIN_EMAIL || 'sotbirida@yahoo.fr'
const allowedPermissions = new Set([
  'partners.review',
  'partners.documents',
])

function normalizePermissions(value) {
  if (!Array.isArray(value) || value.some((permission) => !allowedPermissions.has(permission))) return null
  const permissions = [...new Set(value)]
  if (permissions.includes('partners.documents') && !permissions.includes('partners.review')) {
    permissions.push('partners.review')
  }
  return permissions
}

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
    return response.status(403).json({ error: 'Only the configured administrator can manage moderators' })
  }
  const assurance = await getAuthenticatorAssuranceLevel(request)
  if (!assurance || (assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2')) {
    return response.status(403).json({ error: 'Complete the configured MFA challenge before continuing' })
  }
  const serviceClient = getServiceClient()
  if (!serviceClient) {
    return response.status(503).json({ error: 'Moderator invitations are not configured on this deployment' })
  }

  const { data: callerProfile, error: callerProfileError } = await serviceClient
    .from('users').select('role,is_active').eq('id', caller.id).maybeSingle()
  if (callerProfileError) return response.status(500).json({ error: 'Could not verify administrator permissions' })
  if (callerProfile?.role !== 'admin' || callerProfile.is_active !== true) {
    return response.status(403).json({ error: 'An active administrator profile is required' })
  }

  const { action, email, fullName, permissions, userId } = request.body ?? {}
  const normalizedPermissions = normalizePermissions(permissions)
  if (!normalizedPermissions) return response.status(400).json({ error: 'Invalid moderator permissions' })

  try {
    if (action === 'invite') {
      const normalizedEmail = String(email || '').trim().toLowerCase()
      const normalizedName = String(fullName || '').trim()
      if (!normalizedEmail || !normalizedName || !normalizedEmail.includes('@')) {
        return response.status(400).json({ error: 'A valid email and full name are required' })
      }
      if (normalizedEmail === ADMIN_EMAIL.toLowerCase()) {
        return response.status(400).json({ error: 'The configured administrator cannot be invited as a moderator' })
      }

      const { data: existingProfile, error: lookupError } = await serviceClient
        .from('users').select('id,role').eq('email', normalizedEmail).maybeSingle()
      if (lookupError) throw lookupError

      let profileId
      let invitationSent = false
      if (existingProfile) {
        if (existingProfile.role !== 'moderator') {
          return response.status(409).json({ error: 'An account already uses this email. Change its role from the user management list instead.' })
        }
        profileId = existingProfile.id
        const { error: updateError } = await serviceClient.from('users').update({
          full_name: normalizedName,
          role: 'moderator',
          is_active: true,
          permissions: normalizedPermissions,
          updated_at: new Date().toISOString(),
        }).eq('id', profileId)
        if (updateError) throw updateError
      } else {
        const appUrl = process.env.SITE_URL || 'https://scopeverify-services.com'
        const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(normalizedEmail, {
          data: { full_name: normalizedName, role: 'moderator' },
          redirectTo: appUrl,
        })
        if (inviteError) throw inviteError
        if (!invited.user) throw new Error('Supabase did not return the invited user')
        profileId = invited.user.id
        invitationSent = true

        const { error: profileError } = await serviceClient.from('users').upsert({
          id: profileId,
          email: normalizedEmail,
          full_name: normalizedName,
          company: '',
          role: 'moderator',
          is_active: true,
          permissions: normalizedPermissions,
        }, { onConflict: 'id' })
        if (profileError) {
          await serviceClient.auth.admin.deleteUser(profileId)
          throw profileError
        }
      }

      await serviceClient.from('user_access_audit').insert({
        user_id: profileId,
        action: invitationSent ? 'moderator_invited' : 'moderator_permissions_updated',
        permissions: normalizedPermissions,
        changed_by: caller.id,
      })
      return response.status(200).json({ userId: profileId, invitationSent })
    }

    if (action === 'permissions') {
      if (!userId) return response.status(400).json({ error: 'Moderator user ID is required' })
      const { data: moderator, error: moderatorError } = await serviceClient
        .from('users').select('id,role').eq('id', userId).single()
      if (moderatorError) throw moderatorError
      if (moderator.role !== 'moderator') return response.status(400).json({ error: 'Target account is not a moderator' })

      const { error: updateError } = await serviceClient.from('users').update({
        permissions: normalizedPermissions,
        updated_at: new Date().toISOString(),
      }).eq('id', userId)
      if (updateError) throw updateError
      await serviceClient.from('user_access_audit').insert({
        user_id: userId,
        action: 'moderator_permissions_updated',
        permissions: normalizedPermissions,
        changed_by: caller.id,
      })
      return response.status(200).json({ userId, permissions: normalizedPermissions })
    }

    return response.status(400).json({ error: 'Unsupported action' })
  } catch (error) {
    console.error('Moderator management failed:', error)
    return response.status(500).json({ error: error?.message || 'Moderator management failed' })
  }
}
