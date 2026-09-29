import { useState, type FormEvent } from 'react'
import { useAuth } from '../../lib/useAuth'
import { supabase } from '../../supabase'
import { getErrorMessage } from '../../lib/errors'
import { loginSchema } from '../../lib/validation'
import { z } from 'zod'
import './Auth.css'

interface LoginProps {
  onSwitchToSignup?: () => void
}

export default function Login({ onSwitchToSignup }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const { signIn, error } = useAuth()

  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setValidationErrors({})

    // Validate with Zod
    try {
      const validationResult = loginSchema.parse({
        email,
        password,
      })
      
      await signIn(validationResult.email, validationResult.password)
      // Redirect handled by parent component
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Handle Zod validation errors
        const errors: Record<string, string> = {}
        err.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0] as string] = issue.message
          }
        })
        setValidationErrors(errors)
      }
      // Error state handled by hook
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!supabase) {
      setResetError('Service indisponible pour le moment')
      return
    }
    setIsResetting(true)
    setResetError(null)
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}${window.location.pathname}#reset-password`,
      })
      if (resetErr) throw resetErr
      setResetSent(true)
    } catch (err) {
      setResetError(getErrorMessage(err) || 'Erreur lors de l\'envoi')
    } finally {
      setIsResetting(false)
    }
  }

  if (mode === 'forgot') {
    return (
      <form onSubmit={handleResetSubmit} className="auth-form">
        <h2>Mot de passe oublié</h2>

        {resetSent ? (
          <p className="auth-success">
            ✅ Un email a été envoyé à {resetEmail} avec un lien pour créer un nouveau mot de passe.
          </p>
        ) : (
          <>
            <label>
              Email
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={isResetting}
                placeholder="votre@email.com"
              />
            </label>

            {resetError && <p className="auth-error">{resetError}</p>}

            <button type="submit" disabled={isResetting}>
              {isResetting ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
            </button>
          </>
        )}

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode('login')
            setResetSent(false)
            setResetError(null)
          }}
        >
          ← Retour à la connexion
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2>Connexion</h2>

      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
        {validationErrors.email && <p className="auth-error">{validationErrors.email}</p>}
      </label>

      <label>
        Mot de passe
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={isLoading}
        />
        {validationErrors.password && <p className="auth-error">{validationErrors.password}</p>}
      </label>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Connexion...' : 'Se connecter'}
      </button>

      <button
        type="button"
        className="auth-switch"
        onClick={() => {
          setMode('forgot')
          setResetEmail(email)
        }}
        disabled={isLoading}
      >
        Mot de passe oublié ?
      </button>

      {onSwitchToSignup && (
        <button
          type="button"
          className="auth-switch"
          onClick={onSwitchToSignup}
          disabled={isLoading}
        >
          Pas encore de compte ? S'inscrire
        </button>
      )}
    </form>
  )
}

