import { useState, type FormEvent, useEffect } from 'react'
import { useAuth } from '../../lib/useAuth'
import { supabase } from '../../supabase'
import type { UserRole } from '../../types'
import { signupSchema } from '../../lib/validation'
import { z } from 'zod'
import './Auth.css'

interface SignupProps {
  onSwitchToLogin?: () => void
}

export default function Signup({ onSwitchToLogin }: SignupProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const { signUp, error } = useAuth()
  const [publicRegistrationEnabled, setPublicRegistrationEnabled] = useState(true)
  const [isCheckingSettings, setIsCheckingSettings] = useState(true)

  // Public signup only creates client accounts. Collaborator accounts are
  // provisioned exclusively by an administrator (AdminDashboard) for security:
  // this prevents unauthorized people from self-registering as a collaborator.
  const role: UserRole = 'client'

  useEffect(() => {
    const checkPublicRegistration = async () => {
      if (!supabase) return
      
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('*')
          .eq('key', 'public_registration_enabled')
          .single()
        
        if (data) {
          setPublicRegistrationEnabled(data.value === 'true')
        }
      } catch (err) {
        console.error('Error checking public registration setting:', err)
        setPublicRegistrationEnabled(true) // Default to enabled if error
      } finally {
        setIsCheckingSettings(false)
      }
    }

    checkPublicRegistration()
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setValidationErrors({})

    // Validate with Zod
    try {
      const validationResult = signupSchema.parse({
        email,
        password,
        fullName,
        company,
        role,
      })
      
      await signUp(validationResult.email, validationResult.password, validationResult.fullName, validationResult.company || '', validationResult.role)
      // Show success message and redirect
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

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2>Créer un compte</h2>

      {isCheckingSettings ? (
        <p style={{ textAlign: 'center', color: '#65696a' }}>Vérification des paramètres...</p>
      ) : !publicRegistrationEnabled ? (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          color: '#721c24',
          marginBottom: '1rem'
        }}>
          <p style={{ margin: 0, fontWeight: '500' }}>⚠️ Inscription publique désactivée</p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            L'inscription publique est actuellement désactivée. Veuillez contacter l'administrateur pour créer un compte.
          </p>
        </div>
      ) : null}

      <label>
        Nom complet
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={isLoading || !publicRegistrationEnabled}
        />
        {validationErrors.fullName && <p className="auth-error">{validationErrors.fullName}</p>}
      </label>

      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading || !publicRegistrationEnabled}
        />
        {validationErrors.email && <p className="auth-error">{validationErrors.email}</p>}
      </label>

      <label>
        Entreprise / Société
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={isLoading || !publicRegistrationEnabled}
        />
      </label>

      <label>
        Mot de passe
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={isLoading || !publicRegistrationEnabled}
        />
        {validationErrors.password && <p className="auth-error">{validationErrors.password}</p>}
      </label>

      <p style={{ fontSize: '0.85rem', color: '#65696a' }}>
        Ce formulaire crée un compte client. Les comptes collaborateurs sont créés par l'administrateur.
      </p>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" disabled={isLoading || !publicRegistrationEnabled}>
        {isLoading ? 'Création en cours...' : 'S\'inscrire'}
      </button>

      {onSwitchToLogin && (
        <button
          type="button"
          className="auth-switch"
          onClick={onSwitchToLogin}
          disabled={isLoading}
        >
          Vous avez déjà un compte ? Se connecter
        </button>
      )}
    </form>
  )
}
