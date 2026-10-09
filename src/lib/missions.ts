import { supabase } from '../supabase'
import type { Mission, MissionAssignment, MissionDocument } from '../types'

export const missions = {
  async listClientMissions(clientId: string): Promise<Mission[]> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as Mission[]
  },

  async listCollaboratorMissions(collaboratorId: string): Promise<Mission[]> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('assigned_to', collaboratorId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as Mission[]
  },

  async listAllMissions(): Promise<Mission[]> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as Mission[]
  },

  async getMission(id: string): Promise<Mission> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as Mission
  },

  async createMission(mission: Omit<Mission, 'id' | 'created_at' | 'updated_at'>): Promise<Mission> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('missions')
      .insert([mission])
      .select()
      .single()
    if (error) throw error
    return data as Mission
  },

  async updateMission(id: string, updates: Partial<Mission>): Promise<Mission> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('missions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Mission
  },

  async submitMission(id: string): Promise<Mission> {
    return this.updateMission(id, { status: 'submitted' })
  },

  async deleteMission(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase
      .from('missions')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}

export const assignments = {
  async getAssignmentsForMission(missionId: string): Promise<MissionAssignment[]> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('mission_assignments')
      .select('*')
      .eq('mission_id', missionId)
    if (error) throw error
    return (data || []) as MissionAssignment[]
  },

  async assignMission(
    missionId: string,
    collaboratorId: string,
    assignedBy: string,
  ): Promise<MissionAssignment> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('mission_assignments')
      .insert([
        {
          mission_id: missionId,
          collaborator_id: collaboratorId,
          assigned_by: assignedBy,
          assignment_status: 'assigned',
        },
      ])
      .select()
      .single()
    if (error) throw error

    const { data: partnerProfile, error: partnerLookupError } = await supabase
      .from('partner_profiles')
      .select('id')
      .eq('user_id', collaboratorId)
      .maybeSingle()
    if (partnerLookupError) throw partnerLookupError

    const { error: missionUpdateError } = await supabase
      .from('missions')
      .update({
        assigned_to: collaboratorId,
        partner_profile_id: partnerProfile?.id ?? null,
      })
      .eq('id', missionId)
    if (missionUpdateError) throw missionUpdateError

    return data as MissionAssignment
  },

  async updateAssignmentStatus(id: string, status: string): Promise<MissionAssignment> {
    if (!supabase) throw new Error('Supabase not configured')
    const updateData: Record<string, string> = { assignment_status: status }
    if (status === 'in_progress') {
      updateData.started_at = new Date().toISOString()
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('mission_assignments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as MissionAssignment
  },
}

export const documents = {
  async uploadDocument(
    missionId: string,
    file: File,
    uploadedBy: string,
  ): Promise<MissionDocument> {
    if (!supabase) throw new Error('Supabase not configured')

    // Upload file to Supabase Storage
    const fileName = `${missionId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('mission-documents')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // Create document record
    const { data, error } = await supabase
      .from('mission_documents')
      .insert([
        {
          mission_id: missionId,
          file_path: fileName,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: uploadedBy,
        },
      ])
      .select()
      .single()

    if (error) throw error
    return data as MissionDocument
  },

  async getDocumentsForMission(missionId: string): Promise<MissionDocument[]> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from('mission_documents')
      .select('*')
      .eq('mission_id', missionId)
      .order('uploaded_at', { ascending: false })
    if (error) throw error
    return (data || []) as MissionDocument[]
  },

  async deleteDocument(id: string, filePath: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured')

    // Delete from storage
    await supabase.storage.from('mission-documents').remove([filePath])

    // Delete record
    const { error } = await supabase
      .from('mission_documents')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async getDocumentUrl(filePath: string): Promise<string> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.storage
      .from('mission-documents')
      .createSignedUrl(filePath, 3600) // 1 hour expiry
    if (error) throw error
    return data?.signedUrl || ''
  },
}
