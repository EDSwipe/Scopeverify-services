import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../supabase'
import { assignments, missions as missionsApi } from '../../lib/missions'
import { support } from '../../lib/support'
import { getErrorMessage } from '../../lib/errors'
import type { MatchingPartnerDocument, MatchingPartnerProfile } from '../../lib/partner-matching'
import { positioningContentSeeds } from '../../lib/site-positioning'
import { parseTestimonial } from '../../lib/testimonials'
import type { Testimonial, TestimonialDraft } from '../../lib/testimonials'
import { parsePartnerLogo } from '../../lib/partner-logos'
import type { PartnerLogo } from '../../lib/partner-logos'
import AdminMfaSettings from '../Auth/AdminMfaSettings'
import PartnerManagement from '../Partners/PartnerManagement'
import DocumentLibrary from './DocumentLibrary'
import PartnerRecommendations from './PartnerRecommendations'
import AdminTeamAccess from './AdminTeamAccess'
import SiteContentQuickEditor from './SiteContentQuickEditor'
import { defaultGeographicCoverage, geographicCountryOptions, geographicCoverageContentKey, geographicCoverageContentSeed, parseGeographicCoverage } from '../../lib/geographic-coverage'
import type { GeographicCoverageConfig } from '../../lib/geographic-coverage'
import type { Mission, User, UserRole, CRMContact, CRMInteraction, CRMTask, ContactStatus, InteractionType, TaskStatus, TaskPriority, SalesPipeline, PipelineStage, SalesOpportunity, OpportunityStatus, ActivityType, CalendarEvent, CollaboratorAvailability, EventType, SiteContent, SiteContentSection, SiteContentLanguage } from '../../types'
import { contactStatusLabels, interactionTypeLabels, taskPriorityLabels, taskStatusLabels, opportunityStatusLabels, activityTypeLabels, eventTypeLabels, siteContentSections, missionTypeLabels, missionStatusLabels } from '../../types'
import './AdminDashboard.css'
import './GeographicManagement.css'

interface AdminDashboardProps {
  adminId: string
}

interface ContactRequest {
  id: string
  name: string
  company: string
  email: string
  phone: string
  mission: string
  status: string
  created_at: string
}

interface SitePrice {
  id: number
  title_fr: string
  title_en: string
  description_fr: string
  description_en: string
  amount: string
  is_visible?: boolean
}

export default function AdminDashboard({ adminId }: AdminDashboardProps) {
  const [missions, setMissions] = useState<Mission[]>([])
  const [collaborators, setCollaborators] = useState<User[]>([])
  const [clients, setClients] = useState<User[]>([])
  const [pendingPartnerApplications, setPendingPartnerApplications] = useState<Array<{ id: string; business_name: string }>>([])
  const [matchingPartners, setMatchingPartners] = useState<MatchingPartnerProfile[]>([])
  const [matchingPartnerDocuments, setMatchingPartnerDocuments] = useState<MatchingPartnerDocument[]>([])
  const [missionForRecommendations, setMissionForRecommendations] = useState<Mission | null>(null)
  const [assigningRecommendedPartnerId, setAssigningRecommendedPartnerId] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([])
  const [prices, setPrices] = useState<SitePrice[]>([])
  const [pageViews, setPageViews] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'missions' | 'collaborators' | 'partners' | 'team' | 'clients' | 'users' | 'messages' | 'tarifs' | 'stats' | 'support' | 'settings' | 'crm' | 'pipeline' | 'calendar' | 'content' | 'testimonials' | 'logos' | 'geographic' | 'legal' | 'document-library'>('overview')
  const [canManageDocumentLibrary, setCanManageDocumentLibrary] = useState(false)
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('')
  const [editingPrice, setEditingPrice] = useState<SitePrice | null>(null)
  const [priceFormData, setPriceFormData] = useState({ title_fr: '', title_en: '', description_fr: '', description_en: '', amount: '' })
  const [updatingPriceId, setUpdatingPriceId] = useState<number | null>(null)
  
  // Collaborator form states
  const [showCollabForm, setShowCollabForm] = useState(false)
  const [collabFormData, setCollabFormData] = useState({ email: '', password: '', full_name: '', company: '', role: 'collaborator' })
  const [selectedCollabForMission, setSelectedCollabForMission] = useState<string | null>(null)
  const [isCreatingCollab, setIsCreatingCollab] = useState(false)

  // Admin "create mission for a client" flow states
  const [showCreateMissionForClient, setShowCreateMissionForClient] = useState(false)
  const [missionClientMode, setMissionClientMode] = useState<'existing' | 'new'>('existing')
  const [selectedExistingClientId, setSelectedExistingClientId] = useState('')
  const [newClientFormData, setNewClientFormData] = useState({ email: '', full_name: '', company: '' })
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null)
  
  // Validation states
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationNotes, setValidationNotes] = useState('')
  const [viewMode, setViewMode] = useState<'details' | 'validation' | 'edit' | 'list' | 'cards'>('cards')
  const [editingMission, setEditingMission] = useState<Mission | null>(null)

  // User management states
  const [editingUserRole, setEditingUserRole] = useState<{ userId: string; newRole: UserRole } | null>(null)
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)

  // Support ticket states
  const [supportTickets, setSupportTickets] = useState<any[]>([])
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketFormData, setTicketFormData] = useState({ subject: '', description: '', priority: 'medium' as const })

  // Site settings states
  const [publicRegistrationEnabled, setPublicRegistrationEnabled] = useState(true)
  const [missionFormEnabled, setMissionFormEnabled] = useState(true)
  const [contactPhone, setContactPhone] = useState('+33 (0) 7 69 96 07 66')
  const [phoneDisplayEnabled, setPhoneDisplayEnabled] = useState(true)
  const [whatsappNumber, setWhatsappNumber] = useState('+33 (0) 7 69 96 07 66')
  const [whatsappDisplayEnabled, setWhatsappDisplayEnabled] = useState(false)
  const [crmEnabled, setCrmEnabled] = useState(false)
  const [salesPipelineEnabled, setSalesPipelineEnabled] = useState(false)
  const [invoicesEnabled, setInvoicesEnabled] = useState(false)
  const [segmentationEnabled, setSegmentationEnabled] = useState(false)
  const [marketingAutomationEnabled, setMarketingAutomationEnabled] = useState(false)
  const [calendarEnabled, setCalendarEnabled] = useState(false)
  const [documentManagementEnabled, setDocumentManagementEnabled] = useState(false)
  const [advancedNotificationsEnabled, setAdvancedNotificationsEnabled] = useState(false)
  const [reportingEnabled, setReportingEnabled] = useState(false)
  const [auditLogsEnabled, setAuditLogsEnabled] = useState(false)
  const [skillsManagementEnabled, setSkillsManagementEnabled] = useState(false)
  const [availabilityEnabled, setAvailabilityEnabled] = useState(false)
  const [feedbackEnabled, setFeedbackEnabled] = useState(false)
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false)

  // Legal documents states
  const [legalDocuments, setLegalDocuments] = useState<Array<{ id: string; type: string; file_name: string; file_path: string; updated_at: string }>>([])
  const [uploadingLegalDoc, setUploadingLegalDoc] = useState(false)
  const [editingLegalDocId, setEditingLegalDocId] = useState<string | null>(null)
  const [legalDocType, setLegalDocType] = useState('mentions_legales')
  const [legalDocFile, setLegalDocFile] = useState<File | null>(null)

  // CRM states
  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([])
  const [crmInteractions, setCrmInteractions] = useState<CRMInteraction[]>([])
  const [crmTasks, setCrmTasks] = useState<CRMTask[]>([])
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null)
  const [contactFormData, setContactFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    status: 'prospect' as ContactStatus,
    source: '',
    notes: ''
  })
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)

  // Sales Pipeline states
  const [salesPipelines, setSalesPipelines] = useState<SalesPipeline[]>([])
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([])
  const [salesOpportunities, setSalesOpportunities] = useState<SalesOpportunity[]>([])
  const [showOpportunityForm, setShowOpportunityForm] = useState(false)
  const [editingOpportunity, setEditingOpportunity] = useState<SalesOpportunity | null>(null)
  const [opportunityFormData, setOpportunityFormData] = useState({
    contact_id: '',
    stage_id: '',
    title: '',
    description: '',
    value: '',
    currency: 'EUR',
    expected_close_date: '',
    status: 'active' as OpportunityStatus,
    lost_reason: ''
  })
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null)

  // Calendar states
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [collaboratorAvailabilities, setCollaboratorAvailabilities] = useState<CollaboratorAvailability[]>([])
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    event_type: 'mission' as EventType,
    start_date: '',
    end_date: '',
    all_day: false,
    location: '',
    mission_id: '',
    user_id: '',
    color: '#007bff'
  })
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Site Content states
  const [siteContent, setSiteContent] = useState<SiteContent[]>([])
  const [selectedContentSection, setSelectedContentSection] = useState<SiteContentSection>('hero')
  const [selectedContentLanguage, setSelectedContentLanguage] = useState<SiteContentLanguage>('fr')
  const [editingContent, setEditingContent] = useState<SiteContent | null>(null)
  const [contentFormData, setContentFormData] = useState({ content: '' })
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [partnerLogos, setPartnerLogos] = useState<PartnerLogo[]>([])
  const [partnerLogoName, setPartnerLogoName] = useState('')
  const [partnerLogoWebsite, setPartnerLogoWebsite] = useState('')
  const [partnerLogoFile, setPartnerLogoFile] = useState<File | null>(null)
  const [isSavingPartnerLogo, setIsSavingPartnerLogo] = useState(false)
  const [geographicCoverage, setGeographicCoverage] = useState<GeographicCoverageConfig>(defaultGeographicCoverage)
  const [isSavingGeographicCoverage, setIsSavingGeographicCoverage] = useState(false)
  const [geographicCoverageSaved, setGeographicCoverageSaved] = useState(false)
  const [editingTestimonialKey, setEditingTestimonialKey] = useState<string | null>(null)
  const [showTestimonialForm, setShowTestimonialForm] = useState(false)
  const [testimonialFormData, setTestimonialFormData] = useState<TestimonialDraft>({
    name: '',
    organization: '',
    role: '',
    quote_fr: '',
    quote_en: '',
    consent_confirmed: false,
    is_published: false,
  })

  const loadData = async () => {
    try {
      setLoading(true)
      if (!supabase) return

      const { data: isScopeAdmin, error: adminCheckError } = await supabase.rpc('is_scope_admin')
      if (!adminCheckError) setCanManageDocumentLibrary(isScopeAdmin === true)

      const { data: settingsData, error: settingsError } = await supabase.from('site_settings').select('*')
      if (settingsError) throw settingsError
      const settings = settingsData || []
      const getSetting = (key: string, defaultValue: boolean) => {
        const setting = settings.find((item) => item.key === key)
        return setting ? setting.value === 'true' : defaultValue
      }
      const pipelineEnabled = getSetting('sales_pipeline_enabled', false)
      const calendarModuleEnabled = getSetting('calendar_enabled', false)
      const availabilityModuleEnabled = getSetting('availability_enabled', false)

      const [missionsData, collabsData, clientsData, allUsersData, contactData, pricesData, viewsData, ticketsData, crmContactsData, crmInteractionsData, crmTasksData, salesPipelinesData, pipelineStagesData, salesOpportunitiesData, calendarEventsData, collaboratorAvailabilitiesData, siteContentData, legalDocsData, pendingPartnerData, matchingPartnerData, matchingDocumentData] = await Promise.all([
        missionsApi.listAllMissions(),
        supabase.from('users').select('*').in('role', ['collaborator', 'partner']).eq('is_active', true),
        supabase.from('users').select('*').eq('role', 'client').order('created_at', { ascending: false }),
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('contact_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('prices').select('*').order('id'),
        supabase.from('page_views').select('*'),
        support.listAllTickets().catch(() => []),
        supabase.from('crm_contacts').select('*').order('created_at', { ascending: false }),
        supabase.from('crm_interactions').select('*').order('created_at', { ascending: false }),
        supabase.from('crm_tasks').select('*').order('created_at', { ascending: false }),
        pipelineEnabled ? supabase.from('sales_pipelines').select('*') : Promise.resolve({ data: [] }),
        pipelineEnabled ? supabase.from('pipeline_stages').select('*').order('order_index') : Promise.resolve({ data: [] }),
        pipelineEnabled ? supabase.from('sales_opportunities').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        calendarModuleEnabled ? supabase.from('calendar_events').select('*').order('start_date') : Promise.resolve({ data: [] }),
        availabilityModuleEnabled ? supabase.from('collaborator_availability').select('*').order('date') : Promise.resolve({ data: [] }),
        supabase.from('site_content').select('*').order('section'),
        supabase.from('legal_documents').select('*').order('updated_at', { ascending: false }),
        supabase.from('partner_profiles').select('id,business_name').eq('status', 'pending'),
        supabase.from('partner_profiles').select('id,user_id,business_name,status,qualification_data').in('status', ['referenced', 'network']),
        supabase.from('partner_documents').select('partner_profile_id,document_type,expires_at'),
      ])

      if ((pendingPartnerData as any).error) throw (pendingPartnerData as any).error
      setPendingPartnerApplications((pendingPartnerData as any).data || [])
      if ((matchingPartnerData as any).error) throw (matchingPartnerData as any).error
      if ((matchingDocumentData as any).error) throw (matchingDocumentData as any).error
      setMatchingPartners(((matchingPartnerData as any).data || []) as MatchingPartnerProfile[])
      setMatchingPartnerDocuments(((matchingDocumentData as any).data || []) as MatchingPartnerDocument[])
      setMissions(missionsData)
      setCollaborators((collabsData as any).data || [])
      setClients((clientsData as any).data || [])
      setAllUsers((allUsersData as any).data || [])
      setContactRequests((contactData as any).data || [])
      setPrices((pricesData as any).data || [])
      setPageViews(((viewsData as any).data || []).length)
      setSupportTickets(ticketsData || [])
      setCrmContacts((crmContactsData as any).data || [])
      setCrmInteractions((crmInteractionsData as any).data || [])
      setCrmTasks((crmTasksData as any).data || [])
      setSalesPipelines((salesPipelinesData as any).data || [])
      setPipelineStages((pipelineStagesData as any).data || [])
      setSalesOpportunities((salesOpportunitiesData as any).data || [])
      setCalendarEvents((calendarEventsData as any).data || [])
      setCollaboratorAvailabilities((collaboratorAvailabilitiesData as any).data || [])
      const existingContent = ((siteContentData as any).data || []) as SiteContent[]
      const missingPositioningContent = positioningContentSeeds.filter((seed) =>
        !existingContent.some((item) => item.section === seed.section && item.key === seed.key && item.language === seed.language),
      )
      const hasGeographicConfig = existingContent.some((item) => item.section === 'geographic' && item.key === geographicCoverageContentKey && item.language === 'fr')
      const missingGeographicConfig = hasGeographicConfig ? [] : [geographicCoverageContentSeed]
      let addedCmsContent: SiteContent[] = []
      if (missingPositioningContent.length + missingGeographicConfig.length > 0) {
        const { data, error: contentSeedError } = await supabase
          .from('site_content')
          .upsert([...missingPositioningContent, ...missingGeographicConfig].map((item) => ({ ...item, updated_by: adminId })), { onConflict: 'section,key,language' })
          .select('*')
        if (contentSeedError) throw contentSeedError
        addedCmsContent = (data || []) as SiteContent[]
      }
      const geographicConfigRow = [...existingContent, ...addedCmsContent].find((item) => item.section === 'geographic' && item.key === geographicCoverageContentKey && item.language === 'fr')
      setGeographicCoverage(geographicConfigRow ? parseGeographicCoverage(geographicConfigRow.content) : defaultGeographicCoverage)
      const storedTestimonials = existingContent
        .filter((item) => item.section === 'testimonials')
        .map(parseTestimonial)
        .filter((item): item is Testimonial => item !== null)
      setTestimonials(storedTestimonials)
      const storedPartnerLogos = existingContent
        .filter((item) => item.section === 'partner_logos')
        .map(parsePartnerLogo)
        .filter((item): item is PartnerLogo => item !== null)
      setPartnerLogos(storedPartnerLogos)
      setSiteContent([...existingContent.filter((item) => item.section !== 'testimonials' && item.section !== 'partner_logos' && item.section !== 'geographic'), ...addedCmsContent.filter((item) => item.section !== 'geographic')])
      setLegalDocuments((legalDocsData as any).data || [])
      
      // Charger tous les paramètres
      setPublicRegistrationEnabled(getSetting('public_registration_enabled', true))
      setMissionFormEnabled(getSetting('mission_form_enabled', true))
      const getTextSetting = (key: string, defaultValue: string) => settings.find((setting: any) => setting.key === key)?.value ?? defaultValue
      setContactPhone(getTextSetting('contact_phone', '+33 (0) 7 69 96 07 66'))
      setPhoneDisplayEnabled(getSetting('phone_display_enabled', true))
      setWhatsappNumber(getTextSetting('whatsapp_number', '+33 (0) 7 69 96 07 66'))
      setWhatsappDisplayEnabled(getSetting('whatsapp_display_enabled', false))
      setCrmEnabled(getSetting('crm_enabled', false))
      setSalesPipelineEnabled(getSetting('sales_pipeline_enabled', false))
      setInvoicesEnabled(getSetting('invoices_enabled', false))
      setSegmentationEnabled(getSetting('segmentation_enabled', false))
      setMarketingAutomationEnabled(getSetting('marketing_automation_enabled', false))
      setCalendarEnabled(getSetting('calendar_enabled', false))
      setDocumentManagementEnabled(getSetting('document_management_enabled', false))
      setAdvancedNotificationsEnabled(getSetting('advanced_notifications_enabled', false))
      setReportingEnabled(getSetting('reporting_enabled', false))
      setAuditLogsEnabled(getSetting('audit_logs_enabled', false))
      setSkillsManagementEnabled(getSetting('skills_management_enabled', false))
      setAvailabilityEnabled(getSetting('availability_enabled', false))
      setFeedbackEnabled(getSetting('feedback_enabled', false))
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUpdatePrice = async () => {
    if (!editingPrice || !supabase) return

    try {
      const { error: updateError } = await supabase
        .from('prices')
        .update(priceFormData)
        .eq('id', editingPrice.id)

      if (updateError) throw updateError

      setPrices((prev) =>
        prev.map((p) => (p.id === editingPrice.id ? { ...p, ...priceFormData } : p)),
      )
      setEditingPrice(null)
      setPriceFormData({ title_fr: '', title_en: '', description_fr: '', description_en: '', amount: '' })
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de mise à jour du tarif')
    }
  }

  const resetTestimonialForm = () => {
    setEditingTestimonialKey(null)
    setShowTestimonialForm(false)
    setTestimonialFormData({ name: '', organization: '', role: '', quote_fr: '', quote_en: '', consent_confirmed: false, is_published: false })
  }

  const handleSaveTestimonial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    if (testimonialFormData.is_published && !testimonialFormData.consent_confirmed) {
      setError('Confirmez l’autorisation de publication avant de publier ce témoignage.')
      return
    }

    const key = editingTestimonialKey ?? `experience-${crypto.randomUUID()}`
    try {
      const { data, error: saveError } = await supabase
        .from('site_content')
        .upsert({
          section: 'testimonials',
          key,
          language: 'fr',
          content: JSON.stringify(testimonialFormData),
          updated_at: new Date().toISOString(),
          updated_by: adminId,
        }, { onConflict: 'section,key,language' })
        .select('section,key,content')
        .single()
      if (saveError) throw saveError
      const savedTestimonial = parseTestimonial(data)
      if (!savedTestimonial) throw new Error('Le témoignage enregistré est incomplet.')

      setTestimonials((current) => current.some((item) => item.id === key)
        ? current.map((item) => item.id === key ? savedTestimonial : item)
        : [...current, savedTestimonial])
      setError(null)
      resetTestimonialForm()
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors de l’enregistrement du témoignage')
    }
  }

  const handleDeleteTestimonial = async (testimonialId: string) => {
    if (!supabase || !confirm('Supprimer définitivement ce témoignage ?')) return
    try {
      const { error: deleteError } = await supabase
        .from('site_content')
        .delete()
        .eq('section', 'testimonials')
        .eq('key', testimonialId)
        .eq('language', 'fr')
      if (deleteError) throw deleteError
      setTestimonials((current) => current.filter((item) => item.id !== testimonialId))
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors de la suppression du témoignage')
    }
  }

  const handleCreatePartnerLogo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !partnerLogoFile) return
    const formElement = event.currentTarget

    try {
      setIsSavingPartnerLogo(true)
      setError(null)
      const safeFileName = partnerLogoFile.name.replace(/[^\w.-]/g, '_')
      const logoPath = `managed/${crypto.randomUUID()}-${safeFileName}`
      const { error: uploadError } = await supabase.storage
        .from('partner-public-assets')
        .upload(logoPath, partnerLogoFile, { contentType: partnerLogoFile.type })
      if (uploadError) throw uploadError

      const key = `logo-${crypto.randomUUID()}`
      const { data, error: insertError } = await supabase
        .from('site_content')
        .insert({
          section: 'partner_logos',
          key,
          language: 'fr',
          content: JSON.stringify({ name: partnerLogoName.trim(), website: partnerLogoWebsite.trim(), logo_path: logoPath }),
          updated_by: adminId,
        })
        .select('section,key,content')
        .single()

      if (insertError) {
        await supabase.storage.from('partner-public-assets').remove([logoPath])
        throw insertError
      }
      const logo = parsePartnerLogo(data)
      if (!logo) throw new Error('Les informations du logo enregistré sont invalides.')

      setPartnerLogos((current) => [...current, logo])
      setPartnerLogoName('')
      setPartnerLogoWebsite('')
      setPartnerLogoFile(null)
      formElement.reset()
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors de l’ajout du logo partenaire')
    } finally {
      setIsSavingPartnerLogo(false)
    }
  }

  const handleDeletePartnerLogo = async (logo: PartnerLogo) => {
    if (!supabase || !confirm(`Retirer le logo de ${logo.name} du site ?`)) return
    try {
      const { error: deleteError } = await supabase
        .from('site_content')
        .delete()
        .eq('section', 'partner_logos')
        .eq('key', logo.id)
        .eq('language', 'fr')
      if (deleteError) throw deleteError

      setPartnerLogos((current) => current.filter((item) => item.id !== logo.id))
      const { error: storageError } = await supabase.storage.from('partner-public-assets').remove([logo.logo_path])
      if (storageError) console.error('Partner logo cleanup error:', storageError)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors de la suppression du logo partenaire')
    }
  }

  const handleToggleGeographicCountry = (group: keyof GeographicCoverageConfig, countryId: string, checked: boolean) => {
    setGeographicCoverageSaved(false)
    setGeographicCoverage((current) => ({
      ...current,
      [group]: checked
        ? [...new Set([...current[group], countryId])]
        : current[group].filter((id) => id !== countryId),
    }))
  }

  const handleSaveGeographicCoverage = async () => {
    if (!supabase) return
    try {
      setIsSavingGeographicCoverage(true)
      const { data, error: saveError } = await supabase
        .from('site_content')
        .upsert({
          section: 'geographic',
          key: geographicCoverageContentKey,
          language: 'fr',
          content: JSON.stringify(geographicCoverage),
          updated_at: new Date().toISOString(),
          updated_by: adminId,
        }, { onConflict: 'section,key,language' })
        .select('content')
        .single()
      if (saveError) throw saveError
      setGeographicCoverage(parseGeographicCoverage(data.content))
      setGeographicCoverageSaved(true)
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors de l’enregistrement de la carte')
    } finally {
      setIsSavingGeographicCoverage(false)
    }
  }

  const handleTogglePriceVisibility = async (price: SitePrice) => {
    if (!supabase) return
    const isVisible = price.is_visible !== false

    try {
      setUpdatingPriceId(price.id)
      const { error: updateError } = await supabase
        .from('prices')
        .update({ is_visible: !isVisible })
        .eq('id', price.id)
      if (updateError) throw updateError
      setPrices((current) => current.map((item) => item.id === price.id ? { ...item, is_visible: !isVisible } : item))
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de mise à jour de la visibilité du tarif')
    } finally {
      setUpdatingPriceId(null)
    }
  }

  const handleSavePublicContact = async () => {
    if (!supabase) return

    try {
      setIsUpdatingSettings(true)
      const { error: updateError } = await supabase.from('site_settings').upsert([
        { key: 'contact_phone', value: contactPhone },
        { key: 'phone_display_enabled', value: String(phoneDisplayEnabled) },
        { key: 'whatsapp_number', value: whatsappNumber },
        { key: 'whatsapp_display_enabled', value: String(whatsappDisplayEnabled) },
      ], { onConflict: 'key' })
      if (updateError) throw updateError
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors de l’enregistrement des coordonnées')
    } finally {
      setIsUpdatingSettings(false)
    }
  }

  const handleTogglePublicRegistration = async () => {
    if (!supabase) return

    try {
      setIsUpdatingSettings(true)
      const newValue = !publicRegistrationEnabled
      
      const { error: updateError } = await supabase
        .from('site_settings')
        .update({ value: newValue.toString() })
        .eq('key', 'public_registration_enabled')

      if (updateError) throw updateError

      setPublicRegistrationEnabled(newValue)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de mise à jour du paramètre')
    } finally {
      setIsUpdatingSettings(false)
    }
  }

  const handleToggleSetting = async (key: string, currentValue: boolean, setter: (value: boolean) => void) => {
    if (!supabase) return

    try {
      setIsUpdatingSettings(true)
      const newValue = !currentValue
      
      const { error: updateError } = await supabase
        .from('site_settings')
        .update({ value: newValue.toString() })
        .eq('key', key)

      if (updateError) throw updateError

      setter(newValue)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de mise à jour du paramètre')
    } finally {
      setIsUpdatingSettings(false)
    }
  }

  const handleUploadLegalDocument = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!supabase || !legalDocFile) return
    const formElement = e.currentTarget

    try {
      setUploadingLegalDoc(true)
      setError(null)

      const fileName = `${Date.now()}_${legalDocFile.name}`
      const filePath = `legal-documents/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('legal-documents')
        .upload(filePath, legalDocFile)

      if (uploadError) throw uploadError

      const documentValues = {
          type: legalDocType,
          file_name: legalDocFile.name,
          file_path: filePath,
          updated_by: adminId,
          updated_at: new Date().toISOString(),
      }
      const { error: dbError } = editingLegalDocId
        ? await supabase.from('legal_documents').update(documentValues).eq('id', editingLegalDocId)
        : await supabase.from('legal_documents').insert(documentValues)

      if (dbError) {
        await supabase.storage.from('legal-documents').remove([filePath])
        throw dbError
      }

      if (editingLegalDocId) {
        const previousDoc = legalDocuments.find((doc) => doc.id === editingLegalDocId)
        if (previousDoc) {
          const { error: removeError } = await supabase.storage.from('legal-documents').remove([previousDoc.file_path])
          if (removeError) console.error('Previous legal document cleanup error:', removeError)
        }
      }

      const { data: updatedDocs } = await supabase
        .from('legal_documents')
        .select('*')
        .order('updated_at', { ascending: false })

      setLegalDocuments((updatedDocs as any) || [])
      setLegalDocFile(null)
      setEditingLegalDocId(null)
      setLegalDocType('mentions_legales')
      formElement.reset()
      alert(editingLegalDocId ? '✅ Document juridique remplacé avec succès!' : '✅ Document juridique téléchargé avec succès!')
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors du téléchargement')
    } finally {
      setUploadingLegalDoc(false)
    }
  }

  const handleDeleteLegalDocument = async (id: string, filePath: string) => {
    if (!supabase || !confirm('Supprimer ce document juridique ?')) return

    try {
      const { error: storageError } = await supabase.storage
        .from('legal-documents')
        .remove([filePath])

      if (storageError) {
        console.error('Storage delete error:', storageError)
      }

      const { error: dbError } = await supabase
        .from('legal_documents')
        .delete()
        .eq('id', id)

      if (dbError) throw dbError

      setLegalDocuments((prev) => prev.filter((doc) => doc.id !== id))
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors de la suppression')
    }
  }

  const handleDownloadLegalDocument = async (filePath: string, fileName: string) => {
    if (!supabase) return

    try {
      const { data, error } = await supabase.storage
        .from('legal-documents')
        .createSignedUrl(filePath, 3600)

      if (error) throw error

      const link = document.createElement('a')
      link.href = data.signedUrl
      link.download = fileName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur lors du téléchargement')
    }
  }

  const handleDeleteContact = async (id: string) => {
    if (!supabase || !confirm('Supprimer ce message ?')) return

    try {
      const { error: deleteError } = await supabase
        .from('contact_requests')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setContactRequests((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de suppression')
    }
  }

  const handleUpdateContactStatus = async (id: string, status: string) => {
    if (!supabase) return

    try {
      const { error: updateError } = await supabase
        .from('contact_requests')
        .update({ status })
        .eq('id', id)

      if (updateError) throw updateError

      setContactRequests((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de mise à jour du message')
    }
  }

  const handleCreateCollaborator = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Double-check: prevent concurrent requests
    if (isCreatingCollab) {
      console.warn('Request already in progress')
      return
    }
    
    if (!supabase || !collabFormData.email || !collabFormData.password || !collabFormData.full_name) {
      setError('Remplissez tous les champs requis (Nom, Email, Mot de passe)')
      return
    }

    if (collabFormData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    try {
      setError(null)
      setIsCreatingCollab(true)

      // Step 1: Create auth user (single request)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: collabFormData.email.toLowerCase(),
        password: collabFormData.password,
      })

      if (authError) {
        console.error('Auth error:', authError.message)
        
        if (authError.message?.includes('429')) {
          setError('⚠️ Rate limit. Veuillez attendre 30 secondes et réessayer.')
        } else if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
          setError('❌ Cet email est déjà utilisé')
        } else {
          setError(`❌ Erreur: ${authError.message || 'Authentification échouée'}`)
        }
        
        setIsCreatingCollab(false)
        return
      }

      if (!authData.user) {
        throw new Error('Création utilisateur échouée')
      }

      // Small delay to ensure auth is synced (300ms instead of 500)
      await new Promise(resolve => setTimeout(resolve, 300))

      // Step 2: Create profile in users table
      const { error: profileError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: collabFormData.email.toLowerCase(),
        full_name: collabFormData.full_name,
        company: collabFormData.company || '',
        role: 'collaborator',
        is_active: true,
      })

      if (profileError) {
        console.error('Profile error:', profileError.message)
        throw profileError
      }

      // Step 3: Reload collaborators (small delay)
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const { data: collabsData } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'collaborator')
        .order('created_at', { ascending: false })

      setCollaborators((collabsData as any) || [])
      
      // Reset form
      const email = collabFormData.email
      setCollabFormData({ email: '', password: '', full_name: '', company: '' })
      setShowCollabForm(false)
      setError(null)
      setIsCreatingCollab(false)
      
      // Success message
      alert(`✅ Collaborateur créé!\n\nEmail: ${email}\nIl peut se connecter maintenant.`)
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      setError(`❌ ${errorMsg}`)
      console.error('Error creating collaborator:', err)
      setIsCreatingCollab(false)
    }
  }

  // Creates a client account (used when an admin creates a mission for a
  // brand-new client) and resolves the flow to that client's id.
  const handleCreateClientForMission = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (isCreatingClient) return

    if (!supabase || !newClientFormData.email || !newClientFormData.full_name) {
      setError('Remplissez les champs requis (Nom et Email)')
      return
    }

    try {
      setError(null)
      setIsCreatingClient(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Session administrateur introuvable')

      const response = await fetch('/api/admin-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          email: newClientFormData.email,
          fullName: newClientFormData.full_name,
          company: newClientFormData.company,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Invitation du client impossible')
      if (!result.userId) throw new Error('L’invitation ne contient pas d’identifiant client')

      setNewClientFormData({ email: '', full_name: '', company: '' })
      setResolvedClientId(result.userId)
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err) || 'Invitation du client impossible')
    } finally {
      setIsCreatingClient(false)
    }
  }

  const handleUseExistingClient = () => {
    if (!selectedExistingClientId) {
      setError('Sélectionnez un client')
      return
    }
    setResolvedClientId(selectedExistingClientId)
  }

  const handleAdminMissionSaved = () => {
    loadData()
    setShowCreateMissionForClient(false)
    setResolvedClientId(null)
    setSelectedExistingClientId('')
    setMissionClientMode('existing')
    alert('✅ Mission créée pour le client !')
  }

  const handleCancelAdminMissionCreation = () => {
    setShowCreateMissionForClient(false)
    setResolvedClientId(null)
    setSelectedExistingClientId('')
    setMissionClientMode('existing')
    setNewClientFormData({ email: '', full_name: '', company: '' })
  }

  // Calls one of the /api/notify-* endpoints with the current session token so
  // the server can verify the caller is authenticated (best-effort, non-blocking).
  const notifyApi = async (endpoint: string, body: Record<string, unknown>) => {
    if (!supabase) return
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
    } catch {
      // Notification is a nice-to-have; ignore failures
    }
  }

  const handleValidateMission = async (missionId: string) => {
    if (!supabase) return

    try {
      const mission = missions.find((m) => m.id === missionId)

      console.log('Validating mission:', missionId)

      const { error: updateError } = await supabase
        .from('missions')
        .update({ validation_status: 'validated' })
        .eq('id', missionId)

      if (updateError) {
        console.error('Validation error:', updateError)
        throw updateError
      }

      console.log('Mission validated successfully')

      setMissions((prev) =>
        prev.map((m) => (m.id === missionId ? { ...m, validation_status: 'validated' } : m)),
      )
      setSelectedMission(null)

      // Notify the client that their mission result is ready (best-effort, non-blocking)
      if (mission) {
        supabase
          .from('users')
          .select('email, full_name')
          .eq('id', mission.client_id)
          .single()
          .then(({ data }) => {
            if (data?.email) {
              notifyApi('/api/notify-client', {
                clientEmail: data.email,
                clientName: data.full_name,
                missionTitle: mission.title,
                event: 'validated',
              })
            }
          })
      }

      alert('✅ Mission validée avec succès!')
    } catch (err) {
      console.error('Error validating mission:', err)
      const errorMsg = getErrorMessage(err)
      setError(`❌ Erreur de validation: ${errorMsg}`)
      alert(`❌ Erreur de validation: ${errorMsg}`)
    }
  }

  const handleRejectMission = async (missionId: string, notes: string) => {
    if (!supabase || !notes.trim()) {
      setError('Veuillez ajouter une raison du rejet')
      return
    }

    try {
      // Reset status to in_progress so the collaborator can correct the work and resubmit
      const { error: updateError } = await supabase
        .from('missions')
        .update({ validation_status: 'rejected', validation_notes: notes, status: 'in_progress' })
        .eq('id', missionId)

      if (updateError) throw updateError

      setMissions((prev) =>
        prev.map((m) =>
          m.id === missionId
            ? { ...m, validation_status: 'rejected', validation_notes: notes, status: 'in_progress' }
            : m,
        ),
      )
      setSelectedMission(null)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de rejet')
    }
  }

  const handleAssignMissionToCollab = async (collabId: string, missionId: string) => {
    try {
      await assignments.assignMission(missionId, collabId, adminId)
      setMissions((prev) =>
        prev.map((m) => (m.id === missionId ? { ...m, assigned_to: collabId } : m)),
      )
      setSelectedCollabForMission(null)

      const collaborator = collaborators.find((c) => c.id === collabId)
      const mission = missions.find((m) => m.id === missionId)
      if (collaborator && mission) {
        notifyApi('/api/notify-collaborator', {
          collaboratorEmail: collaborator.email,
          collaboratorName: collaborator.full_name,
          missionTitle: mission.title,
          missionLocation: mission.location,
        })
      }
      return true
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur d\'assignation')
      return false
    }
  }

  const handleAssignRecommendedPartner = async (partner: MatchingPartnerProfile) => {
    if (!missionForRecommendations || !partner.user_id || assigningRecommendedPartnerId) return
    if (!window.confirm(`Affecter « ${partner.business_name} » à la mission « ${missionForRecommendations.title} » ?`)) return

    setAssigningRecommendedPartnerId(partner.user_id)
    try {
      const assigned = await handleAssignMissionToCollab(partner.user_id, missionForRecommendations.id)
      if (assigned) {
        setMissions((current) => current.map((mission) => mission.id === missionForRecommendations.id
          ? { ...mission, assigned_to: partner.user_id || undefined, partner_profile_id: partner.id }
          : mission))
        setMissionForRecommendations(null)
      }
    } finally {
      setAssigningRecommendedPartnerId(null)
    }
  }

  const handleAssignMission = async (mission: Mission) => {
    if (!selectedCollaborator) {
      alert('Sélectionnez un collaborateur')
      return
    }

    try {
      await assignments.assignMission(mission.id, selectedCollaborator, adminId)
      setMissions((prev) =>
        prev.map((m) => (m.id === mission.id ? { ...m, assigned_to: selectedCollaborator } : m)),
      )
      setSelectedMission(null)

      const collaborator = collaborators.find((c) => c.id === selectedCollaborator)
      if (collaborator) {
        notifyApi('/api/notify-collaborator', {
          collaboratorEmail: collaborator.email,
          collaboratorName: collaborator.full_name,
          missionTitle: mission.title,
          missionLocation: mission.location,
        })
      }

      setSelectedCollaborator('')
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur d\'assignation')
    }
  }

  const handleUpdateMissionStatus = async (missionId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('missions')
        .update({ status: newStatus })
        .eq('id', missionId)

      if (error) throw error

      setMissions((prev) =>
        prev.map((m) => (m.id === missionId ? { ...m, status: newStatus as any } : m)),
      )
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de mise à jour du statut')
    }
  }

  // User role management handlers
  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      setIsUpdatingRole(true)
      await usersAPI.updateUserRole(userId, newRole)
      
      // Reload data
      await loadData()
      setEditingUserRole(null)
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de mise à jour du rôle')
    } finally {
      setIsUpdatingRole(false)
    }
  }

  const handleToggleUserActive = async (userId: string, isActive: boolean) => {
    try {
      await usersAPI.toggleUserActive(userId, isActive)
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de mise à jour du statut utilisateur')
    }
  }

  // Support ticket handlers
  const handleCreateTicket = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!supabase || !ticketFormData.subject || !ticketFormData.description) return

    try {
      await support.createTicket({
        user_id: adminId,
        subject: ticketFormData.subject,
        description: ticketFormData.description,
        status: 'open',
        priority: ticketFormData.priority,
      })
      
      setTicketFormData({ subject: '', description: '', priority: 'medium' })
      setShowTicketForm(false)
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de création du ticket')
    }
  }

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: 'open' | 'in_progress' | 'resolved' | 'closed') => {
    try {
      await support.updateTicket(ticketId, { status: newStatus })
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de mise à jour du ticket')
    }
  }

  const handleAssignTicket = async (ticketId: string, assignedTo: string) => {
    try {
      await support.assignTicket(ticketId, assignedTo)
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur d\'assignation du ticket')
    }
  }

  const handleResolveTicket = async (ticketId: string) => {
    try {
      await support.resolveTicket(ticketId)
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de résolution du ticket')
    }
  }

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce ticket ?')) return

    try {
      await support.deleteTicket(ticketId)
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur de suppression du ticket')
    }
  }


  if (loading) return <div className="admin-dash-loading">Chargement...</div>

  const needsReviewCount = missions.filter(
    (m) => m.status === 'completed' && (m.validation_status ?? 'pending') === 'pending',
  ).length
  const submittedMissionCount = missions.filter((mission) => mission.status === 'submitted').length
  const newContactCount = contactRequests.filter((request) => request.status === 'new').length

  return (
    <div className="admin-dashboard">
      <header className="admin-dash-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ margin: 0 }}>Tableau de bord administrateur</h1>
          <button onClick={() => loadData()} className="btn-refresh" title="Recharger les dernières données">
            🔄 Actualiser
          </button>
        </div>
        <div className="admin-tabs-nav">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            À traiter
            {pendingPartnerApplications.length + submittedMissionCount + needsReviewCount + newContactCount > 0 && <span className="badge-alert">{pendingPartnerApplications.length + submittedMissionCount + needsReviewCount + newContactCount}</span>}
          </button>
          <button
            className={activeTab === 'missions' ? 'active' : ''}
            onClick={() => setActiveTab('missions')}
          >
            📋 Missions ({missions.length})
            {needsReviewCount > 0 && <span className="badge-alert">{needsReviewCount}</span>}
          </button>
          <button
            className={activeTab === 'collaborators' ? 'active' : ''}
            onClick={() => setActiveTab('collaborators')}
          >
            👥 Collaborateurs ({collaborators.length})
          </button>
          <button
            className={activeTab === 'partners' ? 'active' : ''}
            onClick={() => setActiveTab('partners')}
          >
            🤝 Partenaires
          </button>
          <button
            className={activeTab === 'team' ? 'active' : ''}
            onClick={() => setActiveTab('team')}
          >
            Équipe & droits
          </button>
          <button
            className={activeTab === 'clients' ? 'active' : ''}
            onClick={() => setActiveTab('clients')}
          >
            🏢 Clients ({clients.length})
          </button>
          <button
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
          >
            👤 Utilisateurs ({allUsers.length})
          </button>
          <button
            className={activeTab === 'messages' ? 'active' : ''}
            onClick={() => setActiveTab('messages')}
          >
            💬 Messages ({contactRequests.length})
          </button>
          <button
            className={activeTab === 'support' ? 'active' : ''}
            onClick={() => setActiveTab('support')}
          >
            🎫 Support ({supportTickets.length})
          </button>
          <button
            className={activeTab === 'tarifs' ? 'active' : ''}
            onClick={() => setActiveTab('tarifs')}
          >
            💰 Tarifs ({prices.length})
          </button>
          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Paramètres
          </button>
          {crmEnabled && (
            <button
              className={activeTab === 'crm' ? 'active' : ''}
              onClick={() => setActiveTab('crm')}
            >
              👥 CRM ({crmContacts.length})
            </button>
          )}
          {salesPipelineEnabled && (
            <button
              className={activeTab === 'pipeline' ? 'active' : ''}
              onClick={() => setActiveTab('pipeline')}
            >
              📊 Pipeline ({salesOpportunities.length})
            </button>
          )}
          {calendarEnabled && (
            <button
              className={activeTab === 'calendar' ? 'active' : ''}
              onClick={() => setActiveTab('calendar')}
            >
              📅 Calendrier ({calendarEvents.length})
            </button>
          )}
          <button
            className={activeTab === 'geographic' ? 'active' : ''}
            onClick={() => setActiveTab('geographic')}
          >
            🌍 Carte
          </button>
          <button
            className={activeTab === 'content' ? 'active' : ''}
            onClick={() => setActiveTab('content')}
          >
            📝 Contenu ({siteContent.length})
          </button>
          <button
            className={activeTab === 'testimonials' ? 'active' : ''}
            onClick={() => setActiveTab('testimonials')}
          >
            💬 Témoignages ({testimonials.length})
          </button>
          <button
            className={activeTab === 'logos' ? 'active' : ''}
            onClick={() => setActiveTab('logos')}
          >
            🖼️ Logos partenaires ({partnerLogos.length})
          </button>
          <button
            className={activeTab === 'stats' ? 'active' : ''}
            onClick={() => setActiveTab('stats')}
          >
            📊 Statistiques
          </button>
          {canManageDocumentLibrary && <button
            className={activeTab === 'document-library' ? 'active' : ''}
            onClick={() => setActiveTab('document-library')}
          >
            📚 Bibliothèque de documents
          </button>}
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}

      {activeTab === 'partners' && <PartnerManagement adminId={adminId} />}
      {activeTab === 'team' && <AdminTeamAccess />}
      {canManageDocumentLibrary && activeTab === 'document-library' && <DocumentLibrary adminId={adminId} />}

      {activeTab === 'overview' && (
        <section className="admin-section admin-action-overview">
          <h2>À traiter</h2>
          <p>Les éléments qui nécessitent une action apparaissent ici.</p>
          <div className="admin-action-list">
            {pendingPartnerApplications.length > 0 && <article className="admin-action-row">
              <div><strong>Candidatures partenaires</strong><span>{pendingPartnerApplications.slice(0, 3).map((partner) => partner.business_name).filter(Boolean).join(' · ')}</span></div>
              <strong className="admin-action-count">{pendingPartnerApplications.length}</strong>
              <button type="button" onClick={() => setActiveTab('partners')}>Examiner</button>
            </article>}
            {submittedMissionCount > 0 && <article className="admin-action-row">
              <div><strong>Nouvelles demandes de mission</strong><span>Demandes envoyées par les clients à qualifier.</span></div>
              <strong className="admin-action-count">{submittedMissionCount}</strong>
              <button type="button" onClick={() => setActiveTab('missions')}>Ouvrir</button>
            </article>}
            {needsReviewCount > 0 && <article className="admin-action-row">
              <div><strong>Livrables à valider</strong><span>Missions clôturées par un collaborateur.</span></div>
              <strong className="admin-action-count">{needsReviewCount}</strong>
              <button type="button" onClick={() => setActiveTab('missions')}>Valider</button>
            </article>}
            {newContactCount > 0 && <article className="admin-action-row">
              <div><strong>Nouvelles demandes de contact</strong><span>Messages en attente de traitement.</span></div>
              <strong className="admin-action-count">{newContactCount}</strong>
              <button type="button" onClick={() => setActiveTab('messages')}>Lire</button>
            </article>}
            {pendingPartnerApplications.length + submittedMissionCount + needsReviewCount + newContactCount === 0 && (
              <p className="admin-action-empty">Aucune action urgente pour le moment.</p>
            )}
          </div>
        </section>
      )}

      {activeTab === 'missions' && (
        <section className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Gestion des missions</h2>
            <button
              onClick={() => setShowCreateMissionForClient(!showCreateMissionForClient)}
              className="btn-edit"
              style={{ padding: '0.6rem 1.2rem', cursor: 'pointer' }}
            >
              {showCreateMissionForClient ? '✕ Annuler' : '➕ Créer une mission pour un client'}
            </button>
          </div>

          {showCreateMissionForClient && (
            <div className="create-mission-panel">
              {!resolvedClientId ? (
                <>
                  <div className="client-mode-toggle">
                    <button
                      type="button"
                      className={missionClientMode === 'existing' ? 'active' : ''}
                      onClick={() => setMissionClientMode('existing')}
                    >
                      Client existant
                    </button>
                    <button
                      type="button"
                      className={missionClientMode === 'new' ? 'active' : ''}
                      onClick={() => setMissionClientMode('new')}
                    >
                      Nouveau client
                    </button>
                  </div>

                  {missionClientMode === 'existing' ? (
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label>Sélectionner un client</label>
                      <select
                        value={selectedExistingClientId}
                        onChange={(e) => setSelectedExistingClientId(e.target.value)}
                      >
                        <option value="">-- Choisir un client --</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name} ({c.email})
                          </option>
                        ))}
                      </select>
                      <button onClick={handleUseExistingClient} className="btn-confirm" style={{ marginTop: '1rem' }}>
                        Continuer avec ce client
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleCreateClientForMission} className="collab-form" style={{ marginTop: '1rem' }}>
                      <div className="form-group">
                        <label>Nom complet *</label>
                        <input
                          type="text"
                          value={newClientFormData.full_name}
                          onChange={(e) => setNewClientFormData({ ...newClientFormData, full_name: e.target.value })}
                          placeholder="Jean Dupont"
                          disabled={isCreatingClient}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Email *</label>
                        <input
                          type="email"
                          value={newClientFormData.email}
                          onChange={(e) => setNewClientFormData({ ...newClientFormData, email: e.target.value })}
                          placeholder="client@example.com"
                          disabled={isCreatingClient}
                          required
                          autoComplete="email"
                        />
                      </div>
                      <div className="form-group">
                        <label>Entreprise</label>
                        <input
                          type="text"
                          value={newClientFormData.company}
                          onChange={(e) => setNewClientFormData({ ...newClientFormData, company: e.target.value })}
                          placeholder="Société du client"
                          disabled={isCreatingClient}
                        />
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#65696a' }}>
                        Le client recevra une invitation par email pour définir son mot de passe. Vous pourrez ensuite préparer sa première mission.
                      </p>
                      <button type="submit" className="btn-confirm" disabled={isCreatingClient} style={{ width: '100%' }}>
                        {isCreatingClient ? '⏳ Envoi de l’invitation...' : 'Inviter le client et continuer'}
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <MissionForm
                  clientId={resolvedClientId}
                  onSave={handleAdminMissionSaved}
                  onCancel={handleCancelAdminMissionCreation}
                />
              )}
            </div>
          )}

          {needsReviewCount > 0 && (
            <div className="review-banner">
              🔔 {needsReviewCount} mission{needsReviewCount > 1 ? 's' : ''} clôturée{needsReviewCount > 1 ? 's' : ''} par un collaborateur en attente de votre validation.
            </div>
          )}
          {missions.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#faf9f7', borderRadius: '8px', border: '1px solid #c9c4b9' }}>
              <p style={{ fontSize: '1.1rem', color: '#65696a', marginBottom: '1rem' }}>
                Aucune mission n'a été créée pour le moment.
              </p>
              <button
                onClick={() => setShowCreateMissionForClient(true)}
                className="btn-confirm"
                style={{ padding: '0.75rem 1.5rem' }}
              >
                ➕ Créer une première mission
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: viewMode === 'list' ? '#ae8339' : '#e8e5d8',
                    color: viewMode === 'list' ? 'white' : '#171819',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginRight: '0.5rem'
                  }}
                >
                  📋 Vue Tableau
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: viewMode === 'cards' ? '#ae8339' : '#e8e5d8',
                    color: viewMode === 'cards' ? 'white' : '#171819',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  📇 Vue Cartes
                </button>
              </div>

              {viewMode === 'list' ? (
                <div className="missions-table-wrapper">
                  <table className="missions-table">
                    <thead>
                      <tr>
                        <th>Titre</th>
                        <th>Type</th>
                        <th>Statut</th>
                        <th>Validation</th>
                        <th>Assigné à</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missions.map((mission) => (
                        <tr
                          key={mission.id}
                          className={
                            mission.status === 'completed' && (mission.validation_status ?? 'pending') === 'pending'
                              ? 'row-needs-review'
                              : ''
                          }
                        >
                          <td className="cell-title">{mission.title}</td>
                          <td>{missionTypeLabels[mission.mission_type].fr}</td>
                          <td>
                            <select
                              value={mission.status}
                              onChange={(e) => handleUpdateMissionStatus(mission.id, e.target.value)}
                              className="status-select"
                            >
                              {Object.entries(missionStatusLabels).map(([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span className={`validation-badge validation-${mission.validation_status || 'pending'}`}>
                              {mission.validation_status === 'pending' && '⏳ En attente'}
                              {mission.validation_status === 'validated' && '✓ Validé'}
                              {mission.validation_status === 'rejected' && '✗ Rejeté'}
                            </span>
                          </td>
                          <td>
                            {mission.assigned_to ? (
                              <span className="assigned-badge">
                                {collaborators.find((c) => c.id === mission.assigned_to)?.full_name || 'Assigné'}
                              </span>
                            ) : (
                              <span className="unassigned-badge">Non assignée</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => {
                                  setSelectedMission(mission)
                                  setViewMode('details')
                                  setShowValidationModal(false)
                                }}
                                style={{
                                  backgroundColor: '#ae8339',
                                  color: 'white',
                                  border: 'none',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: '500',
                                  fontSize: '0.9rem'
                                }}
                              >
                                👁️ Voir
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedMission(mission)
                                  setValidationNotes('')
                                  setShowValidationModal(true)
                                  setViewMode('validation')
                                }}
                                className="btn-validate"
                                disabled={mission.status !== 'completed' || mission.validation_status === 'validated'}
                                title="Valider le résultat"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedMission(mission)
                                  setValidationNotes('')
                                  setShowValidationModal(true)
                                  setViewMode('validation')
                                }}
                                className="btn-reject"
                                disabled={mission.validation_status === 'rejected'}
                                title="Rejeter/demander corrections"
                              >
                                ✗
                              </button>
                              <button
                                type="button"
                                className="btn-partner-match"
                                onClick={() => setMissionForRecommendations(mission)}
                                title="Voir les partenaires les plus adaptés"
                              >
                                Recommander
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCollaborator('')
                                  setShowValidationModal(false)
                                  setSelectedMission(mission)
                                }}
                                className="btn-assign"
                                title={mission.assigned_to ? 'Réaffecter à un autre collaborateur' : 'Affecter à un collaborateur'}
                              >
                                🔗
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  {missions.map((mission) => (
                    <div
                      key={mission.id}
                      style={{
                        border: '1px solid #c9c4b9',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        backgroundColor: 'white',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <h3 style={{ margin: '0 0 1rem 0', color: '#171819' }}>{mission.title}</h3>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Type:</strong> {missionTypeLabels[mission.mission_type].fr}
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Statut:</strong>
                        <select
                          value={mission.status}
                          onChange={(e) => handleUpdateMissionStatus(mission.id, e.target.value)}
                          style={{
                            marginLeft: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #c9c4b9',
                            fontSize: '0.9rem'
                          }}
                        >
                          {Object.entries(missionStatusLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Validation:</strong> {mission.validation_status === 'validated' ? '✓ Validé' : mission.validation_status === 'rejected' ? '✗ Rejeté' : '⏳ En attente'}
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Lieu:</strong> {mission.location}
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Assigné à:</strong> {mission.assigned_to ? (collaborators.find((c) => c.id === mission.assigned_to)?.full_name || 'Assigné') : 'Non assignée'}
                      </div>
                      {mission.description && (
                        <div style={{ marginBottom: '1rem', color: '#65696a', fontSize: '0.9rem', lineHeight: '1.4' }}>
                          {mission.description.substring(0, 150)}{mission.description.length > 150 ? '...' : ''}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                        <button
                          onClick={() => {
                            setSelectedMission(mission)
                            setViewMode('details')
                            setShowValidationModal(false)
                          }}
                          style={{
                            backgroundColor: '#ae8339',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '0.9rem'
                          }}
                        >
                          👁️ Voir détails
                        </button>
                        <button
                          type="button"
                          className="btn-partner-match"
                          onClick={() => setMissionForRecommendations(mission)}
                        >
                          Recommander un partenaire
                        </button>
                        {mission.status !== 'completed' && (
                          <button
                            onClick={() => {
                              setEditingMission(mission)
                              setViewMode('edit')
                            }}
                            style={{
                              backgroundColor: '#171819',
                              color: 'white',
                              border: 'none',
                              padding: '0.5rem 1rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '500',
                              fontSize: '0.9rem'
                            }}
                          >
                            ✏️ Modifier
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {selectedMission && (
            <div className="assignment-modal">
              <div className="modal-content">
                {viewMode === 'details' ? (
                  <>
                    <h3>Détails de la mission</h3>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <p><strong>Titre:</strong> {selectedMission.title}</p>
                      <p><strong>Type:</strong> {missionTypeLabels[selectedMission.mission_type].fr}</p>
                      <p><strong>Statut:</strong> {missionStatusLabels[selectedMission.status]}</p>
                      <p><strong>Validation:</strong> {selectedMission.validation_status === 'validated' ? '✓ Validé' : selectedMission.validation_status === 'rejected' ? '✗ Rejeté' : '⏳ En attente'}</p>
                      <p><strong>Lieu:</strong> {selectedMission.location}</p>
                      {selectedMission.budget && <p><strong>Budget:</strong> {selectedMission.budget}</p>}
                      <p><strong>Créée le:</strong> {new Date(selectedMission.created_at).toLocaleDateString('fr-FR')}</p>
                      {selectedMission.description && (
                        <div style={{ marginTop: '1rem' }}>
                          <strong>Description:</strong>
                          <p style={{ marginTop: '0.5rem', lineHeight: '1.5' }}>{selectedMission.description}</p>
                        </div>
                      )}
                    </div>

                    {selectedMission.requirements && Object.keys(selectedMission.requirements).length > 0 && (
                      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0' }}>Exigences de la mission</h4>
                        {Object.entries(selectedMission.requirements).map(([key, value]) => {
                          if (key === 'collaborator_data') return null
                          return (
                            <div key={key} style={{ marginBottom: '0.5rem' }}>
                              <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {selectedMission.validation_notes && (
                      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                        <strong>Notes de validation:</strong>
                        <p style={{ marginTop: '0.5rem', margin: '0' }}>{selectedMission.validation_notes}</p>
                      </div>
                    )}

                    <div className="modal-actions">
                      <button
                        onClick={() => {
                          console.log('Closing modal')
                          setSelectedMission(null)
                          setViewMode('details')
                        }}
                        className="btn-cancel"
                      >
                        Fermer
                      </button>
                      {selectedMission.status !== 'completed' && (
                        <button
                          onClick={() => {
                            console.log('Editing mission:', selectedMission.id)
                            setEditingMission(selectedMission)
                            setViewMode('edit')
                          }}
                          className="btn-edit"
                        >
                          Modifier
                        </button>
                      )}
                      {selectedMission.status === 'completed' && selectedMission.validation_status !== 'validated' && (
                        <button
                          onClick={() => {
                            setValidationNotes('')
                            setShowValidationModal(true)
                            setViewMode('validation')
                          }}
                          className="btn-confirm"
                        >
                          Passer en mode validation
                        </button>
                      )}
                    </div>
                  </>
                ) : showValidationModal ? (
                  <>
                    <h3>Valider ou Rejeter la mission</h3>
                    <p>Mission: {selectedMission.title}</p>

                    {selectedMission.requirements?.collaborator_data ? (
                      <div className="collab-data-review">
                        <h4>📝 Informations soumises par le collaborateur</h4>
                        {selectedMission.requirements.collaborator_data.checklist_results &&
                          Object.keys(selectedMission.requirements.collaborator_data.checklist_results).length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                              <strong>Points de contrôle:</strong>
                              <ul style={{ margin: '0.4rem 0 0 0', paddingLeft: '1.2rem' }}>
                                {Object.entries(selectedMission.requirements.collaborator_data.checklist_results).map(
                                  ([item, answer]: [string, any]) => (
                                    <li key={item} style={{ marginBottom: '0.3rem' }}>
                                      {answer?.checked ? '✅' : '⬜'} {item}
                                      {answer?.note && <em> — {answer.note}</em>}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                        {selectedMission.requirements.collaborator_data.observations && (
                          <p>
                            <strong>🔍 Observations:</strong>{' '}
                            {selectedMission.requirements.collaborator_data.observations}
                          </p>
                        )}
                        {selectedMission.requirements.collaborator_data.results && (
                          <p>
                            <strong>✓ Résultats:</strong> {selectedMission.requirements.collaborator_data.results}
                          </p>
                        )}
                        {selectedMission.requirements.collaborator_data.findings && (
                          <p>
                            <strong>🎯 Constatations:</strong>{' '}
                            {selectedMission.requirements.collaborator_data.findings}
                          </p>
                        )}
                        {selectedMission.requirements.collaborator_data.notes && (
                          <p>
                            <strong>📌 Notes:</strong> {selectedMission.requirements.collaborator_data.notes}
                          </p>
                        )}
                        {Array.isArray(selectedMission.requirements.collaborator_data.photos) &&
                          selectedMission.requirements.collaborator_data.photos.length > 0 && (
                            <div className="photos-grid">
                              {selectedMission.requirements.collaborator_data.photos.map(
                                (photo: any, index: number) => (
                                  <div key={index} className="photo-item">
                                    <img 
                                      src={typeof photo === 'string' ? photo : photo.url} 
                                      alt={typeof photo === 'string' ? `Photo ${index + 1}` : photo.name || `Photo ${index + 1}`} 
                                    />
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                      </div>
                    ) : (
                      <p style={{ color: '#ae8339', fontSize: '0.9rem' }}>
                        ⚠️ Le collaborateur n'a pas encore renseigné d'informations pour cette mission.
                      </p>
                    )}

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Notes (raison du rejet ou commentaires):
                      </label>
                      <textarea
                        value={validationNotes}
                        onChange={(e) => setValidationNotes(e.target.value)}
                        placeholder="Ex: Travail incomplet. Veuillez ajouter les photos manquantes."
                        style={{
                          width: '100%',
                          height: '100px',
                          padding: '0.75rem',
                          borderRadius: '4px',
                          border: '1px solid #ccc',
                          fontFamily: 'inherit',
                          fontSize: '0.95rem',
                        }}
                      />
                    </div>

                    <div className="modal-actions">
                      <button
                        onClick={() => {
                          handleValidateMission(selectedMission.id)
                          setValidationNotes('')
                          setShowValidationModal(false)
                          setViewMode('details')
                        }}
                        className="btn-confirm"
                        style={{ backgroundColor: '#28a745' }}
                      >
                        ✓ Valider
                      </button>
                      <button
                        onClick={() => {
                          handleRejectMission(selectedMission.id, validationNotes)
                          setValidationNotes('')
                          setShowValidationModal(false)
                          setViewMode('details')
                        }}
                        className="btn-reject"
                        disabled={!validationNotes.trim()}
                      >
                        ✗ Rejeter
                      </button>
                      <button
                        onClick={() => {
                          setValidationNotes('')
                          setShowValidationModal(false)
                          setViewMode('details')
                        }}
                        className="btn-cancel"
                      >
                        Retour aux détails
                      </button>
                    </div>
                  </>
                ) : viewMode === 'edit' && editingMission ? (
                  <>
                    <h3>Modifier la mission</h3>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Titre:
                        </label>
                        <input
                          type="text"
                          value={editingMission.title}
                          onChange={(e) => setEditingMission({ ...editingMission, title: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Description:
                        </label>
                        <textarea
                          value={editingMission.description || ''}
                          onChange={(e) => setEditingMission({ ...editingMission, description: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            minHeight: '100px',
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Lieu:
                        </label>
                        <input
                          type="text"
                          value={editingMission.location}
                          onChange={(e) => setEditingMission({ ...editingMission, location: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Budget:
                        </label>
                        <input
                          type="text"
                          value={editingMission.budget || ''}
                          onChange={(e) => setEditingMission({ ...editingMission, budget: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                          }}
                        />
                      </div>
                    </div>
                    <div className="modal-actions">
                      <button
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from('missions')
                              .update({
                                title: editingMission.title,
                                description: editingMission.description,
                                location: editingMission.location,
                                budget: editingMission.budget,
                              })
                              .eq('id', editingMission.id)

                            if (error) throw error

                            setMissions((prev) =>
                              prev.map((m) => (m.id === editingMission.id ? editingMission : m)),
                            )
                            setSelectedMission(editingMission)
                            setEditingMission(null)
                            setViewMode('details')
                            alert('✅ Mission modifiée avec succès!')
                          } catch (err) {
                            console.error('Error updating mission:', err)
                            alert('❌ Erreur lors de la modification')
                          }
                        }}
                        className="btn-confirm"
                      >
                        Sauvegarder
                      </button>
                      <button
                        onClick={() => {
                          setEditingMission(null)
                          setViewMode('details')
                        }}
                        className="btn-cancel"
                      >
                        Annuler
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>Assigner la mission à un collaborateur</h3>
                    <p>Mission: {selectedMission.title}</p>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Collaborateur:
                      </label>
                      <select
                        value={selectedCollaborator}
                        onChange={(e) => setSelectedCollaborator(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '4px',
                          border: '1px solid #ccc',
                          fontSize: '0.95rem',
                        }}
                      >
                        <option value="">-- Sélectionner --</option>
                        {collaborators.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name || c.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="modal-actions">
                      <button
                        onClick={() => handleAssignMission(selectedMission)}
                        className="btn-confirm"
                        disabled={!selectedCollaborator}
                      >
                        Assigner
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCollaborator('')
                          setSelectedMission(null)
                          setViewMode('details')
                        }}
                        className="btn-cancel"
                      >
                        Annuler
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {missionForRecommendations && <PartnerRecommendations
            mission={missionForRecommendations}
            partners={matchingPartners}
            activeUsers={collaborators}
            documents={matchingPartnerDocuments}
            assigningPartnerId={assigningRecommendedPartnerId}
            onAssign={(partner) => void handleAssignRecommendedPartner(partner)}
            onClose={() => setMissionForRecommendations(null)}
          />}
        </section>
      )}

      {activeTab === 'collaborators' && (
        <section className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>Collaborateurs</h2>
            <button
              onClick={() => setShowCollabForm(!showCollabForm)}
              className="btn-edit"
              style={{ padding: '0.6rem 1.2rem', cursor: 'pointer' }}
            >
              {showCollabForm ? '✕ Annuler' : '+ Ajouter collaborateur'}
            </button>
          </div>

          {showCollabForm && (
            <>
              {error && (
                <div style={{
                  backgroundColor: error.includes('Rate limit') ? '#fff3cd' : '#f8d7da',
                  border: error.includes('Rate limit') ? '1px solid #ffc107' : '1px solid #f5c6cb',
                  color: error.includes('Rate limit') ? '#856404' : '#721c24',
                  padding: '1rem',
                  borderRadius: '4px',
                  marginBottom: '1.5rem',
                  fontSize: '0.95rem',
                  fontWeight: '500'
                }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleCreateCollaborator} className="collab-form">
                <div className="form-group">
                  <label>Nom complet *</label>
                  <input
                    type="text"
                    value={collabFormData.full_name}
                    onChange={(e) => setCollabFormData({ ...collabFormData, full_name: e.target.value })}
                    placeholder="Jean Dupont"
                    disabled={isCreatingCollab}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={collabFormData.email}
                    onChange={(e) => setCollabFormData({ ...collabFormData, email: e.target.value })}
                    placeholder="jean@example.com"
                    disabled={isCreatingCollab}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="form-group">
                  <label>Mot de passe *</label>
                  <input
                    type="password"
                    value={collabFormData.password}
                    onChange={(e) => setCollabFormData({ ...collabFormData, password: e.target.value })}
                    placeholder="Minimum 6 caractères"
                    disabled={isCreatingCollab}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label>Entreprise</label>
                  <input
                    type="text"
                    value={collabFormData.company}
                    onChange={(e) => setCollabFormData({ ...collabFormData, company: e.target.value })}
                    placeholder="Mon Entreprise"
                    disabled={isCreatingCollab}
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn-confirm"
                  disabled={isCreatingCollab || !collabFormData.email || !collabFormData.password || !collabFormData.full_name}
                  style={{ 
                    opacity: isCreatingCollab || !collabFormData.email || !collabFormData.password || !collabFormData.full_name ? 0.5 : 1, 
                    cursor: isCreatingCollab ? 'not-allowed' : 'pointer',
                    width: '100%'
                  }}
                >
                  {isCreatingCollab ? '⏳ Création en cours...' : 'Créer collaborateur'}
                </button>
              </form>
            </>
          )}

          <div className="collaborators-grid">
            {collaborators.map((collab) => (
              <article key={collab.id} className="collaborator-card">
                <h4>{collab.full_name}</h4>
                <p className="collab-email">{collab.email}</p>
                {collab.company && <p className="collab-company">{collab.company}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <p className={`collab-status ${collab.is_active ? 'active' : 'inactive'}`}>
                    {collab.is_active ? '✓ Actif' : '✗ Inactif'}
                  </p>
                  <button
                    onClick={() => handleToggleUserActive(collab.id, !collab.is_active)}
                    className="btn-edit"
                    style={{ 
                      padding: '0.3rem 0.6rem', 
                      fontSize: '0.8rem',
                      backgroundColor: collab.is_active ? '#dc3545' : '#28a745'
                    }}
                  >
                    {collab.is_active ? '🔒 Bloquer' : '🔓 Débloquer'}
                  </button>
                </div>
                <p className="collab-date">Créé le {new Date(collab.created_at).toLocaleDateString('fr-FR')}</p>
                
                <div style={{ marginTop: '1rem' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#171819' }}>Missions assignées ({missions.filter((m) => m.assigned_to === collab.id).length}):</strong>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    {missions.filter((m) => m.assigned_to === collab.id).length === 0 ? (
                      <p style={{ color: '#65696a' }}>Aucune mission</p>
                    ) : (
                      missions
                        .filter((m) => m.assigned_to === collab.id)
                        .map((m) => (
                          <div key={m.id} style={{ 
                            padding: '0.3rem 0', 
                            color: '#65696a',
                            borderBottom: '1px solid #eee'
                          }}>
                            • {m.title} <span style={{ color: m.status === 'in_progress' ? '#ae8339' : '#28a745' }}>({missionStatusLabels[m.status]})</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button
                    onClick={() => setSelectedCollabForMission(selectedCollabForMission === collab.id ? null : collab.id)}
                    className="btn-assign"
                    style={{ flex: 1 }}
                  >
                    {selectedCollabForMission === collab.id ? '✕ Fermer' : 'Affecter mission'}
                  </button>
                  <button
                    onClick={() => setEditingUserRole({ userId: collab.id, newRole: collab.role })}
                    className="btn-edit"
                    style={{ flex: 1 }}
                  >
                    ✏️ Rôle
                  </button>
                </div>

                {selectedCollabForMission === collab.id && (
                  <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f3f0e8', borderRadius: '4px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                      Choisir une mission:
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignMissionToCollab(collab.id, e.target.value)
                          e.target.value = ''
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #c9c4b9',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                      }}
                    >
                      <option value="">-- Sélectionner --</option>
                      {missions
                        .filter((m) => !m.assigned_to || m.assigned_to === collab.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title} ({m.status})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'clients' && (
        <section className="admin-section">
          <h2>Gestion des clients</h2>
          <div className="users-list">
            {clients.length === 0 ? (
              <p>Aucun client</p>
            ) : (
              clients.map((client) => (
                <article key={client.id} className={`user-card ${!client.is_active ? 'inactive' : ''}`}>
                  <div className="user-header">
                    <h4>{client.full_name || client.email}</h4>
                    <span className={`user-status-badge ${client.is_active ? 'active' : 'inactive'}`}>
                      {client.is_active ? '✓ Actif' : '✗ Inactif'}
                    </span>
                  </div>
                  <p className="user-email">
                    <strong>Email:</strong> {client.email}
                  </p>
                  {client.company && (
                    <p className="user-company">
                      <strong>Entreprise:</strong> {client.company}
                    </p>
                  )}
                  <p className="user-role">
                    <strong>Rôle:</strong> {client.role}
                  </p>
                  <p className="user-date">
                    <strong>Créé le:</strong> {new Date(client.created_at).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="user-actions">
                    <button
                      onClick={() => handleToggleUserActive(client.id, !client.is_active)}
                      className="btn-edit"
                    >
                      {client.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      onClick={() => {
                        const newRole = prompt(
                          `Nouveau rôle pour ${client.email} (admin, moderator, client, collaborator):`,
                          client.role
                        )
                        if (newRole && ['admin', 'moderator', 'client', 'collaborator'].includes(newRole)) {
                          handleUpdateUserRole(client.id, newRole as UserRole)
                        }
                      }}
                      className="btn-edit"
                    >
                      Changer le rôle
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === 'users' && (
        <section className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>Gestion des utilisateurs</h2>
            <button
              onClick={() => setShowCollabForm(!showCollabForm)}
              className="btn-edit"
              style={{ padding: '0.6rem 1.2rem', cursor: 'pointer' }}
            >
              {showCollabForm ? '✕ Annuler' : '+ Créer utilisateur'}
            </button>
          </div>

          {showCollabForm && (
            <>
              {error && (
                <div style={{
                  backgroundColor: error.includes('Rate limit') ? '#fff3cd' : '#f8d7da',
                  border: error.includes('Rate limit') ? '1px solid #ffc107' : '1px solid #f5c6cb',
                  color: error.includes('Rate limit') ? '#856404' : '#721c24',
                  padding: '1rem',
                  borderRadius: '4px',
                  marginBottom: '1.5rem',
                  fontSize: '0.95rem',
                  fontWeight: '500'
                }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleCreateCollaborator} className="collab-form">
                <div className="form-group">
                  <label>Nom complet *</label>
                  <input
                    type="text"
                    value={collabFormData.full_name}
                    onChange={(e) => setCollabFormData({ ...collabFormData, full_name: e.target.value })}
                    placeholder="Jean Dupont"
                    disabled={isCreatingCollab}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={collabFormData.email}
                    onChange={(e) => setCollabFormData({ ...collabFormData, email: e.target.value })}
                    placeholder="jean@example.com"
                    disabled={isCreatingCollab}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="form-group">
                  <label>Mot de passe *</label>
                  <input
                    type="password"
                    value={collabFormData.password}
                    onChange={(e) => setCollabFormData({ ...collabFormData, password: e.target.value })}
                    placeholder="Minimum 6 caractères"
                    disabled={isCreatingCollab}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label>Rôle *</label>
                  <select
                    value={collabFormData.role || 'collaborator'}
                    onChange={(e) => setCollabFormData({ ...collabFormData, role: e.target.value as any })}
                    disabled={isCreatingCollab}
                    required
                  >
                    <option value="collaborator">Collaborateur</option>
                    <option value="client">Client</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Entreprise</label>
                  <input
                    type="text"
                    value={collabFormData.company}
                    onChange={(e) => setCollabFormData({ ...collabFormData, company: e.target.value })}
                    placeholder="Mon Entreprise"
                    disabled={isCreatingCollab}
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn-confirm"
                  disabled={isCreatingCollab || !collabFormData.email || !collabFormData.password || !collabFormData.full_name}
                  style={{ 
                    opacity: isCreatingCollab || !collabFormData.email || !collabFormData.password || !collabFormData.full_name ? 0.5 : 1, 
                    cursor: isCreatingCollab ? 'not-allowed' : 'pointer',
                    width: '100%'
                  }}
                >
                  {isCreatingCollab ? '⏳ Création en cours...' : 'Créer utilisateur'}
                </button>
              </form>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
            {allUsers.map((user) => (
              <article key={user.id} className={`user-card ${!user.is_active ? 'inactive' : ''}`} style={{ border: '1px solid #c9c4b9', borderRadius: '8px', padding: '1.5rem', backgroundColor: 'white', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{user.full_name || user.email}</h4>
                    <p style={{ fontSize: '0.85rem', color: '#65696a', margin: '0.3rem 0 0 0' }}>{user.email}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`user-status-badge ${user.is_active ? 'active' : 'inactive'}`} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                      {user.is_active ? '✓ Actif' : '✗ Inactif'}
                    </span>
                    <button
                      onClick={() => handleToggleUserActive(user.id, !user.is_active)}
                      className="btn-edit"
                      style={{ 
                        padding: '0.3rem 0.6rem', 
                        fontSize: '0.8rem',
                        backgroundColor: user.is_active ? '#dc3545' : '#28a745'
                      }}
                    >
                      {user.is_active ? '🔒' : '🔓'}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Rôle:</strong> <span style={{ 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px', 
                    backgroundColor: user.role === 'admin' ? '#ae8339' : user.role === 'collaborator' ? '#28a745' : '#17a2b8',
                    color: 'white',
                    fontSize: '0.8rem'
                  }}>{user.role}</span>
                </div>

                {user.company && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Entreprise:</strong> {user.company}
                  </div>
                )}

                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Créé le:</strong> {new Date(user.created_at).toLocaleDateString('fr-FR')}
                </div>

                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#171819' }}>Missions assignées ({missions.filter((m) => m.assigned_to === user.id).length}):</strong>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    {missions.filter((m) => m.assigned_to === user.id).length === 0 ? (
                      <p style={{ color: '#65696a' }}>Aucune mission</p>
                    ) : (
                      missions
                        .filter((m) => m.assigned_to === user.id)
                        .map((m) => (
                          <div key={m.id} style={{ 
                            padding: '0.3rem 0', 
                            color: '#65696a',
                            borderBottom: '1px solid #eee'
                          }}>
                            • {m.title} <span style={{ color: m.status === 'in_progress' ? '#ae8339' : m.status === 'completed' ? '#28a745' : '#65696a' }}>({missionStatusLabels[m.status]})</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      const newRole = prompt(
                        `Nouveau rôle pour ${user.email} (admin, moderator, client, collaborator):`,
                        user.role
                      )
                      if (newRole && ['admin', 'moderator', 'client', 'collaborator'].includes(newRole)) {
                        handleUpdateUserRole(user.id, newRole as UserRole)
                      }
                    }}
                    className="btn-edit"
                    style={{ flex: 1 }}
                  >
                    ✏️ Rôle
                  </button>
                  <button
                    onClick={() => setSelectedCollabForMission(selectedCollabForMission === user.id ? null : user.id)}
                    className="btn-assign"
                    style={{ flex: 1 }}
                  >
                    {selectedCollabForMission === user.id ? '✕' : '📋 Mission'}
                  </button>
                </div>

                {selectedCollabForMission === user.id && (
                  <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f3f0e8', borderRadius: '4px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                      Assigner une mission:
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignMissionToCollab(user.id, e.target.value)
                          e.target.value = ''
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #c9c4b9',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                      }}
                    >
                      <option value="">-- Sélectionner --</option>
                      {missions
                        .filter((m) => !m.assigned_to || m.assigned_to === user.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title} ({m.status})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'support' && (
        <section className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Tickets de support</h2>
            <button onClick={() => setShowTicketForm(!showTicketForm)} className="btn-edit">
              {showTicketForm ? 'Annuler' : '+ Nouveau ticket'}
            </button>
          </div>

          {showTicketForm && (
            <form onSubmit={handleCreateTicket} className="ticket-form" style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div className="form-group">
                <label>Sujet *</label>
                <input
                  type="text"
                  value={ticketFormData.subject}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, subject: e.target.value })}
                  placeholder="Sujet du ticket"
                  required
                />
              </div>
              <div className="form-group">
                <label>Priorité</label>
                <select
                  value={ticketFormData.priority}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, priority: e.target.value as any })}
                >
                  <option value="low">Faible</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={ticketFormData.description}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, description: e.target.value })}
                  placeholder="Décrivez le problème..."
                  rows={4}
                  required
                />
              </div>
              <button type="submit" className="btn-confirm">
                Créer le ticket
              </button>
            </form>
          )}

          <div className="tickets-list">
            {supportTickets.length === 0 ? (
              <p>Aucun ticket</p>
            ) : (
              supportTickets.map((ticket) => (
                <article key={ticket.id} className={`ticket-card priority-${ticket.priority}`}>
                  <div className="ticket-header">
                    <h4>{ticket.subject}</h4>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className={`ticket-priority-badge priority-${ticket.priority}`}>
                        {ticket.priority === 'urgent' && '🔴 Urgent'}
                        {ticket.priority === 'high' && '🟠 Haute'}
                        {ticket.priority === 'medium' && '🟡 Moyenne'}
                        {ticket.priority === 'low' && '🟢 Faible'}
                      </span>
                      <span className={`ticket-status-badge status-${ticket.status}`}>
                        {ticket.status === 'open' && '🆕 Ouvert'}
                        {ticket.status === 'in_progress' && '🔄 En cours'}
                        {ticket.status === 'resolved' && '✓ Résolu'}
                        {ticket.status === 'closed' && '📦 Fermé'}
                      </span>
                    </div>
                  </div>
                  <p className="ticket-description">{ticket.description}</p>
                  <div className="ticket-meta">
                    <span>Créé le: {new Date(ticket.created_at).toLocaleDateString('fr-FR')}</span>
                    {ticket.assigned_to && <span>Assigné à: {ticket.assigned_to}</span>}
                  </div>
                  <div className="ticket-actions">
                    {ticket.status === 'open' && (
                      <button onClick={() => handleUpdateTicketStatus(ticket.id, 'in_progress')} className="btn-edit">
                        Démarrer
                      </button>
                    )}
                    {ticket.status === 'in_progress' && (
                      <button onClick={() => handleResolveTicket(ticket.id)} className="btn-confirm">
                        Résoudre
                      </button>
                    )}
                    {ticket.status === 'resolved' && (
                      <button onClick={() => handleUpdateTicketStatus(ticket.id, 'closed')} className="btn-edit">
                        Fermer
                      </button>
                    )}
                    <button onClick={() => handleDeleteTicket(ticket.id)} className="btn-delete">
                      Supprimer
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === 'messages' && (
        <section className="admin-section">
          <h2>Messages de contact</h2>
          <div className="messages-list">
            {contactRequests.length === 0 ? (
              <p>Aucun message</p>
            ) : (
              contactRequests.map((contact) => (
                <article key={contact.id} className={`message-card status-${contact.status || 'new'}`}>
                  <div className="message-header">
                    <h4>{contact.name}</h4>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className={`message-status-badge status-${contact.status || 'new'}`}>
                        {contact.status === 'read' && '👁️ Lu'}
                        {contact.status === 'replied' && '✓ Répondu'}
                        {contact.status === 'archived' && '📦 Archivé'}
                        {(!contact.status || contact.status === 'new') && '🆕 Nouveau'}
                      </span>
                      <span className="message-date">
                        {new Date(contact.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                  <p className="message-company">
                    <strong>Entreprise:</strong> {contact.company || 'N/A'}
                  </p>
                  <p className="message-contact">
                    <strong>Email:</strong> <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </p>
                  <p className="message-contact">
                    <strong>Téléphone:</strong> {contact.phone || 'N/A'}
                  </p>
                  <p className="message-mission">
                    <strong>Mission:</strong> {contact.mission}
                  </p>
                  <div className="message-actions">
                    <a
                      href={`mailto:${contact.email}?subject=${encodeURIComponent('Re: votre demande SCOPE-VERIFY')}`}
                      className="btn-reply"
                      onClick={() => handleUpdateContactStatus(contact.id, 'replied')}
                    >
                      ✉️ Répondre
                    </a>
                    {(!contact.status || contact.status === 'new') && (
                      <button onClick={() => handleUpdateContactStatus(contact.id, 'read')} className="btn-edit">
                        👁️ Marquer comme lu
                      </button>
                    )}
                    {contact.status !== 'archived' && (
                      <button
                        onClick={() => handleUpdateContactStatus(contact.id, 'archived')}
                        className="btn-edit"
                      >
                        📦 Archiver
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteContact(contact.id)}
                      className="btn-delete"
                    >
                      Supprimer
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === 'tarifs' && (
        <section className="admin-section">
          <h2>Gestion des tarifs</h2>
          <div className="prices-list">
            {prices.map((price) => (
              <article key={price.id} className="price-card">
                <div className="price-info">
                  <h4>{price.title_fr}</h4>
                  <p className="price-description">{price.description_fr}</p>
                  <p className="price-amount">
                    <strong>Montant:</strong> {price.amount} €
                  </p>
                  <p>{price.is_visible === false ? 'Masqué sur le site public' : 'Visible sur le site public'}</p>
                </div>
                <button
                  onClick={() => handleTogglePriceVisibility(price)}
                  className="btn-edit"
                  disabled={updatingPriceId === price.id}
                >
                  {updatingPriceId === price.id ? 'Enregistrement…' : price.is_visible === false ? 'Afficher' : 'Masquer'}
                </button>
                <button
                  onClick={() => {
                    setEditingPrice(price)
                    setPriceFormData({
                      title_fr: price.title_fr,
                      title_en: price.title_en,
                      description_fr: price.description_fr,
                      description_en: price.description_en,
                      amount: price.amount,
                    })
                  }}
                  className="btn-edit"
                >
                  Modifier
                </button>
                {editingPrice?.id === price.id && (
                  <div className="price-edit-form">
                    <label>Titre (français)<input required value={priceFormData.title_fr} onChange={(e) => setPriceFormData({ ...priceFormData, title_fr: e.target.value })} /></label>
                    <label>Title (English)<input required value={priceFormData.title_en} onChange={(e) => setPriceFormData({ ...priceFormData, title_en: e.target.value })} /></label>
                    <label>Description (français)<textarea required rows={3} value={priceFormData.description_fr} onChange={(e) => setPriceFormData({ ...priceFormData, description_fr: e.target.value })} /></label>
                    <label>Description (English)<textarea required rows={3} value={priceFormData.description_en} onChange={(e) => setPriceFormData({ ...priceFormData, description_en: e.target.value })} /></label>
                    <label>Tarif<input required value={priceFormData.amount} onChange={(e) => setPriceFormData({ ...priceFormData, amount: e.target.value })} placeholder="350 EUR" /></label>
                    <button onClick={handleUpdatePrice} className="btn-confirm">
                      Valider
                    </button>
                    <button
                      onClick={() => {
                        setEditingPrice(null)
                        setPriceFormData({ title_fr: '', title_en: '', description_fr: '', description_en: '', amount: '' })
                      }}
                      className="btn-cancel"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="admin-section">
          <h2>Paramètres du site</h2>
          <AdminMfaSettings />
          <div style={{ 
            backgroundColor: 'white', 
            border: '1px solid #c9c4b9', 
            borderRadius: '8px', 
            padding: '2rem',
            maxWidth: '800px'
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#171819' }}>Coordonnées publiques</h3>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
              <label>
                Téléphone public
                <input type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.65rem' }} />
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={phoneDisplayEnabled} onChange={(event) => setPhoneDisplayEnabled(event.target.checked)} />
                Afficher le téléphone sur le site
              </label>
              <label>
                Numéro WhatsApp (indicatif pays inclus)
                <input type="tel" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.65rem' }} />
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={whatsappDisplayEnabled} onChange={(event) => setWhatsappDisplayEnabled(event.target.checked)} />
                Afficher le lien WhatsApp sur le site
              </label>
              <button onClick={handleSavePublicContact} className="btn-confirm" disabled={isUpdatingSettings}>
                {isUpdatingSettings ? 'Enregistrement…' : 'Enregistrer les coordonnées'}
              </button>
            </div>

            <h3 style={{ marginBottom: '1.5rem', color: '#171819' }}>Fonctionnalités principales</h3>
            
            {/* Inscription publique */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Inscription publique</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Permettre aux nouveaux utilisateurs de créer un compte
                </p>
              </div>
              <button
                onClick={handleTogglePublicRegistration}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: publicRegistrationEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : publicRegistrationEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            {/* Formulaire de mission */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Formulaire de mission</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Permettre aux visiteurs de remplir le formulaire de mission
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('mission_form_enabled', missionFormEnabled, setMissionFormEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: missionFormEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : missionFormEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem', color: '#171819' }}>Fonctionnalités CRM</h3>
            
            {/* CRM */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>CRM - Gestion des contacts</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Historique complet des interactions, notes, suivi des prospects
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('crm_enabled', crmEnabled, setCrmEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: crmEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : crmEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            {/* Pipeline de ventes */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Pipeline de ventes</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Suivi des étapes de conversion (prospect → client → récurrent)
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('sales_pipeline_enabled', salesPipelineEnabled, setSalesPipelineEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: salesPipelineEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : salesPipelineEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            {/* Devis et factures */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Devis et factures</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Gestion des devis, facturation, suivi des paiements
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('invoices_enabled', invoicesEnabled, setInvoicesEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: invoicesEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : invoicesEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            {/* Segmentation */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Segmentation des clients</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Catégorisation des clients par secteur, taille, besoin
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('segmentation_enabled', segmentationEnabled, setSegmentationEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: segmentationEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : segmentationEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            {/* Automatisation marketing */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Automatisation marketing</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Emails automatiques, rappels, campagnes
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('marketing_automation_enabled', marketingAutomationEnabled, setMarketingAutomationEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: marketingAutomationEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : marketingAutomationEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem', color: '#171819' }}>Fonctionnalités de gestion</h3>
            
            {/* Calendrier */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Calendrier partagé</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Planification des missions, disponibilitédes collaborateurs
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('calendar_enabled', calendarEnabled, setCalendarEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: calendarEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : calendarEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            {/* Gestion documentaire */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Gestion documentaire</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Stockage et partage de documents, contrats, rapports
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('document_management_enabled', documentManagementEnabled, setDocumentManagementEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: documentManagementEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : documentManagementEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            {/* Notifications avancées */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Notifications avancées</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  SMS, push notifications, règles personnalisées
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('advanced_notifications_enabled', advancedNotificationsEnabled, setAdvancedNotificationsEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: advancedNotificationsEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : advancedNotificationsEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            {/* Reporting avancé */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Reporting avancé</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Tableaux de bord, KPIs, export de données
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('reporting_enabled', reportingEnabled, setReportingEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: reportingEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : reportingEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            {/* Audit logs */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Audit logs</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Traçabilité des actions administrateur
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('audit_logs_enabled', auditLogsEnabled, setAuditLogsEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: auditLogsEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : auditLogsEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem', color: '#171819' }}>Fonctionnalités collaborateurs</h3>
            
            {/* Compétences */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Gestion des compétences</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Profil détaillé, certifications, spécialisations
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('skills_management_enabled', skillsManagementEnabled, setSkillsManagementEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: skillsManagementEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : skillsManagementEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            {/* Disponibilité */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Planning et disponibilité</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Calendrier, congés, préférences
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('availability_enabled', availabilityEnabled, setAvailabilityEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: availabilityEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : availabilityEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>

            {/* Feedback */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0' }}>Système de feedback</h4>
                <p style={{ margin: 0, color: '#65696a', fontSize: '0.85rem' }}>
                  Évaluations, notes clients, performance
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('feedback_enabled', feedbackEnabled, setFeedbackEnabled)}
                disabled={isUpdatingSettings}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: isUpdatingSettings ? 'not-allowed' : 'pointer',
                  backgroundColor: feedbackEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  opacity: isUpdatingSettings ? 0.5 : 1
                }}
              >
                {isUpdatingSettings ? '⏳' : feedbackEnabled ? '✓ Activé' : '✗ Désactivé'}
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'crm' && (
        <section className="admin-section">
          <h2>CRM - Gestion des contacts</h2>
          
          {!selectedContactId ? (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <button
                  onClick={() => {
                    setEditingContact(null)
                    setContactFormData({
                      first_name: '',
                      last_name: '',
                      email: '',
                      phone: '',
                      company: '',
                      position: '',
                      status: 'prospect',
                      source: '',
                      notes: ''
                    })
                    setShowContactForm(true)
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  + Nouveau contact
                </button>
              </div>

              {showContactForm && (
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #c9c4b9',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  <h3 style={{ marginTop: 0 }}>{editingContact ? 'Modifier le contact' : 'Nouveau contact'}</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault()
                    if (!supabase) return

                    try {
                      if (editingContact) {
                        const { error } = await supabase
                          .from('crm_contacts')
                          .update({
                            ...contactFormData,
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', editingContact.id)
                        if (error) throw error
                      } else {
                        const { error } = await supabase
                          .from('crm_contacts')
                          .insert({
                            ...contactFormData,
                            created_by: adminId
                          })
                        if (error) throw error
                      }
                      setShowContactForm(false)
                      setEditingContact(null)
                      loadData()
                    } catch (err) {
                      setError(getErrorMessage(err) || 'Erreur lors de la sauvegarde')
                    }
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Prénom *</label>
                        <input
                          type="text"
                          value={contactFormData.first_name}
                          onChange={(e) => setContactFormData({ ...contactFormData, first_name: e.target.value })}
                          required
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Nom *</label>
                        <input
                          type="text"
                          value={contactFormData.last_name}
                          onChange={(e) => setContactFormData({ ...contactFormData, last_name: e.target.value })}
                          required
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Email</label>
                        <input
                          type="email"
                          value={contactFormData.email}
                          onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Téléphone</label>
                        <input
                          type="tel"
                          value={contactFormData.phone}
                          onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Entreprise</label>
                        <input
                          type="text"
                          value={contactFormData.company}
                          onChange={(e) => setContactFormData({ ...contactFormData, company: e.target.value })}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Poste</label>
                        <input
                          type="text"
                          value={contactFormData.position}
                          onChange={(e) => setContactFormData({ ...contactFormData, position: e.target.value })}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Statut</label>
                        <select
                          value={contactFormData.status}
                          onChange={(e) => setContactFormData({ ...contactFormData, status: e.target.value as ContactStatus })}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        >
                          {Object.entries(contactStatusLabels).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Source</label>
                        <input
                          type="text"
                          value={contactFormData.source}
                          onChange={(e) => setContactFormData({ ...contactFormData, source: e.target.value })}
                          placeholder="Ex: Référence, Site web, etc."
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.3rem' }}>Notes</label>
                      <textarea
                        value={contactFormData.notes}
                        onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                        rows={3}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                      />
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="submit"
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {editingContact ? 'Mettre à jour' : 'Créer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowContactForm(false)
                          setEditingContact(null)
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ display: 'grid', gap: '1rem' }}>
                {crmContacts.length === 0 ? (
                  <p style={{ color: '#65696a', textAlign: 'center', padding: '2rem' }}>
                    Aucun contact CRM. Créez votre premier contact pour commencer.
                  </p>
                ) : (
                  crmContacts.map((contact) => (
                    <div
                      key={contact.id}
                      style={{
                        backgroundColor: 'white',
                        border: '1px solid #c9c4b9',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s'
                      }}
                      onClick={() => setSelectedContactId(contact.id)}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ margin: '0 0 0.5rem 0' }}>
                            {contact.first_name} {contact.last_name}
                          </h3>
                          {contact.company && (
                            <p style={{ margin: '0 0 0.3rem 0', color: '#65696a' }}>
                              🏢 {contact.company}
                            </p>
                          )}
                          {contact.email && (
                            <p style={{ margin: '0 0 0.3rem 0', color: '#65696a', fontSize: '0.9rem' }}>
                              📧 {contact.email}
                            </p>
                          )}
                          {contact.phone && (
                            <p style={{ margin: '0 0 0.3rem 0', color: '#65696a', fontSize: '0.9rem' }}>
                              📞 {contact.phone}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            backgroundColor: contact.status === 'client' ? '#d4edda' : contact.status === 'prospect' ? '#fff3cd' : contact.status === 'inactive' ? '#e2e3e5' : '#f8d7da',
                            color: contact.status === 'client' ? '#155724' : contact.status === 'prospect' ? '#856404' : contact.status === 'inactive' ? '#383d41' : '#721c24'
                          }}>
                            {contactStatusLabels[contact.status]}
                          </span>
                          <p style={{ margin: '0.5rem 0 0 0', color: '#65696a', fontSize: '0.8rem' }}>
                            {new Date(contact.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div>
              <button
                onClick={() => setSelectedContactId(null)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginBottom: '1rem'
                }}
              >
                ← Retour à la liste
              </button>
              
              {(() => {
                const contact = crmContacts.find(c => c.id === selectedContactId)
                if (!contact) return null
                
                const contactInteractions = crmInteractions.filter(i => i.contact_id === selectedContactId)
                const contactTasks = crmTasks.filter(t => t.contact_id === selectedContactId)
                
                return (
                  <div>
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #c9c4b9',
                      borderRadius: '8px',
                      padding: '1.5rem',
                      marginBottom: '1.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h2 style={{ margin: '0 0 0.5rem 0' }}>
                            {contact.first_name} {contact.last_name}
                          </h2>
                          {contact.position && <p style={{ margin: '0 0 0.5rem 0', color: '#65696a' }}>{contact.position}</p>}
                          {contact.company && <p style={{ margin: '0 0 0.5rem 0', color: '#65696a' }}>🏢 {contact.company}</p>}
                          {contact.email && <p style={{ margin: '0 0 0.3rem 0', color: '#65696a' }}>📧 {contact.email}</p>}
                          {contact.phone && <p style={{ margin: '0 0 0.3rem 0', color: '#65696a' }}>📞 {contact.phone}</p>}
                          {contact.source && <p style={{ margin: '0 0 0.3rem 0', color: '#65696a' }}>📍 Source: {contact.source}</p>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            fontSize: '1rem',
                            backgroundColor: contact.status === 'client' ? '#d4edda' : contact.status === 'prospect' ? '#fff3cd' : contact.status === 'inactive' ? '#e2e3e5' : '#f8d7da',
                            color: contact.status === 'client' ? '#155724' : contact.status === 'prospect' ? '#856404' : contact.status === 'inactive' ? '#383d41' : '#721c24'
                          }}>
                            {contactStatusLabels[contact.status]}
                          </span>
                          <div style={{ marginTop: '1rem' }}>
                            <button
                              onClick={() => {
                                setEditingContact(contact)
                                setContactFormData({
                                  first_name: contact.first_name,
                                  last_name: contact.last_name,
                                  email: contact.email || '',
                                  phone: contact.phone || '',
                                  company: contact.company || '',
                                  position: contact.position || '',
                                  status: contact.status,
                                  source: contact.source || '',
                                  notes: contact.notes || ''
                                })
                                setShowContactForm(true)
                              }}
                              style={{
                                padding: '0.4rem 0.8rem',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                marginRight: '0.5rem'
                              }}
                            >
                              Modifier
                            </button>
                          </div>
                        </div>
                      </div>
                      {contact.notes && (
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                          <strong>Notes:</strong>
                          <p style={{ margin: '0.5rem 0 0 0', color: '#65696a' }}>{contact.notes}</p>
                        </div>
                      )}
                    </div>

                    <h3 style={{ marginBottom: '1rem' }}>Interactions ({contactInteractions.length})</h3>
                    <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                      {contactInteractions.length === 0 ? (
                        <p style={{ color: '#65696a' }}>Aucune interaction enregistrée</p>
                      ) : (
                        contactInteractions.map((interaction) => (
                          <div
                            key={interaction.id}
                            style={{
                              backgroundColor: 'white',
                              border: '1px solid #c9c4b9',
                              borderRadius: '8px',
                              padding: '1rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <span style={{
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  backgroundColor: '#e9ecef',
                                  marginRight: '0.5rem'
                                }}>
                                  {interactionTypeLabels[interaction.type]}
                                </span>
                                {interaction.subject && <strong>{interaction.subject}</strong>}
                              </div>
                              <span style={{ fontSize: '0.85rem', color: '#65696a' }}>
                                {new Date(interaction.created_at).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            {interaction.description && (
                              <p style={{ margin: '0.5rem 0 0 0', color: '#65696a' }}>{interaction.description}</p>
                            )}
                            {interaction.outcome && (
                              <p style={{ margin: '0.5rem 0 0 0', color: '#28a745' }}>
                                <strong>Résultat:</strong> {interaction.outcome}
                              </p>
                            )}
                            {interaction.next_action && (
                              <p style={{ margin: '0.5rem 0 0 0', color: '#007bff' }}>
                                <strong>Action à suivre:</strong> {interaction.next_action}
                                {interaction.next_action_date && ` (${new Date(interaction.next_action_date).toLocaleDateString('fr-FR')})`}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <h3 style={{ marginBottom: '1rem' }}>Tâches ({contactTasks.length})</h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {contactTasks.length === 0 ? (
                        <p style={{ color: '#65696a' }}>Aucune tâche assignée</p>
                      ) : (
                        contactTasks.map((task) => (
                          <div
                            key={task.id}
                            style={{
                              backgroundColor: 'white',
                              border: '1px solid #c9c4b9',
                              borderRadius: '8px',
                              padding: '1rem',
                              borderLeft: `4px solid ${task.priority === 'urgent' ? '#dc3545' : task.priority === 'high' ? '#fd7e14' : task.priority === 'medium' ? '#ffc107' : '#28a745'}`
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <strong>{task.title}</strong>
                                {task.description && <p style={{ margin: '0.3rem 0 0 0', color: '#65696a' }}>{task.description}</p>}
                              </div>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                backgroundColor: task.status === 'completed' ? '#d4edda' : task.status === 'in_progress' ? '#fff3cd' : '#e9ecef',
                                color: task.status === 'completed' ? '#155724' : task.status === 'in_progress' ? '#856404' : '#383d41'
                              }}>
                                {taskStatusLabels[task.status]}
                              </span>
                            </div>
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#65696a' }}>
                              <span>Priorité: {taskPriorityLabels[task.priority]}</span>
                              {task.due_date && <span>Échéance: {new Date(task.due_date).toLocaleDateString('fr-FR')}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </section>
      )}

      {activeTab === 'pipeline' && (
        <section className="admin-section">
          <h2>Pipeline de ventes</h2>
          
          {!selectedOpportunityId ? (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <button
                  onClick={() => {
                    setEditingOpportunity(null)
                    setOpportunityFormData({
                      contact_id: '',
                      stage_id: pipelineStages.length > 0 ? pipelineStages[0].id : '',
                      title: '',
                      description: '',
                      value: '',
                      currency: 'EUR',
                      expected_close_date: '',
                      status: 'active',
                      lost_reason: ''
                    })
                    setShowOpportunityForm(true)
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  + Nouvelle opportunité
                </button>
              </div>

              {showOpportunityForm && (
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #c9c4b9',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  <h3 style={{ marginTop: 0 }}>{editingOpportunity ? 'Modifier l\'opportunité' : 'Nouvelle opportunité'}</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault()
                    if (!supabase) return

                    try {
                      const opportunityData = {
                        ...opportunityFormData,
                        value: opportunityFormData.value ? parseFloat(opportunityFormData.value) : null,
                        expected_close_date: opportunityFormData.expected_close_date || null
                      }

                      if (editingOpportunity) {
                        const { error } = await supabase
                          .from('sales_opportunities')
                          .update({
                            ...opportunityData,
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', editingOpportunity.id)
                        if (error) throw error
                      } else {
                        const { error } = await supabase
                          .from('sales_opportunities')
                          .insert({
                            ...opportunityData,
                            created_by: adminId
                          })
                        if (error) throw error
                      }
                      setShowOpportunityForm(false)
                      setEditingOpportunity(null)
                      loadData()
                    } catch (err) {
                      setError(getErrorMessage(err) || 'Erreur lors de la sauvegarde')
                    }
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Titre *</label>
                        <input
                          type="text"
                          value={opportunityFormData.title}
                          onChange={(e) => setOpportunityFormData({ ...opportunityFormData, title: e.target.value })}
                          required
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Contact</label>
                        <select
                          value={opportunityFormData.contact_id}
                          onChange={(e) => setOpportunityFormData({ ...opportunityFormData, contact_id: e.target.value })}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        >
                          <option value="">Sélectionner un contact</option>
                          {crmContacts.map((contact) => (
                            <option key={contact.id} value={contact.id}>
                              {contact.first_name} {contact.last_name} {contact.company && `(${contact.company})`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Étape</label>
                        <select
                          value={opportunityFormData.stage_id}
                          onChange={(e) => setOpportunityFormData({ ...opportunityFormData, stage_id: e.target.value })}
                          required
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        >
                          {pipelineStages.map((stage) => (
                            <option key={stage.id} value={stage.id}>{stage.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Valeur (€)</label>
                        <input
                          type="number"
                          value={opportunityFormData.value}
                          onChange={(e) => setOpportunityFormData({ ...opportunityFormData, value: e.target.value })}
                          step="0.01"
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Date de clôture prévue</label>
                        <input
                          type="date"
                          value={opportunityFormData.expected_close_date}
                          onChange={(e) => setOpportunityFormData({ ...opportunityFormData, expected_close_date: e.target.value })}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        />
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Statut</label>
                        <select
                          value={opportunityFormData.status}
                          onChange={(e) => setOpportunityFormData({ ...opportunityFormData, status: e.target.value as OpportunityStatus })}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        >
                          {Object.entries(opportunityStatusLabels).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                      {opportunityFormData.status === 'lost' && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ display: 'block', marginBottom: '0.3rem' }}>Raison de la perte</label>
                          <input
                            type="text"
                            value={opportunityFormData.lost_reason}
                            onChange={(e) => setOpportunityFormData({ ...opportunityFormData, lost_reason: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                          />
                        </div>
                      )}
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', marginBottom: '0.3rem' }}>Description</label>
                        <textarea
                          value={opportunityFormData.description}
                          onChange={(e) => setOpportunityFormData({ ...opportunityFormData, description: e.target.value })}
                          rows={3}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="submit"
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {editingOpportunity ? 'Mettre à jour' : 'Créer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOpportunityForm(false)
                          setEditingOpportunity(null)
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {pipelineStages.map((stage) => {
                  const stageOpportunities = salesOpportunities.filter(o => o.stage_id === stage.id)
                  const stageValue = stageOpportunities.reduce((sum, o) => sum + (o.value || 0), 0)
                  
                  return (
                    <div
                      key={stage.id}
                      style={{
                        backgroundColor: 'white',
                        border: '1px solid #c9c4b9',
                        borderRadius: '8px',
                        padding: '1rem',
                        borderTop: `4px solid ${stage.color}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>{stage.name}</h3>
                        <span style={{ fontSize: '0.85rem', color: '#65696a' }}>
                          {stage.probability}% prob.
                        </span>
                      </div>
                      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#65696a' }}>
                        {stageOpportunities.length} opportunité(s) • {stageValue.toLocaleString('fr-FR')} €
                      </p>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {stageOpportunities.length === 0 ? (
                          <p style={{ color: '#65696a', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                            Aucune opportunité
                          </p>
                        ) : (
                          stageOpportunities.map((opportunity) => {
                            const contact = crmContacts.find(c => c.id === opportunity.contact_id)
                            return (
                              <div
                                key={opportunity.id}
                                style={{
                                  backgroundColor: '#f8f9fa',
                                  border: '1px solid #e9ecef',
                                  borderRadius: '4px',
                                  padding: '0.75rem',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setSelectedOpportunityId(opportunity.id)}
                              >
                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{opportunity.title}</div>
                                {contact && (
                                  <div style={{ fontSize: '0.85rem', color: '#65696a' }}>
                                    {contact.first_name} {contact.last_name}
                                  </div>
                                )}
                                {opportunity.value && (
                                  <div style={{ fontSize: '0.85rem', color: '#28a745' }}>
                                    {opportunity.value.toLocaleString('fr-FR')} €
                                  </div>
                                )}
                                <span style={{
                                  display: 'inline-block',
                                  marginTop: '0.25rem',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '3px',
                                  fontSize: '0.75rem',
                                  backgroundColor: opportunity.status === 'won' ? '#d4edda' : opportunity.status === 'lost' ? '#f8d7da' : '#e9ecef',
                                  color: opportunity.status === 'won' ? '#155724' : opportunity.status === 'lost' ? '#721c24' : '#383d41'
                                }}>
                                  {opportunityStatusLabels[opportunity.status]}
                                </span>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div>
              <button
                onClick={() => setSelectedOpportunityId(null)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginBottom: '1rem'
                }}
              >
                ← Retour au pipeline
              </button>
              
              {(() => {
                const opportunity = salesOpportunities.find(o => o.id === selectedOpportunityId)
                if (!opportunity) return null
                
                const contact = crmContacts.find(c => c.id === opportunity.contact_id)
                const stage = pipelineStages.find(s => s.id === opportunity.stage_id)
                
                return (
                  <div>
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #c9c4b9',
                      borderRadius: '8px',
                      padding: '1.5rem',
                      marginBottom: '1.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h2 style={{ margin: '0 0 0.5rem 0' }}>{opportunity.title}</h2>
                          {contact && (
                            <p style={{ margin: '0 0 0.5rem 0', color: '#65696a' }}>
                              Contact: {contact.first_name} {contact.last_name}
                              {contact.company && ` (${contact.company})`}
                            </p>
                          )}
                          {stage && (
                            <p style={{ margin: '0 0 0.5rem 0', color: '#65696a' }}>
                              Étape: {stage.name} ({stage.probability}% probabilité)
                            </p>
                          )}
                          {opportunity.value && (
                            <p style={{ margin: '0 0 0.5rem 0', color: '#28a745', fontSize: '1.1rem', fontWeight: 'bold' }}>
                              Valeur: {opportunity.value.toLocaleString('fr-FR')} {opportunity.currency}
                            </p>
                          )}
                          {opportunity.expected_close_date && (
                            <p style={{ margin: '0 0 0.5rem 0', color: '#65696a' }}>
                              Clôture prévue: {new Date(opportunity.expected_close_date).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            fontSize: '1rem',
                            backgroundColor: opportunity.status === 'won' ? '#d4edda' : opportunity.status === 'lost' ? '#f8d7da' : '#e9ecef',
                            color: opportunity.status === 'won' ? '#155724' : opportunity.status === 'lost' ? '#721c24' : '#383d41'
                          }}>
                            {opportunityStatusLabels[opportunity.status]}
                          </span>
                          <div style={{ marginTop: '1rem' }}>
                            <button
                              onClick={() => {
                                setEditingOpportunity(opportunity)
                                setOpportunityFormData({
                                  contact_id: opportunity.contact_id || '',
                                  stage_id: opportunity.stage_id,
                                  title: opportunity.title,
                                  description: opportunity.description || '',
                                  value: opportunity.value?.toString() || '',
                                  currency: opportunity.currency,
                                  expected_close_date: opportunity.expected_close_date || '',
                                  status: opportunity.status,
                                  lost_reason: opportunity.lost_reason || ''
                                })
                                setShowOpportunityForm(true)
                              }}
                              style={{
                                padding: '0.4rem 0.8rem',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Modifier
                            </button>
                          </div>
                        </div>
                      </div>
                      {opportunity.description && (
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                          <strong>Description:</strong>
                          <p style={{ margin: '0.5rem 0 0 0', color: '#65696a' }}>{opportunity.description}</p>
                        </div>
                      )}
                      {opportunity.lost_reason && (
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8d7da', borderRadius: '4px' }}>
                          <strong>Raison de la perte:</strong>
                          <p style={{ margin: '0.5rem 0 0 0', color: '#721c24' }}>{opportunity.lost_reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </section>
      )}

      {activeTab === 'calendar' && (
        <section className="admin-section">
          <h2>Calendrier partagé</h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => {
                setEditingEvent(null)
                setEventFormData({
                  title: '',
                  description: '',
                  event_type: 'mission' as EventType,
                  start_date: '',
                  end_date: '',
                  all_day: false,
                  location: '',
                  mission_id: '',
                  user_id: '',
                  color: '#007bff'
                })
                setShowEventForm(true)
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              + Nouvel événement
            </button>
          </div>

          {showEventForm && (
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #c9c4b9',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ marginTop: 0 }}>{editingEvent ? 'Modifier l\'événement' : 'Nouvel événement'}</h3>
              <form onSubmit={async (e) => {
                e.preventDefault()
                if (!supabase) return

                try {
                  const eventData = {
                    ...eventFormData,
                    start_date: new Date(eventFormData.start_date).toISOString(),
                    end_date: new Date(eventFormData.end_date).toISOString()
                  }

                  if (editingEvent) {
                    const { error } = await supabase
                      .from('calendar_events')
                      .update({
                        ...eventData,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', editingEvent.id)
                    if (error) throw error
                  } else {
                    const { error } = await supabase
                      .from('calendar_events')
                      .insert({
                        ...eventData,
                        created_by: adminId
                      })
                    if (error) throw error
                  }
                  setShowEventForm(false)
                  setEditingEvent(null)
                  loadData()
                } catch (err) {
                  setError(getErrorMessage(err) || 'Erreur lors de la sauvegarde')
                }
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', marginBottom: '0.3rem' }}>Titre *</label>
                    <input
                      type="text"
                      value={eventFormData.title}
                      onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem' }}>Type d'événement</label>
                    <select
                      value={eventFormData.event_type}
                      onChange={(e) => setEventFormData({ ...eventFormData, event_type: e.target.value as EventType })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                    >
                      {Object.entries(eventTypeLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem' }}>Couleur</label>
                    <input
                      type="color"
                      value={eventFormData.color}
                      onChange={(e) => setEventFormData({ ...eventFormData, color: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px', height: '38px' }}
                    />
                  </div>
                  <div>
                    <label style={{ Display: 'block', marginBottom: '0.3rem' }}>Date de début *</label>
                    <input
                      type="datetime-local"
                      value={eventFormData.start_date}
                      onChange={(e) => setEventFormData({ ...eventFormData, start_date: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem' }}>Date de fin *</label>
                    <input
                      type="datetime-local"
                      value={eventFormData.end_date}
                      onChange={(e) => setEventFormData({ ...eventFormData, end_date: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={eventFormData.all_day}
                        onChange={(e) => setEventFormData({ ...eventFormData, all_day: e.target.checked })}
                      />
                      Toute la journée
                    </label>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', marginBottom: '0.3rem' }}>Lieu</label>
                    <input
                      type="text"
                      value={eventFormData.location}
                      onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', marginBottom: '0.3rem' }}>Description</label>
                    <textarea
                      value={eventFormData.description}
                      onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                      rows={3}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {editingEvent ? 'Mettre à jour' : 'Créer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEventForm(false)
                      setEditingEvent(null)
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'grid', gap: '1rem' }}>
            {calendarEvents.length === 0 ? (
              <p style={{ color: '#65696a', textAlign: 'center', padding: '2rem' }}>
                Aucun événement dans le calendrier
              </p>
            ) : (
              calendarEvents.map((event) => {
                const mission = missions.find(m => m.id === event.mission_id)
                const user = allUsers.find(u => u.id === event.user_id)
                
                return (
                  <div
                    key={event.id}
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid #c9c4b9',
                      borderRadius: '8px',
                      padding: '1rem',
                      borderLeft: `4px solid ${event.color}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 0.5rem 0' }}>{event.title}</h3>
                        <p style={{ margin: '0 0 0.5rem 0', color: '#65696a', fontSize: '0.9rem' }}>
                          {new Date(event.start_date).toLocaleString('fr-FR')} - {new Date(event.end_date).toLocaleString('fr-FR')}
                        </p>
                        {event.location && (
                          <p style={{ margin: '0 0 0.5rem 0', color: '#65696a', fontSize: '0.9rem' }}>
                            📍 {event.location}
                          </p>
                        )}
                        <span style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '3px',
                          fontSize: '0.75rem',
                          backgroundColor: '#e9ecef',
                          color: '#383d41'
                        }}>
                          {eventTypeLabels[event.event_type]}
                        </span>
                        {mission && (
                          <span style={{
                            display: 'inline-block',
                            marginLeft: '0.5rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            backgroundColor: '#d1ecf1',
                            color: '#0c5460'
                          }}>
                            Mission: {mission.title}
                          </span>
                        )}
                        {user && (
                          <span style={{
                            display: 'inline-block',
                            marginLeft: '0.5rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                            backgroundColor: '#d4edda',
                            color: '#155724'
                          }}>
                            {user.full_name}
                          </span>
                        )}
                      </div>
                      <div>
                        <button
                          onClick={() => {
                            setEditingEvent(event)
                            setEventFormData({
                              title: event.title,
                              description: event.description || '',
                              event_type: event.event_type,
                              start_date: event.start_date,
                              end_date: event.end_date,
                              all_day: event.all_day,
                              location: event.location || '',
                              mission_id: event.mission_id || '',
                              user_id: event.user_id || '',
                              color: event.color
                            })
                            setShowEventForm(true)
                          }}
                          style={{
                            padding: '0.4rem 0.8rem',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Modifier
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('Supprimer cet événement?')) return
                            if (!supabase) return
                            
                            const { error } = await supabase
                              .from('calendar_events')
                              .delete()
                              .eq('id', event.id)
                            
                            if (error) {
                              setError(getErrorMessage(error) || 'Erreur de suppression')
                            } else {
                              loadData()
                            }
                          }}
                          style={{
                            padding: '0.4rem 0.8rem',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginLeft: '0.5rem'
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                    {event.description && (
                      <p style={{ margin: '0.5rem 0 0 0', color: '#65696a', fontSize: '0.9rem' }}>
                        {event.description}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {activeTab === 'geographic' && (
        <section className="admin-section geographic-management">
          <h2>Carte de couverture</h2>
          <p className="geographic-management-intro">Choisis les pays à afficher dans chaque catégorie. Un pays peut appartenir à plusieurs catégories; la carte montrera alors le recouvrement.</p>
          <div className="geographic-management-groups">
            {([
              { key: 'interventionCountryIds', title: 'Zones d’intervention' },
              { key: 'clientCountryIds', title: 'Zones de clientèle' },
              { key: 'officeCountryIds', title: 'Bureaux' },
            ] as const).map((group) => (
              <fieldset className="geographic-management-group" key={group.key}>
                <legend>{group.title}</legend>
                {geographicCountryOptions.map((country) => (
                  <label key={country.id}>
                    <input
                      type="checkbox"
                      checked={geographicCoverage[group.key].includes(country.id)}
                      onChange={(event) => handleToggleGeographicCountry(group.key, country.id, event.target.checked)}
                    />
                    {country.name_fr}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <div className="geographic-management-footer">
            <p>Les pays cochés dans plusieurs groupes seront indiqués comme zones communes sur la carte.</p>
            <div className="geographic-management-save">
              {geographicCoverageSaved && <p role="status">Carte enregistrée.</p>}
              <button className="btn-confirm" onClick={handleSaveGeographicCoverage} disabled={isSavingGeographicCoverage}>
                {isSavingGeographicCoverage ? 'Enregistrement…' : 'Enregistrer la carte'}
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'testimonials' && (
        <section className="admin-section testimonial-management">
          <div className="testimonial-heading">
            <div>
              <h2>Retours d’expérience</h2>
              <p>Ajoute uniquement des retours authentiques. Ils restent privés tant qu’ils ne sont pas publiés.</p>
            </div>
            {!showTestimonialForm && (
              <button className="btn-confirm" onClick={() => { setEditingTestimonialKey(null); setTestimonialFormData({ name: '', organization: '', role: '', quote_fr: '', quote_en: '', consent_confirmed: false, is_published: false }); setShowTestimonialForm(true) }}>
                Ajouter un témoignage
              </button>
            )}
          </div>

          {testimonials.length === 0 && !showTestimonialForm && (
            <div className="testimonial-empty">Aucun témoignage pour le moment. Les retours publiés apparaîtront sur le site après confirmation de l’autorisation.</div>
          )}

          {testimonials.length > 0 && (
            <div className="testimonial-admin-list">
              {testimonials.map((testimonial) => (
                <article className="testimonial-admin-item" key={testimonial.id}>
                  <div className="testimonial-admin-meta">
                    <strong>{testimonial.name}</strong>
                    <span className={testimonial.is_published && testimonial.consent_confirmed ? 'testimonial-status published' : 'testimonial-status'}>
                      {testimonial.is_published && testimonial.consent_confirmed ? 'Publié' : 'Brouillon'}
                    </span>
                  </div>
                  <p>{testimonial.quote_fr}</p>
                  <small>{[testimonial.role, testimonial.organization].filter(Boolean).join(' · ')}</small>
                  <div className="testimonial-admin-actions">
                    <button className="btn-edit" onClick={() => { setEditingTestimonialKey(testimonial.id); setTestimonialFormData({ name: testimonial.name, organization: testimonial.organization, role: testimonial.role, quote_fr: testimonial.quote_fr, quote_en: testimonial.quote_en, consent_confirmed: testimonial.consent_confirmed, is_published: testimonial.is_published }); setShowTestimonialForm(true) }}>
                      Modifier
                    </button>
                    <button className="btn-delete" onClick={() => handleDeleteTestimonial(testimonial.id)}>Supprimer</button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {showTestimonialForm && (
            <form className="testimonial-form" onSubmit={handleSaveTestimonial}>
              <h3>{editingTestimonialKey ? 'Modifier le témoignage' : 'Nouveau témoignage'}</h3>
              <label>Nom affiché
                <input required value={testimonialFormData.name} onChange={(event) => setTestimonialFormData({ ...testimonialFormData, name: event.target.value })} />
              </label>
              <div className="testimonial-form-row">
                <label>Fonction
                  <input value={testimonialFormData.role} onChange={(event) => setTestimonialFormData({ ...testimonialFormData, role: event.target.value })} />
                </label>
                <label>Organisation
                  <input value={testimonialFormData.organization} onChange={(event) => setTestimonialFormData({ ...testimonialFormData, organization: event.target.value })} />
                </label>
              </div>
              <label>Témoignage (français)
                <textarea required rows={4} value={testimonialFormData.quote_fr} onChange={(event) => setTestimonialFormData({ ...testimonialFormData, quote_fr: event.target.value })} />
              </label>
              <label>Testimonial (English, facultatif)
                <textarea rows={4} value={testimonialFormData.quote_en} onChange={(event) => setTestimonialFormData({ ...testimonialFormData, quote_en: event.target.value })} />
              </label>
              <label className="testimonial-checkbox">
                <input type="checkbox" checked={testimonialFormData.consent_confirmed} onChange={(event) => setTestimonialFormData({ ...testimonialFormData, consent_confirmed: event.target.checked, is_published: event.target.checked ? testimonialFormData.is_published : false })} />
                J’ai l’autorisation explicite de publier ce témoignage et le nom associé.
              </label>
              <label className="testimonial-checkbox">
                <input type="checkbox" checked={testimonialFormData.is_published} disabled={!testimonialFormData.consent_confirmed} onChange={(event) => setTestimonialFormData({ ...testimonialFormData, is_published: event.target.checked })} />
                Publier sur le site
              </label>
              <div className="testimonial-admin-actions">
                <button className="btn-confirm" type="submit">Enregistrer</button>
                <button className="btn-cancel" type="button" onClick={resetTestimonialForm}>Annuler</button>
              </div>
            </form>
          )}
        </section>
      )}

      {activeTab === 'logos' && (
        <section className="admin-section partner-logo-management">
          <h2>Logos partenaires</h2>
          <p>Ajoutez les partenaires que vous souhaitez présenter dans le carrousel public. Un logo apparaît dès son ajout.</p>
          <form className="partner-logo-form" onSubmit={handleCreatePartnerLogo}>
            <label>Nom du partenaire
              <input required value={partnerLogoName} onChange={(event) => setPartnerLogoName(event.target.value)} />
            </label>
            <label>Site web (facultatif)
              <input type="url" placeholder="https://exemple.com" value={partnerLogoWebsite} onChange={(event) => setPartnerLogoWebsite(event.target.value)} />
            </label>
            <label>Logo (PNG, JPEG ou WebP, 5 Mo maximum)
              <input required type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPartnerLogoFile(event.target.files?.[0] || null)} />
            </label>
            <button className="btn-confirm" type="submit" disabled={isSavingPartnerLogo || !partnerLogoFile}>
              {isSavingPartnerLogo ? 'Ajout en cours...' : 'Ajouter et afficher le logo'}
            </button>
          </form>

          {partnerLogos.length === 0 ? (
            <p className="partner-logo-empty">Aucun logo ajouté. Le carrousel apparaîtra sur le site après le premier ajout.</p>
          ) : (
            <div className="partner-logo-admin-list">
              {partnerLogos.map((logo) => (
                <article className="partner-logo-admin-item" key={logo.id}>
                  <img src={supabase?.storage.from('partner-public-assets').getPublicUrl(logo.logo_path).data.publicUrl} alt="" />
                  <div><strong>{logo.name}</strong>{logo.website && <a href={logo.website} target="_blank" rel="noreferrer">{logo.website}</a>}</div>
                  <button className="btn-delete" type="button" onClick={() => handleDeletePartnerLogo(logo)}>Retirer</button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'content' && (
        <section className="admin-section">
          <h2>Contenu du site</h2>
          <SiteContentQuickEditor adminId={adminId} />
          <details className="admin-content-advanced">
            <summary>Autres contenus et édition avancée</summary>
          
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Section</label>
              <select
                value={selectedContentSection}
                onChange={(e) => setSelectedContentSection(e.target.value as SiteContentSection)}
                style={{ padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
              >
                {Object.entries(siteContentSections).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Langue</label>
              <select
                value={selectedContentLanguage}
                onChange={(e) => setSelectedContentLanguage(e.target.value as SiteContentLanguage)}
                style={{ padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {siteContent
              .filter(content => content.section === selectedContentSection && content.language === selectedContentLanguage)
              .map((content) => (
                <div
                  key={content.id}
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #c9c4b9',
                    borderRadius: '8px',
                    padding: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#171819' }}>{content.key}</strong>
                    <button
                      onClick={() => {
                        setEditingContent(content)
                        setContentFormData({ content: content.content })
                      }}
                      style={{
                        padding: '0.3rem 0.6rem',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      Modifier
                    </button>
                  </div>
                  <p style={{ color: '#65696a', fontSize: '0.9rem', margin: 0 }}>
                    {content.content}
                  </p>
                </div>
              ))}
          </div>

          {editingContent && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '2rem',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}>
                <h3 style={{ marginTop: 0 }}>Modifier: {editingContent.key}</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  if (!supabase) return

                  try {
                    const { error } = await supabase
                      .from('site_content')
                      .update({
                        content: contentFormData.content,
                        updated_at: new Date().toISOString(),
                        updated_by: adminId
                      })
                      .eq('id', editingContent.id)

                    if (error) throw error

                    setEditingContent(null)
                    setContentFormData({ content: '' })
                    loadData()
                  } catch (err) {
                    setError(getErrorMessage(err) || 'Erreur lors de la mise à jour')
                  }
                }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.3rem' }}>Contenu</label>
                    <textarea
                      value={contentFormData.content}
                      onChange={(e) => setContentFormData({ content: e.target.value })}
                      rows={6}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #c9c4b9', borderRadius: '4px' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContent(null)
                        setContentFormData({ content: '' })
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Sauvegarder
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </details>
        </section>
      )}

      {activeTab === 'stats' && (
        <section className="admin-section">
          <h2>Statistiques</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{missions.length}</div>
              <div className="stat-label">Missions totales</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{missions.filter((m) => m.status === 'draft').length}</div>
              <div className="stat-label">Brouillons</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{missions.filter((m) => m.status === 'accepted').length}</div>
              <div className="stat-label">Acceptées</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{missions.filter((m) => m.status === 'in_progress').length}</div>
              <div className="stat-label">En cours</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{missions.filter((m) => m.status === 'completed').length}</div>
              <div className="stat-label">Complétées</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{collaborators.length}</div>
              <div className="stat-label">Collaborateurs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{contactRequests.length}</div>
              <div className="stat-label">Messages reçus</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{pageViews}</div>
              <div className="stat-label">Vues du site</div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'legal' && (
        <section className="admin-section">
          <h2>Documents juridiques</h2>
          <p style={{ marginBottom: '1.5rem', color: '#666' }}>
            Gérez les documents juridiques du site (mentions légales, conditions généales, RGPD, etc.).
            Ces documents seront accessibles aux visiteurs via le site public.
          </p>

          <form id="legal-document-form" onSubmit={handleUploadLegalDocument} style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f5f5f5', borderRadius: '8px' }}>
            <h3>{editingLegalDocId ? 'Remplacer un document existant' : 'Ajouter un document juridique'}</h3>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Type de document *
                </label>
                <select
                  value={legalDocType}
                  onChange={(e) => setLegalDocType(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="mentions_legales">Mentions légales</option>
                  <option value="cgu">Conditions généales d'utilisation (CGU)</option>
                  <option value="cgv">Conditions généales de vente (CGV)</option>
                  <option value="rgpd">Politique de confidentialité (RGPD)</option>
                  <option value="cookies">Politique de cookies</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Fichier (PDF) *
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setLegalDocFile(e.target.files?.[0] || null)}
                  required
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={uploadingLegalDoc || !legalDocFile}
              style={{
                marginTop: '1rem',
                padding: '0.6rem 1.2rem',
                background: uploadingLegalDoc ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: uploadingLegalDoc ? 'not-allowed' : 'pointer',
              }}
            >
              {uploadingLegalDoc ? 'Enregistrement...' : editingLegalDocId ? 'Remplacer le document' : '📤 Télécharger le document'}
            </button>
            {editingLegalDocId && (
              <button
                type="button"
                onClick={() => {
                  setEditingLegalDocId(null)
                  setLegalDocFile(null)
                  setLegalDocType('mentions_legales')
                  document.querySelector<HTMLFormElement>('#legal-document-form')?.reset()
                }}
                style={{ marginTop: '1rem', marginLeft: '0.75rem' }}
              >
                Annuler le remplacement
              </button>
            )}
          </form>

          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Documents existants</h3>
            {legalDocuments.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Aucun document juridique téléchargé.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {legalDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      background: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                        {doc.type === 'mentions_legales' && '📄 Mentions légales'}
                        {doc.type === 'cgu' && '📋 Conditions généales d\'utilisation'}
                        {doc.type === 'cgv' && '💰 Conditions générales de vente'}
                        {doc.type === 'rgpd' && '🔒 Politique de confidentialité (RGPD)'}
                        {doc.type === 'cookies' && '🍪 Politique de cookies'}
                        {doc.type === 'autre' && '📎 Autre document'}
                      </strong>
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>
                        {doc.file_name} · Mis à jour le {new Date(doc.updated_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => {
                          setEditingLegalDocId(doc.id)
                          setLegalDocType(doc.type)
                          setLegalDocFile(null)
                          document.getElementById('legal-document-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }}
                        style={{ padding: '0.4rem 0.8rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Remplacer
                      </button>
                      <button
                        onClick={() => handleDownloadLegalDocument(doc.file_path, doc.file_name)}
                        style={{
                          padding: '0.4rem 0.8rem',
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        ⬇️ Télécharger
                      </button>
                      <button
                        onClick={() => handleDeleteLegalDocument(doc.id, doc.file_path)}
                        style={{
                          padding: '0.4rem 0.8rem',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
