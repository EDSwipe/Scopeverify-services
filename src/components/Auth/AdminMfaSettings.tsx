import { useEffect, useState, type FormEvent } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../supabase'
import './AdminMfaSettings.css'

type MfaState = 'loading' | 'disabled' | 'enrolling' | 'enabled'

export default function AdminMfaSettings() {
  const [state, setState] = useState<MfaState>('loading')
  const [factorIds, setFactorIds] = useState<string[]>([])
  const [pendingFactorId, setPendingFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [manualSecret, setManualSecret] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadFactors = async () => {
    if (!supabase) throw new Error('Service d’authentification indisponible.')
    const { data, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) throw listError
    const verified = data.totp.filter((factor) => factor.status === 'verified')
    setFactorIds(verified.map((factor) => factor.id))
    setState(verified.length ? 'enabled' : 'disabled')
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadFactors()).catch((err) => {
      setError(getErrorMessage(err) || 'Impossible de vérifier la configuration MFA.')
      setState('disabled')
    })
  }, [])

  const beginEnrollment = async () => {
    if (!supabase || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Scope-Verify Admin',
        issuer: 'Scope-Verify',
      })
      if (enrollError) throw enrollError
      setPendingFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setManualSecret(data.totp.secret)
      setState('enrolling')
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible de démarrer la configuration MFA.')
    } finally {
      setBusy(false)
    }
  }

  const verifyEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !pendingFactorId || busy) return
    setBusy(true)
    setError('')
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingFactorId,
        code: code.replace(/\s/g, ''),
      })
      if (verifyError) throw verifyError
      setPendingFactorId('')
      setCode('')
      setQrCode('')
      setManualSecret('')
      await loadFactors()
      setNotice('La double authentification est activée. Elle sera demandée à ta prochaine connexion.')
    } catch (err) {
      setError(getErrorMessage(err) || 'Code invalide. Réessaie avec un nouveau code.')
    } finally {
      setBusy(false)
    }
  }

  const cancelEnrollment = async () => {
    if (!supabase || !pendingFactorId || busy) return
    setBusy(true)
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: pendingFactorId })
      if (unenrollError) throw unenrollError
      setPendingFactorId('')
      setQrCode('')
      setManualSecret('')
      setCode('')
      setState('disabled')
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible d’annuler la configuration MFA.')
    } finally {
      setBusy(false)
    }
  }

  const disableMfa = async () => {
    if (!supabase || !factorIds.length || busy) return
    if (!window.confirm('Désactiver la MFA sur ce compte admin ?')) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      for (const factorId of factorIds) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId })
        if (unenrollError) throw unenrollError
      }
      await loadFactors()
      setNotice('La double authentification est désactivée. Le compte admin utilisera uniquement son mot de passe.')
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible de désactiver la MFA.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="admin-mfa-settings" aria-labelledby="admin-mfa-title">
    <div>
      <p className="admin-mfa-settings-kicker">SÉCURITÉ DU COMPTE</p>
      <h3 id="admin-mfa-title">Double authentification (MFA)</h3>
      <p>Optionnelle. Si elle est activée, un code de ton application d’authentification sera requis à chaque nouvelle connexion Admin.</p>
    </div>

    {state === 'loading' ? <p>Vérification…</p> : state === 'enabled' ? <div className="admin-mfa-settings-actions">
      <strong className="admin-mfa-enabled">Activée</strong>
      <button type="button" className="admin-mfa-secondary" onClick={() => void disableMfa()} disabled={busy}>
        {busy ? 'Mise à jour…' : 'Désactiver la MFA'}
      </button>
    </div> : state === 'disabled' ? <button type="button" onClick={() => void beginEnrollment()} disabled={busy}>
      {busy ? 'Préparation…' : 'Activer la MFA'}
    </button> : <div className="admin-mfa-enrollment">
      <div className="admin-mfa-qr"><img src={qrCode} alt="QR code à scanner dans une application d’authentification" /></div>
      <p>Scanne le QR code avec une application d’authentification, puis saisis son code à six chiffres. Garde la clé manuelle secrète.</p>
      <p className="admin-mfa-secret">Clé manuelle : <strong>{manualSecret}</strong></p>
      <form onSubmit={verifyEnrollment}>
        <label>Code d’authentification
          <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" value={code} onChange={(event) => setCode(event.target.value)} required disabled={busy} />
        </label>
        <button type="submit" disabled={busy || code.replace(/\s/g, '').length < 6}>{busy ? 'Vérification…' : 'Confirmer et activer'}</button>
        <button className="admin-mfa-secondary" type="button" onClick={() => void cancelEnrollment()} disabled={busy}>Annuler</button>
      </form>
    </div>}

    {error && <p className="admin-mfa-settings-error" role="alert">{error}</p>}
    {notice && <p className="admin-mfa-settings-notice" role="status">{notice}</p>}
  </section>
}