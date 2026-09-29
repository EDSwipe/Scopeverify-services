// Types pour le système de gestion de missions
export type UserRole = 'admin' | 'client' | 'collaborator'

export type Permission = 
  | 'manage_users'
  | 'manage_missions'
  | 'manage_collaborators'
  | 'manage_clients'
  | 'validate_missions'
  | 'view_all_missions'
  | 'manage_settings'

export interface SupportTicket {
  id: string
  user_id: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to?: string
  created_at: string
  updated_at: string
  resolved_at?: string
}

export type MissionType = 
  | 'simple_visit'
  | 'verification'
  | 'supplier_visit'
  | 'technical_mission'
  | 'field_day'
  | 'custom'

export type MissionStatus = 
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type ValidationStatus = 
  | 'pending'
  | 'validated'
  | 'rejected'

export type AssignmentStatus = 
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface User {
  id: string
  email: string
  role: UserRole
  full_name?: string
  company?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Mission {
  id: string
  client_id: string
  title: string
  description?: string
  mission_type: MissionType
  location: string
  status: MissionStatus
  validation_status?: ValidationStatus
  validation_notes?: string
  requirements?: Record<string, any>
  budget?: string
  assigned_to?: string
  created_at: string
  updated_at: string
}

export interface MissionAssignment {
  id: string
  mission_id: string
  collaborator_id: string
  assigned_by: string
  assignment_status: AssignmentStatus
  assigned_at: string
  started_at?: string
  completed_at?: string
  notes?: string
}

export interface MissionDocument {
  id: string
  mission_id: string
  file_path: string
  file_name: string
  file_type?: string
  file_size?: number
  uploaded_by: string
  uploaded_at: string
}

export interface AuthContextType {
  user: User | null
  session: any
  loading: boolean
  signUp: (email: string, password: string, fullName: string, company: string, role: UserRole) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  error: string | null
}

export const missionTypeLabels: Record<MissionType, { fr: string; en: string }> = {
  simple_visit: { fr: 'Visite simple + photos', en: 'Simple visit + photos' },
  verification: { fr: 'Vérification', en: 'Verification' },
  supplier_visit: { fr: 'Visite fournisseur / production', en: 'Supplier / production visit' },
  technical_mission: { fr: 'Mission technique avec relevés', en: 'Technical mission with records' },
  field_day: { fr: 'Journée terrain', en: 'Field day' },
  custom: { fr: 'Mission sur mesure', en: 'Custom mission' },
}

export const missionStatusLabels: Record<MissionStatus, string> = {
  draft: 'Brouillon',
  submitted: 'Soumise',
  accepted: 'Acceptée',
  in_progress: 'En cours',
  completed: 'Complétée',
  cancelled: 'Annulée',
}

// Types CRM
export type ContactStatus = 'prospect' | 'client' | 'inactive' | 'lost'

export type InteractionType = 'call' | 'email' | 'meeting' | 'note' | 'task'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface CRMContact {
  id: string
  user_id?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  company?: string
  position?: string
  status: ContactStatus
  source?: string
  notes?: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface CRMInteraction {
  id: string
  contact_id: string
  type: InteractionType
  subject?: string
  description?: string
  outcome?: string
  next_action?: string
  next_action_date?: string
  created_at: string
  created_by?: string
}

export interface CRMTask {
  id: string
  contact_id: string
  title: string
  description?: string
  due_date?: string
  priority: TaskPriority
  status: TaskStatus
  assigned_to?: string
  created_at: string
  updated_at: string
  created_by?: string
}

export const contactStatusLabels: Record<ContactStatus, string> = {
  prospect: 'Prospect',
  client: 'Client',
  inactive: 'Inactif',
  lost: 'Perdu',
}

export const interactionTypeLabels: Record<InteractionType, string> = {
  call: 'Appel',
  email: 'Email',
  meeting: 'Réunion',
  note: 'Note',
  task: 'Tâche',
}

export const taskPriorityLabels: Record<TaskPriority, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
}

export const taskStatusLabels: Record<TaskStatus, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Complétée',
  cancelled: 'Annulée',
}

// Types Pipeline de ventes
export type OpportunityStatus = 'active' | 'won' | 'lost'

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task'

export interface SalesPipeline {
  id: string
  name: string
  description?: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface PipelineStage {
  id: string
  pipeline_id: string
  name: string
  order_index: number
  color: string
  probability: number
  created_at: string
}

export interface SalesOpportunity {
  id: string
  contact_id?: string
  pipeline_id?: string
  stage_id: string
  title: string
  description?: string
  value?: number
  currency: string
  expected_close_date?: string
  actual_close_date?: string
  status: OpportunityStatus
  lost_reason?: string
  created_at: string
  updated_at: string
  created_by?: string
  assigned_to?: string
}

export interface OpportunityActivity {
  id: string
  opportunity_id: string
  type: ActivityType
  description?: string
  outcome?: string
  created_at: string
  created_by?: string
}

export const opportunityStatusLabels: Record<OpportunityStatus, string> = {
  active: 'Actif',
  won: 'Gagné',
  lost: 'Perdu',
}

export const activityTypeLabels: Record<ActivityType, string> = {
  call: 'Appel',
  email: 'Email',
  meeting: 'Réunion',
  note: 'Note',
  task: 'Tâche',
}

// Types Calendrier
export type EventType = 'mission' | 'meeting' | 'availability' | 'holiday' | 'other'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  event_type: EventType
  start_date: string
  end_date: string
  all_day: boolean
  location?: string
  mission_id?: string
  user_id?: string
  color: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface CollaboratorAvailability {
  id: string
  user_id: string
  date: string
  is_available: boolean
  start_time?: string
  end_time?: string
  notes?: string
  created_at: string
  updated_at: string
}

export const eventTypeLabels: Record<EventType, string> = {
  mission: 'Mission',
  meeting: 'Réunion',
  availability: 'Disponibilité',
  holiday: 'Congé',
  other: 'Autre',
}

export type SiteContentSection = 'hero' | 'intro' | 'missions' | 'process' | 'deliverables' | 'limits' | 'contact' | 'footer'
export type SiteContentLanguage = 'fr' | 'en'

export interface SiteContent {
  id: string
  section: SiteContentSection
  key: string
  language: SiteContentLanguage
  content: string
  updated_at: string
  updated_by?: string
}

export const siteContentSections: Record<SiteContentSection, string> = {
  hero: 'Hero',
  intro: 'Introduction',
  missions: 'Missions',
  process: 'Processus',
  deliverables: 'Livrables',
  limits: 'Limites',
  contact: 'Contact',
  footer: 'Pied de page'
}
