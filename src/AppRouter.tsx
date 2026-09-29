import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { User } from './types'
import App from './App'
import Login from './components/Auth/Login'
import Signup from './components/Auth/Signup'
import ResetPassword from './components/Auth/ResetPassword'
import ClientDashboard from './components/ClientDashboard/ClientDashboard'
import AdminDashboard from './components/AdminDashboard/AdminDashboard'
import CollaboratorDashboard from './components/CollaboratorDashboard/CollaboratorDashboard'
import './AppRouter.css'

type Page = 'home' | 'login' | 'signup' | 'reset-password' | 'client-dashboard' | 'admin-dashboard' | 'collaborator-dashboard'

export default function AppRouter() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [page, setPage] = useState<Page>('home')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
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
            if (userData.role === 'admin') {
              setPage('admin-dashboard')
            } else if (userData.role === 'client') {
              setPage('client-dashboard')
            } else if (userData.role === 'collaborator') {
              setPage('collaborator-dashboard')
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
            if (userData.role === 'admin') {
              setPage('admin-dashboard')
            } else if (userData.role === 'client') {
              setPage('client-dashboard')
            } else if (userData.role === 'collaborator') {
              setPage('collaborator-dashboard')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <ResetPassword onDone={() => setPage(session ? 'home' : 'login')} />
        </div>
      </div>
    )
  }

  // Show home page if not authenticated and not on login/signup
  if (!session) {
    if (page === 'login') {
      return (
        <div className="auth-page">
          <div className="auth-container">
            <a href="#" onClick={() => setPage('home')} className="back-home">
              ← Retour à l'accueil
            </a>
            <Login onSwitchToSignup={() => setPage('signup')} />
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
            <Signup onSwitchToLogin={() => setPage('login')} />
          </div>
        </div>
      )
    }

    // Show home page with login button
    return (
      <div>
        <App />
        <div className="home-auth-buttons">
          <button onClick={() => setPage('login')} className="btn-login">
            Connexion
          </button>
          <button onClick={() => setPage('signup')} className="btn-signup">
            Créer un compte
          </button>
        </div>
      </div>
    )
  }

  // Show appropriate dashboard based on user role
  if (page === 'admin-dashboard' && user?.role === 'admin') {
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
        <AdminDashboard adminId={user.id} />
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
        <ClientDashboard userId={user.id} userName={user.full_name} />
      </div>
    )
  }

  if (page === 'collaborator-dashboard' && user?.role === 'collaborator') {
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
        <CollaboratorDashboard userId={user.id} userName={user.full_name} />
      </div>
    )
  }

  // Default: return home
  return (
    <div>
      <App />
      <div className="home-auth-buttons">
        <button onClick={() => setPage('login')} className="btn-login">
          Connexion
        </button>
        <button onClick={() => setPage('signup')} className="btn-signup">
          Créer un compte
        </button>
      </div>
    </div>
  )
}
