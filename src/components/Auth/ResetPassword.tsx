import { useState, type FormEvent } from 'react'
import { supabase } from '../../supabase'
import { getErrorMessage } from '../../lib/errors'
import './Auth.css'

interface ResetPasswordProps {
  onDone: () => void
}

export default function ResetPassword({ onDone }: ResetPasswordProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    if (!supabase) {
      setError('Service indisponible pour le moment')
      return
    }

    setIsLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setSuccess(true)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors de la mise à jour du mot de passe')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-form">
        <h2>Mot de passe mis à jour</h2>
        <p className="auth-success">✅ Votre mot de passe a bien été changé. Vous pouvez continuer.</p>
        <button type="button" onClick={onDone}>
          Continuer
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2>Créer un nouveau mot de passe</h2>

      <label>
        Nouveau mot de passe
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={isLoading}
        />
      </label>

      <label>
        Confirmer le mot de passe
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          disabled={isLoading}
        />
      </label>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Enregistrement...' : 'Valider le nouveau mot de passe'}
      </button>
    </form>
  )
}
