import { supabase } from '../supabase'
import type { User, UserRole } from '../types'

// API pour la gestion des utilisateurs (admin uniquement)

export const usersAPI = {
  // Lister tous les utilisateurs
  async listAllUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Lister les utilisateurs par rôle
  async listUsersByRole(role: UserRole) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', role)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Obtenir un utilisateur par ID
  async getUserById(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  },

  // Mettre à jour le rôle d'un utilisateur
  async updateUserRole(userId: string, newRole: UserRole) {
    const { data, error } = await supabase
      .from('users')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Activer/Désactiver un utilisateur
  async toggleUserActive(userId: string, isActive: boolean) {
    const { data, error } = await supabase
      .from('users')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Mettre à jour le profil d'un utilisateur
  async updateUserProfile(userId: string, updates: Partial<Pick<User, 'full_name' | 'company'>>) {
    const { data, error } = await supabase
      .from('users')
      .update({ 
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Supprimer un utilisateur (admin uniquement)
  async deleteUser(userId: string) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (error) throw error
  }
}
