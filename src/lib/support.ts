import { supabase } from '../supabase'
import type { SupportTicket } from '../types'

// API pour la gestion des tickets de support

export const support = {
  // Lister tous les tickets (admin)
  async listAllTickets() {
    const { data, error } = await supabase
      .from('support_tickets')
      .select(`
        *,
        user:users!user_id(full_name, email, company),
        assigned_to_user:users!assigned_to(full_name, email)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Lister les tickets d'un utilisateur
  async listUserTickets(userId: string) {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Créer un nouveau ticket
  async createTicket(ticket: Omit<SupportTicket, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert(ticket)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Mettre à jour un ticket
  async updateTicket(ticketId: string, updates: Partial<SupportTicket>) {
    const { data, error } = await supabase
      .from('support_tickets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', ticketId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Assigner un ticket à un utilisateur
  async assignTicket(ticketId: string, assignedTo: string) {
    return this.updateTicket(ticketId, { 
      assigned_to: assignedTo,
      status: 'in_progress'
    })
  },

  // Résoudre un ticket
  async resolveTicket(ticketId: string) {
    return this.updateTicket(ticketId, {
      status: 'resolved',
      resolved_at: new Date().toISOString()
    })
  },

  // Fermer un ticket
  async closeTicket(ticketId: string) {
    return this.updateTicket(ticketId, { status: 'closed' })
  },

  // Supprimer un ticket
  async deleteTicket(ticketId: string) {
    const { error } = await supabase
      .from('support_tickets')
      .delete()
      .eq('id', ticketId)

    if (error) throw error
  }
}
