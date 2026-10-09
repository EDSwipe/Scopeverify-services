import { lazy, Suspense, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { User } from './types'
import { hasModeratorPermission } from './lib/permissions'
import App from './App'
import './AppRouter.css'

type Page = 'home' | 'login' | 'signup' | 'partner-signup' | 'partner-pending' | 'reset-password' | 'client-dashboard' | 'admin-dashboard' | 'collaborator-dashboard'

const Login = lazy(() => import('./components/Auth/Login'))
const Signup = lazy(() => import('./components/Auth/Signup'))
const ResetPassword = lazy(() => import('./components/Auth/ResetPassword'))
const AdminMfaGate = lazy(() => import('./components/Auth/AdminMfaGate'))
const ClientDashboard = lazy(() => import('./components/ClientDashboard/ClientDashboard'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard/AdminDashboard'))
const CollaboratorDashboard = lazy(() => import('./components/CollaboratorDashboard/CollaboratorDashboard'))
const PartnerQualificationForm = lazy(() => import('./components/Partners/PartnerQualificationForm'))
const PartnerManagement = lazy(() => import('./components/Partners/PartnerManagement'))

function PageLoading() {
  return <div className="app-loading"><p>Chargement...</p></div>
}

export default function AppRouter() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [page, setPage] = useState<Page>('home')
  const [partnerIntentConfirmed, setPartnerIntentConfirmed] = useState(false)
  const [partnerApplicationStarted, setPartnerApplicationStarted] = useState(false)
  const [loading, setLoading] = useState(() => Boolean(supabase))

  useEffect(() => {
    if (!supabase) {
      return
    }

    // Check current session
    const checkSession = async () => {
      try {
        const { data: sessionData } = await supabase!.auth.getSession()
        if (sessionData.session?.user?.id) {
          setSession(sessionData.session)

          // Fetch user profile
          const { data: userData } = await supabase!
            .from('users')
            .select('*')
            .eq('id', sessionData.session.user.id)
            .single()

          if (userData) {
            setUser(userData as User)
            // Redirect to appropriate dashboard
            if (userData.role === 'admin' || userData.role === 'moderator') {
              setPage('admin-dashboard')
            } else if (userData.role === 'client') {
              setPage('client-dashboard')
            } else if (userData.role === 'collaborator' && userData.is_active) {
              setPage('collaborator-dashboard')
            } else if (userData.role === 'partner') {
              const { data: partnerProfile } = await supabase!
                .from('partner_profiles').select('status').eq('user_id', userData.id).maybeSingle()
              if (partnerProfile?.status === 'network' || partnerProfile?.status === 'referenced') {
                if (userData.is_active) setPage('collaborator-dashboard')
                else await supabase!.auth.signOut()
              } else if (partnerProfile?.status === 'suspended') {
                await supabase!.auth.signOut()
              } else {
                setPage('partner-pending')
              }
            }
          }
        }
      } catch (err) {
        console.error('Error checking session:', err)
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    // Subscribe to auth changes
    const { data: authListener } = supabase!.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession)

      if (_event === 'PASSWORD_RECOVERY') {
        setPage('reset-password')
        setLoading(false)
        return
      }

      if (currentSession?.user?.id) {
        try {
          const { data: userData } = await supabase!
            .from('users')
            .select('*')
            .eq('id', currentSession.user.id)
            .single()

          if (userData) {
            setUser(userData as User)
            if (userData.role === 'admin' || userData.role === 'moderator') {
              setPage('admin-dashboard')
            } else if (userData.role === 'client') {
              setPage('client-dashboard')
            } else if (userData.role === 'collaborator' && userData.is_active) {
              setPage('collaborator-dashboard')
            } else if (userData.role === 'partner') {
              const { data: partnerProfile } = await supabase!
                .from('partner_profiles').select('status').eq('user_id', userData.id).maybeSingle()
              if (partnerProfile?.status === 'network' || partnerProfile?.status === 'referenced') {
                if (userData.is_active) setPage('collaborator-dashboard')
                else await supabase!.auth.signOut()
              } else if (partnerProfile?.status === 'suspended') {
                await supabase!.auth.signOut()
              } else {
                setPage('partner-pending')
              }
            }
          }
        } catch (err) {
          console.error('Error fetching user:', err)
        }
      } else {
        setUser(null)
        setPage('home')
      }
    })

    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      setPage('home')
    }
  }

  const openWorkspace = () => {
    if (!session || !user) {
      setPage('login')
    } else if (user.role === 'admin' || user.role === 'moderator') {
      setPage('admin-dashboard')
    } else if (user.role === 'client') {
      setPage('client-dashboard')
    } else if (user.role === 'partner' && !user.is_active) {
      setPage('partner-pending')
    } else {
      setPage('collaborator-dashboard')
    }
  }

  const openPartnerApplication = () => {
    setPartnerIntentConfirmed(false)
    setPartnerApplicationStarted(false)
    setPage('partner-signup')
  }

  const leavePartnerApplication = () => {
    setPartnerIntentConfirmed(false)
    setPartnerApplicationStarted(false)
    setPage('home')
  }

  // Security: automatically sign out after a period of inactivity so a
  // session left open on a shared/unattended device doesn't stay logged in forever.
  useEffect(() => {
    if (!session) return

    const IDLE_LIMIT_MS = 30 * 60 * 1000 // 30 minutes
    let timer: ReturnType<typeof setTimeout>

    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        handleLogout()
      }, IDLE_LIMIT_MS)
    }

    const activityEvents: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    activityEvents.forEach((evt) => window.addEventListener(evt, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(timer)
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetTimer))
    }
  }, [session])

  if (loading) {
    return (
      <div className="app-loading">
        <p>Chargement...</p>
      </div>
    )
  }

  if (page === 'reset-password') {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <Suspense fallback={<PageLoading />}>
            <ResetPassword onDone={() => setPage(session ? 'home' : 'login')} />
          </Suspense>
        </div>
      </div>
    )
  }

  // Show home page if not authenticated and not on login/signup
  if (!session) {
    if (page === 'partner-signup') {
      return <div className="partner-signup-page">
        <a href="#" className="back-home" onClick={leavePartnerApplication}>← Retour au site</a>
        {!partnerApplicationStarted ? <section className="partner-application-intro">
          <p className="partner-form-kicker">RÉSEAU SCOPE-VERIFY</p>
          <h1>Candidature partenaire</h1>
          <p>Cette démarche s’adresse aux professionnels et organismes qui souhaitent proposer leurs compétences pour des missions Scope-Verify.</p>
          <ul>
            <li>La fiche demande des informations détaillées sur votre structure, vos compétences, assurances, références, zones et conditions d’intervention.</li>
            <li>Des justificatifs sont nécessaires. Préparez vos documents avant de commencer.</li>
            <li>La candidature sera examinée par Scope-Verify. Son envoi ne vaut pas référencement et ne donne pas accès aux missions.</li>
            <li>Le compte sera créé lors de l’envoi final de la fiche, et restera en attente de validation.</li>
          </ul>
          <label className="partner-application-confirm"><input type="checkbox" checked={partnerIntentConfirmed} onChange={(event) => setPartnerIntentConfirmed(event.target.checked)} /> Je représente un professionnel ou un organisme et souhaite déposer une candidature de qualification.</label>
          <button className="partner-application-start" disabled={!partnerIntentConfirmed} onClick={() => setPartnerApplicationStarted(true)}>Commencer ma candidature</button>
        </section> : <Suspense fallback={<PageLoading />}><PartnerQualificationForm mode="application" onCancel={leavePartnerApplication} /></Suspense>}
      </div>
    }

    if (page === 'login') {
      return (
        <div className="auth-page">
          <div className="auth-container">
            <a href="#" onClick={() => setPage('home')} className="back-home">
              ← Retour à l'accueil
            </a>
            <Suspense fallback={<PageLoading />}>
              <Login onSwitchToSignup={() => setPage('signup')} />
            </Suspense>
          </div>
        </div>
      )
    }

    if (page === 'signup') {
      return (
        <div className="auth-page">
          <div className="auth-container">
            <a href="#" onClick={() => setPage('home')} className="back-home">
              ← Retour à l'accueil
            </a>
            <Suspense fallback={<PageLoading />}>
              <Signup onSwitchToLogin={() => setPage('login')} />
            </Suspense>
          </div>
        </div>
      )
    }

    return <App onPartnerSignup={openPartnerApplication} onLogin={openWorkspace} />
  }

  // Show appropriate dashboard based on user role
  if (page === 'partner-pending' && user?.role === 'partner') {
    return <div className="partner-pending-page"><p className="eyebrow">SCOPE-VERIFY · RÉSEAU</p><h1>Candidature en cours de validation</h1><p>Votre compte ne donne pas encore accès aux missions. Nous vous informerons après examen de votre dossier.</p><button onClick={handleLogout} className="btn-logout">Déconnexion</button></div>
  }

  if (user?.role === 'moderator') {
    return <div><div className="dashboard-topbar"><div className="topbar-content"><span className="user-info">Espace modérateur · {user.full_name || user.email}</span><button onClick={handleLogout} className="btn-logout">Déconnexion</button></div></div>{hasModeratorPermission(user, 'partners.review') ? <Suspense fallback={<PageLoading />}><PartnerManagement adminId={user.id} moderatorOnly permissions={user.permissions || []} /></Suspense> : <section className="moderator-access-denied"><h1>Accès non attribué</h1><p>L’administrateur ne vous a pas encore attribué de droit sur les candidatures partenaires.</p></section>}</div>
  }

  if (page === 'admin-dashboard' && (user?.role === 'admin' || user?.role === 'moderator')) {
    return (
      <div>
        <div className="dashboard-topbar">
          <div className="topbar-content">
            <a href="#" onClick={() => setPage('home')} className="topbar-home">
              Retour au site
            </a>
            <span className="user-info">{user.full_name || user.email}</span>
            <button onClick={handleLogout} className="btn-logout">
              Déconnexion
            </button>
          </div>
        </div>
        <Suspense fallback={<PageLoading />}>
          <AdminMfaGate onLogout={handleLogout}>
            <AdminDashboard adminId={user.id} />
          </AdminMfaGate>
        </Suspense>
      </div>
    )
  }

  if (page === 'client-dashboard' && user?.role === 'client') {
    return (
      <div>
        <div className="dashboard-topbar">
          <div className="topbar-content">
            <a href="#" onClick={() => setPage('home')} className="topbar-home">
              Retour au site
            </a>
            <span className="user-info">{user.full_name || user.email}</span>
            <button onClick={handleLogout} className="btn-logout">
              Déconnexion
            </button>
          </div>
        </div>
        <Suspense fallback={<PageLoading />}>
          <ClientDashboard userId={user.id} userName={user.full_name} />
        </Suspense>
      </div>
    )
  }

  if (page === 'collaborator-dashboard' && (user?.role === 'collaborator' || user?.role === 'partner') && user.is_active) {
    return (
      <div>
        <div className="dashboard-topbar">
          <div className="topbar-content">
            <a href="#" onClick={() => setPage('home')} className="topbar-home">
              Retour au site
            </a>
            <span className="user-info">{user.full_name || user.email}</span>
            <button onClick={handleLogout} className="btn-logout">
              Déconnexion
            </button>
          </div>
        </div>
        <Suspense fallback={<PageLoading />}>
          <CollaboratorDashboard userId={user.id} userName={user.full_name} />
        </Suspense>
      </div>
    )
  }

  // Default: return home
  return <App onPartnerSignup={openPartnerApplication} onLogin={openWorkspace} />
}
