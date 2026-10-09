import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { ModeratorPermission, User } from '../../types'
import { defaultModeratorPermissions, moderatorPermissionOptions } from '../../lib/permissions'
import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../supabase'
import './AdminTeamAccess.css'

type ModeratorUser = Pick<User, 'id' | 'email' | 'full_name' | 'is_active' | 'created_at' | 'permissions'>
type ModeratorDraft = { email: string; fullName: string; permissions: ModeratorPermission[] }

const freshDraft = (): ModeratorDraft => ({ email: '', fullName: '', permissions: [...defaultModeratorPermissions] })

export default function AdminTeamAccess() {
  const [moderators, setModerators] = useState<ModeratorUser[]>([])
  const [draft, setDraft] = useState<ModeratorDraft>(freshDraft)
  const [permissionEdits, setPermissionEdits] = useState<Record<string, ModeratorPermission[]>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadModerators = useCallback(async () => {
    if (!supabase) return
    try {
      const { data, error: queryError } = await supabase
        .from('users')
        .select('id,email,full_name,is_active,created_at,permissions')
        .eq('role', 'moderator')
        .order('created_at', { ascending: false })
      if (queryError) throw queryError
      const results = (data || []) as ModeratorUser[]
      setModerators(results)
      setPermissionEdits(Object.fromEntries(results.map((user) => [user.id, user.permissions || []])))
    } catch (err) {
      setError(getErrorMessage(err) || 'Chargement de l’équipe impossible.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void Promise.resolve().then(() => loadModerators()) }, [loadModerators])

  const togglePermission = (current: ModeratorPermission[], permission: ModeratorPermission) => {
    const next = current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]
    if (permission === 'partners.review' && !next.includes(permission)) {
      return next.filter((item) => item !== 'partners.documents')
    }
    if (permission === 'partners.documents' && !next.includes('partners.review')) {
      next.push('partners.review')
    }
    return next
  }

  const sendAdminRequest = async (payload: Record<string, unknown>) => {
    if (!supabase) throw new Error('Supabase n’est pas configuré.')
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const accessToken = sessionData.session?.access_token
    if (!accessToken) throw new Error('Session administrateur expirée. Reconnectez-vous.')

    const response = await fetch('/api/admin-moderators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || `Erreur serveur (${response.status})`)
    return result
  }

  const inviteModerator = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsInviting(true)
    setError('')
    setNotice('')
    try {
      const result = await sendAdminRequest({
        action: 'invite',
        email: draft.email.trim().toLowerCase(),
        fullName: draft.fullName.trim(),
        permissions: draft.permissions,
      })
      setNotice(result.invitationSent
        ? `Invitation envoyée à ${draft.email.trim()}. Le modérateur devra accepter l’email pour activer son compte.`
        : `Les droits du modérateur ${draft.email.trim()} ont été actualisés.`)
      setDraft(freshDraft())
      await loadModerators()
    } catch (err) {
      setError(getErrorMessage(err) || 'Invitation impossible.')
    } finally {
      setIsInviting(false)
    }
  }

  const saveModeratorPermissions = async (user: ModeratorUser) => {
    setSavingId(user.id)
    setError('')
    setNotice('')
    try {
      const permissions = permissionEdits[user.id] || []
      await sendAdminRequest({ action: 'permissions', userId: user.id, permissions })
      setNotice(`Droits mis à jour pour ${user.email}.`)
      await loadModerators()
    } catch (err) {
      setError(getErrorMessage(err) || 'Mise à jour des droits impossible.')
    } finally {
      setSavingId('')
    }
  }

  const toggleModeratorActive = async (user: ModeratorUser) => {
    if (!supabase) return
    setSavingId(user.id)
    setError('')
    setNotice('')
    try {
      const { error: updateError } = await supabase.from('users')
        .update({ is_active: !user.is_active, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (updateError) throw updateError
      setNotice(user.is_active ? `Accès désactivé pour ${user.email}.` : `Accès réactivé pour ${user.email}.`)
      await loadModerators()
    } catch (err) {
      setError(getErrorMessage(err) || 'Modification du compte impossible.')
    } finally {
      setSavingId('')
    }
  }

  if (loading) return <section className="team-access-loading">Chargement des accès…</section>

  return <section className="team-access">
    <header className="team-access-header">
      <div><p className="team-access-kicker">ADMINISTRATION · ACCÈS</p><h2>Équipe & droits</h2><p>Invitez des modérateurs et attribuez uniquement les accès nécessaires à leur mission.</p></div>
    </header>
    {error && <p className="team-access-message error" role="alert">{error}</p>}
    {notice && <p className="team-access-message success" role="status">{notice}</p>}

    <form className="team-invite-form" onSubmit={inviteModerator}>
      <div className="team-invite-heading"><div><h3>Inviter un modérateur</h3><p>Un lien d’invitation sera envoyé par Supabase Auth. Aucun mot de passe n’est saisi ni visible par l’admin.</p></div></div>
      <div className="team-invite-fields">
        <label>Nom complet<input required value={draft.fullName} onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))} autoComplete="name" /></label>
        <label>Email professionnel<input required type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} autoComplete="email" /></label>
      </div>
      <fieldset className="team-permission-options">
        <legend>Droits à attribuer</legend>
        {moderatorPermissionOptions.map((option) => <label key={option.value}>
          <input type="checkbox" checked={draft.permissions.includes(option.value)} onChange={() => setDraft((current) => ({ ...current, permissions: togglePermission(current.permissions, option.value) }))} />
          <span><strong>{option.label}</strong><small>{option.description}</small></span>
        </label>)}
      </fieldset>
      <button className="team-primary" type="submit" disabled={isInviting || !draft.email || !draft.fullName || !draft.permissions.includes('partners.review')}>
        {isInviting ? 'Envoi de l’invitation…' : 'Envoyer l’invitation'}
      </button>
    </form>

    <section className="team-moderator-list">
      <header><h3>Modérateurs ({moderators.length})</h3><p>Les comptes désactivés ne peuvent plus ouvrir leur espace.</p></header>
      {moderators.length === 0 ? <p className="team-empty">Aucun modérateur pour le moment.</p> : moderators.map((user) => {
        const permissions = permissionEdits[user.id] || []
        return <article className="team-moderator" key={user.id}>
          <div className="team-moderator-head"><div><strong>{user.full_name || user.email}</strong><span>{user.email}</span></div><span className={user.is_active ? 'team-status active' : 'team-status inactive'}>{user.is_active ? 'Actif' : 'Désactivé'}</span></div>
          <fieldset className="team-permission-options compact"><legend>Droits</legend>
            {moderatorPermissionOptions.map((option) => <label key={option.value}>
              <input type="checkbox" checked={permissions.includes(option.value)} onChange={() => setPermissionEdits((current) => ({ ...current, [user.id]: togglePermission(permissions, option.value) }))} />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </label>)}
          </fieldset>
          <div className="team-moderator-actions"><button className="team-primary" disabled={savingId === user.id || JSON.stringify(permissions) === JSON.stringify(user.permissions || [])} onClick={() => void saveModeratorPermissions(user)}>{savingId === user.id ? 'Enregistrement…' : 'Enregistrer les droits'}</button><button className="team-secondary" disabled={savingId === user.id} onClick={() => void toggleModeratorActive(user)}>{user.is_active ? 'Désactiver l’accès' : 'Réactiver l’accès'}</button></div>
        </article>
      })}
    </section>
  </section>
}
