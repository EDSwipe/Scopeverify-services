import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../supabase'
import './AdminMfaGate.css'

type GateState = 'loading' | 'allowed' | 'verify' | 'unsupported'

export default function AdminMfaGate({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const [state, setState] = useState<GateState>('loading')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const checkFactor = async () => {
    if (!supabase) throw new Error('Service d’authentification indisponible.')
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assuranceError) throw assuranceError
    if (assurance.currentLevel === 'aal2' || assurance.nextLevel !== 'aal2') {
      setState('allowed')
      return
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
    if (factorsError) throw factorsError
    const verifiedFactor = factors.totp.find((factor) => factor.status === 'verified')
    if (!verifiedFactor) {
      setState('unsupported')
      return
    }
    setFactorId(verifiedFactor.id)
    setState('verify')
  }

  useEffect(() => {
    void Promise.resolve().then(() => checkFactor()).catch((err) => {
      setError(getErrorMessage(err) || 'Impossible de vérifier la MFA.')
      setState('unsupported')
    })
  }, [])

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !factorId || busy) return
    setBusy(true)
    setError('')
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') })
      if (verifyError) throw verifyError
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assuranceError) throw assuranceError
      if (assurance.currentLevel !== 'aal2') throw new Error('La session n’a pas été élevée au niveau MFA. Réessaie.')
      setCode('')
      setState('allowed')
    } catch (err) {
      setError(getErrorMessage(err) || 'Code invalide. Réessaie.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'allowed') return children

  return <main className="admin-mfa-gate">
    <section className="admin-mfa-gate-panel">
      <p className="admin-mfa-gate-kicker">SCOPE-VERIFY · COMPTE ADMIN</p>
      {state === 'loading' ? <h1>Vérification…</h1> : state === 'verify' ? <>
        <h1>Vérification en deux étapes</h1>
        <p>La MFA est activée sur ce compte. Saisis le code de ton application d’authentification pour continuer.</p>
        <form onSubmit={verifyCode}>
          <label>Code à six chiffres<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" value={code} onChange={(event) => setCode(event.target.value)} required disabled={busy} /></label>
          {error && <p className="admin-mfa-gate-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy || code.replace(/\s/g, '').length < 6}>{busy ? 'Vérification…' : 'Vérifier et continuer'}</button>
        </form>
      </> : <>
        <h1>Vérification MFA indisponible</h1>
        <p>{error || 'Un facteur MFA vérifié est associé à ce compte, mais aucun facteur TOTP utilisable n’est disponible. Contacte l’administrateur du projet.'}</p>
      </>}
      <button type="button" className="admin-mfa-gate-logout" onClick={onLogout} disabled={busy}>Déconnexion</button>
    </section>
  </main>
}