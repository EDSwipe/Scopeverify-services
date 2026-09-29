import { useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { User } from '../types'
import { getErrorMessage } from './errors'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const checkSession = async () => {
      try {
        const { data: sessionData } = await supabase!.auth.getSession()
        setSession(sessionData.session)

        if (sessionData.session?.user?.id) {
          const { data: userData, error: userError } = await supabase!
            .from('users')
            .select('*')
            .eq('id', sessionData.session.user.id)
            .single()

          if (userError) throw userError
          if (userData) setUser(userData as User)
        }
      } catch (err) {
        console.error('Error checking session:', err)
        setError(getErrorMessage(err) || 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    const { data: authListener } = supabase!.auth.onAuthStateChange(async (_event: string, currentSession: Session | null) => {
      setSession(currentSession)
      if (currentSession?.user?.id) {
        try {
          const { data: userData } = await supabase!
            .from('users')
            .select('*')
            .eq('id', currentSession.user.id)
            .single()
          setUser(userData as User)
        } catch (err) {
          console.error('Error fetching user:', err)
        }
      } else {
        setUser(null)
      }
    })

    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string, company: string, role: 'client' | 'collaborator') => {
    if (!supabase) throw new Error('Supabase not configured')
    setError(null)

    try {
      // Sign up with auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('User creation failed')

      // Create user profile
      const { error: profileError } = await supabase.from('users').insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        company,
        role,
        is_active: true,
      })

      if (profileError) throw profileError
    } catch (err) {
      const message = getErrorMessage(err) || 'Sign up failed'
      setError(message)
      throw err
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured')
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
    } catch (err) {
      const message = getErrorMessage(err) || 'Sign in failed'
      setError(message)
      throw err
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) throw new Error('Supabase not configured')
    setError(null)

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setSession(null)
    } catch (err) {
      const message = getErrorMessage(err) || 'Sign out failed'
      setError(message)
      throw err
    }
  }, [])

  return { user, session, loading, error, signUp, signIn, signOut }
}
