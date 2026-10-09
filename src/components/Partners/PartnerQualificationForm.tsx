import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../supabase'
import { getErrorMessage } from '../../lib/errors'
import './PartnerQualificationForm.css'

type QualificationValues = Record<string, string>
type FormMode = 'application' | 'admin'
type QualificationDocument = { file: File; storage_id: string; document_type: string; expires_at: string }
type FieldType = 'text' | 'textarea' | 'email' | 'tel' | 'url' | 'date' | 'number' | 'select' | 'radio' | 'checkbox' | 'files'
type FieldOption = { value: string; label: string }
type QualificationField = { key: string; label: string; type?: FieldType; options?: FieldOption[]; rows?: number; requireAllOptions?: boolean }
type QualificationSection = { title: string; fields: QualificationField[] }

const yesNo = [{ value: 'yes', label: 'Oui' }, { value: 'no', label: 'Non' }]
const docStatus = [
  { value: 'attached', label: 'Joint à la candidature' },
  { value: 'to_provide', label: 'À fournir' },
  { value: 'not_applicable', label: 'Non applicable' },
]

const sections: QualificationSection[] = [
  {
    title: '1. Identification de la structure',
    fields: [
      { key: 'business_name', label: 'Dénomination sociale' },
      { key: 'trade_name', label: 'Nom commercial' },
      { key: 'legal_form', label: 'Forme juridique' },
      { key: 'country', label: 'Pays' },
      { key: 'city', label: 'Ville / siège' },
      { key: 'address', label: 'Adresse du siège' },
      { key: 'website', label: 'Site internet (ou indiquez « Aucun »)' },
      { key: 'registration_number', label: 'Identifiant légal / registre' },
      { key: 'company_created_at', label: 'Date de création', type: 'date' },
    ],
  },
  {
    title: '2. Dirigeant / responsable',
    fields: [
      { key: 'contact_name', label: 'Nom et prénom' },
      { key: 'contact_title', label: 'Fonction' },
      { key: 'contact_phone', label: 'Téléphone', type: 'tel' },
      { key: 'contact_email', label: 'E-mail professionnel', type: 'email' },
      { key: 'mission_contact', label: 'Personne référente pour les missions Scope-Verify' },
    ],
  },
  {
    title: '3. Domaines de compétence',
    fields: [
      { key: 'domains', label: 'Domaine(s) principal(aux)', type: 'checkbox', options: [
        { value: 'Inspection / contrôle', label: 'Inspection / contrôle' },
        { value: 'Expertise technique', label: 'Expertise technique' },
        { value: 'BTP / génie civil', label: 'BTP / génie civil' },
        { value: 'Industrie / équipements', label: 'Industrie / équipements' },
        { value: 'Laboratoire / essais / analyses', label: 'Laboratoire / essais / analyses' },
        { value: 'Environnement', label: 'Environnement' },
        { value: 'Immobilier / bâtiment', label: 'Immobilier / bâtiment' },
        { value: 'Logistique / transport', label: 'Logistique / transport' },
        { value: 'Agriculture / agroalimentaire', label: 'Agriculture / agroalimentaire' },
        { value: 'Finance / comptabilité', label: 'Finance / comptabilité' },
        { value: 'Droit / juridique', label: 'Droit / juridique' },
        { value: 'Autre', label: 'Autre' },
      ] },
      { key: 'domains_other', label: 'Précisez « Autre » ou indiquez « Sans objet »' },
      { key: 'services', label: 'Décrivez précisément vos compétences et prestations', type: 'textarea', rows: 4 },
      { key: 'mission_types', label: 'Types de missions que vous êtes en mesure de réaliser', type: 'textarea', rows: 3 },
      { key: 'scope_limits', label: 'Limites ou exclusions de votre domaine d’intervention', type: 'textarea', rows: 3 },
    ],
  },
  {
    title: '4. Qualifications, agréments et accréditations',
    fields: [
      { key: 'qualification_type', label: 'Pour chaque qualification pertinente : type' },
      { key: 'qualification_issuer', label: 'Organisme délivrant' },
      { key: 'qualification_reference', label: 'Référence / numéro' },
      { key: 'qualification_scope', label: 'Périmètre / portée' },
      { key: 'qualification_validity', label: 'Date de validité' },
      { key: 'other_qualifications', label: 'Autres qualifications / agréments / accréditations : détaillez chaque élément (type, organisme, référence, portée, validité) ou indiquez « Sans objet »', type: 'textarea', rows: 4 },
    ],
  },
  {
    title: '5. Assurances',
    fields: [
      { key: 'insurance_provider', label: 'Responsabilité civile professionnelle : compagnie' },
      { key: 'insurance_policy', label: 'N° de contrat' },
      { key: 'insurance_validity', label: 'Date de validité' },
      { key: 'insurance_coverage', label: 'Activités couvertes', type: 'textarea', rows: 2 },
      { key: 'insurance_attestation', label: 'Attestation d’assurance jointe', type: 'radio', options: yesNo },
      { key: 'other_insurances', label: 'Autres assurances ou garanties pertinentes (détaillez ou indiquez « Sans objet »)', type: 'textarea', rows: 3 },
    ],
  },
  {
    title: '6. Expérience et références',
    fields: [
      { key: 'experience_years', label: 'Années d’expérience dans le domaine', type: 'number' },
      { key: 'sectors', label: 'Principaux secteurs d’intervention', type: 'textarea', rows: 2 },
      { key: 'reference_1', label: 'Référence professionnelle pertinente 1', type: 'textarea', rows: 2 },
      { key: 'reference_2', label: 'Référence professionnelle pertinente 2', type: 'textarea', rows: 2 },
      { key: 'reference_3', label: 'Référence professionnelle pertinente 3 (ou « Sans objet »)', type: 'textarea', rows: 2 },
      { key: 'similar_missions', label: 'Expériences ou missions similaires à celles susceptibles d’être confiées par Scope-Verify', type: 'textarea', rows: 3 },
    ],
  },
  {
    title: '7. Couverture géographique',
    fields: [
      { key: 'coverage_levels', label: 'Zones d’intervention', type: 'checkbox', options: [
        { value: 'Locale', label: 'Locale' }, { value: 'Régionale', label: 'Régionale' },
        { value: 'Nationale', label: 'Nationale' }, { value: 'Internationale', label: 'Internationale' },
      ] },
      { key: 'coverage', label: 'Villes / régions couvertes', type: 'textarea', rows: 3 },
      { key: 'outside_area', label: 'Possibilité d’intervention hors zone habituelle', type: 'radio', options: yesNo },
    ],
  },
  {
    title: '8. Capacité d’intervention',
    fields: [
      { key: 'lead_time', label: 'Délai habituel entre la demande et l’intervention', type: 'radio', options: [
        { value: 'under_24h', label: '< 24 h' }, { value: '24_48h', label: '24–48 h' },
        { value: '2_5_days', label: '2–5 jours' }, { value: 'over_5_days', label: '> 5 jours' },
        { value: 'mission_dependent', label: 'À définir selon la mission' },
      ] },
      { key: 'occasional_missions', label: 'Disponibilité pour des missions ponctuelles', type: 'radio', options: yesNo },
      { key: 'languages', label: 'Langues de travail' },
      { key: 'written_report', label: 'Capacité à fournir un rapport écrit', type: 'radio', options: yesNo },
      { key: 'report_lead_time', label: 'Délai habituel de remise du rapport' },
    ],
  },
  {
    title: '9. Modalités de restitution',
    fields: [
      { key: 'deliverables', label: 'Type de livrable habituel', type: 'checkbox', options: [
        { value: 'Rapport', label: 'Rapport' }, { value: 'Compte rendu', label: 'Compte rendu' },
        { value: 'Expertise', label: 'Expertise' }, { value: 'Procès-verbal', label: 'Procès-verbal' },
        { value: 'Certificat / attestation', label: 'Certificat / attestation' }, { value: 'Résultats d’analyses / essais', label: 'Résultats d’analyses / essais' },
        { value: 'Photographies / éléments documentaires', label: 'Photographies / éléments documentaires' }, { value: 'Autre', label: 'Autre' },
      ] },
      { key: 'deliverables_other', label: 'Précisez « Autre » ou indiquez « Sans objet »' },
      { key: 'sample_report_available', label: 'Exemple anonymisé de rapport ou livrable pouvant être transmis', type: 'radio', options: yesNo },
    ],
  },
  {
    title: '10. Conditions commerciales',
    fields: [
      { key: 'billing_method', label: 'Mode de facturation habituel', type: 'radio', options: [
        { value: 'fixed_fee', label: 'Forfait' }, { value: 'hourly', label: 'Taux horaire' },
        { value: 'quote', label: 'Selon devis' }, { value: 'other', label: 'Autre' },
      ] },
      { key: 'billing_other', label: 'Précisez « Autre » ou indiquez « Sans objet »' },
      { key: 'commercial_terms', label: 'Tarifs indicatifs / fourchette (précisez devise et unité)' },
      { key: 'travel_expenses', label: 'Frais de déplacement' },
      { key: 'payment_terms', label: 'Délais et conditions de paiement' },
      { key: 'special_conditions', label: 'Conditions particulières', type: 'textarea', rows: 3 },
    ],
  },
  {
    title: '11. Collaboration avec Scope-Verify',
    fields: [
      { key: 'accept_qualified_missions', label: 'Intéressé par la réception de missions qualifiées transmises par Scope-Verify ?', type: 'radio', options: yesNo },
      { key: 'independent_network_member', label: 'Disposé à intervenir en tant que professionnel indépendant du réseau Scope-Verify, dans votre domaine de compétence ?', type: 'radio', options: yesNo },
      { key: 'collaboration_conditions', label: 'Observations / conditions particulières', type: 'textarea', rows: 3 },
    ],
  },
  {
    title: '12. Documents à fournir',
    fields: [
      { key: 'registration_document_status', label: 'Document d’immatriculation / registre légal de la société', type: 'select', options: docStatus },
      { key: 'company_identity_document_status', label: 'Justificatif d’identification de l’entreprise', type: 'select', options: docStatus },
      { key: 'insurance_document_status', label: 'Attestation d’assurance responsabilité civile professionnelle', type: 'select', options: docStatus },
      { key: 'approval_document_status', label: 'Agréments pertinents', type: 'select', options: docStatus },
      { key: 'accreditation_document_status', label: 'Accréditations pertinentes', type: 'select', options: docStatus },
      { key: 'qualification_document_status', label: 'Certifications / qualifications professionnelles pertinentes', type: 'select', options: docStatus },
      { key: 'competence_evidence_status', label: 'Documents justifiant les compétences déclarées', type: 'select', options: docStatus },
      { key: 'references_document_status', label: 'Document complémentaire : références', type: 'select', options: docStatus },
      { key: 'sample_report_document_status', label: 'Document complémentaire : exemple de rapport anonymisé', type: 'select', options: docStatus },
      { key: 'specific_authorizations_status', label: 'Document complémentaire : autorisations spécifiques', type: 'select', options: docStatus },
      { key: 'staff_diplomas_status', label: 'Document complémentaire : diplômes / qualifications des intervenants concernés', type: 'select', options: docStatus },
      { key: 'other_documents_status', label: 'Document complémentaire : autre', type: 'select', options: docStatus },
      { key: 'other_documents_description', label: 'Précisez les autres documents ou indiquez « Sans objet »' },
      { key: 'supporting_files', label: 'Joindre les justificatifs disponibles', type: 'files' },
    ],
  },
  {
    title: '13. Déclaration du responsable',
    fields: [
      { key: 'declaration_name', label: 'Nom du responsable signataire' },
      { key: 'declaration_title', label: 'Fonction du signataire' },
      { key: 'declaration_date', label: 'Date de déclaration', type: 'date' },
      { key: 'declaration_confirmed', label: 'Confirmer la déclaration', type: 'checkbox', requireAllOptions: true, options: [
        { value: 'confirmed', label: 'Je certifie que les informations communiquées dans cette fiche sont exactes et que les documents transmis sont authentiques et à jour.' },
        { value: 'verification_authorized', label: 'J’autorise Scope-Verify à vérifier, dans le cadre du processus de qualification, les informations et justificatifs communiqués.' },
        { value: 'changes_commitment', label: 'Je m’engage à informer Scope-Verify de toute modification affectant les qualifications, agréments, assurances ou conditions d’intervention déclarées.' },
      ] },
      { key: 'declaration_signature', label: 'Signature (nom complet saisi)' },
    ],
  },
]

const adminReviewSection: QualificationSection = {
  title: '14. Réservé à Scope-Verify',
  fields: [
    { key: 'review_received_date', label: 'Date de réception', type: 'date' },
    { key: 'review_legal_identity', label: 'Vérification : identité juridique de la structure', type: 'radio', options: yesNo },
    { key: 'review_competences', label: 'Vérification : compétences', type: 'radio', options: yesNo },
    { key: 'review_qualifications', label: 'Vérification : agréments / accréditations / qualifications', type: 'radio', options: yesNo },
    { key: 'review_insurance', label: 'Vérification : assurances', type: 'radio', options: yesNo },
    { key: 'review_references', label: 'Vérification : références', type: 'radio', options: yesNo },
    { key: 'review_coverage', label: 'Vérification : portée géographique', type: 'radio', options: yesNo },
    { key: 'review_commercial_terms', label: 'Vérification : conditions commerciales', type: 'radio', options: yesNo },
    { key: 'review_deliverables', label: 'Vérification : qualité des livrables', type: 'radio', options: yesNo },
    { key: 'review_additional_checks', label: 'Vérifications complémentaires effectuées', type: 'textarea', rows: 3 },
    { key: 'review_interview_date', label: 'Entretien réalisé le', type: 'date' },
    { key: 'review_evaluator', label: 'Évaluateur Scope-Verify' },
    { key: 'review_status', label: 'Statut de qualification', type: 'select', options: [
      { value: 'to_qualify', label: 'À qualifier' }, { value: 'under_review', label: 'En cours de vérification' },
      { value: 'referenced', label: 'Référencé' }, { value: 'network', label: 'Réseau Scope-Verify' },
      { value: 'rejected', label: 'Non retenu' }, { value: 'suspended', label: 'Suspendu' },
    ] },
    { key: 'review_comments', label: 'Commentaires / réserves', type: 'textarea', rows: 3 },
    { key: 'review_next_date', label: 'Date de prochaine réévaluation', type: 'date' },
    { key: 'review_validation_name', label: 'Validation Scope-Verify : nom' },
    { key: 'review_validation_title', label: 'Fonction' },
    { key: 'review_validation_date', label: 'Date de validation', type: 'date' },
    { key: 'review_validation_signature', label: 'Signature (nom complet saisi)' },
  ],
}

const allSections = (mode: FormMode) => mode === 'admin' ? [...sections, adminReviewSection] : sections
const emptyValues = (mode: FormMode): QualificationValues => Object.fromEntries(allSections(mode).flatMap((section) => section.fields.map((field) => [field.key, ''])))
const selectedValues = (value: string) => value ? value.split('||') : []
const partnerApplicationDraftKey = 'scopeverify.partner-application.draft.v1'

interface PartnerApplicationDraft {
  values: QualificationValues
  step: number
}

function readPartnerApplicationDraft(): PartnerApplicationDraft {
  const emptyDraft = { values: emptyValues('application'), step: 0 }
  if (typeof window === 'undefined') return emptyDraft

  try {
    const savedText = window.sessionStorage.getItem(partnerApplicationDraftKey)
    if (!savedText) return emptyDraft
    const savedValue: unknown = JSON.parse(savedText)
    if (!savedValue || typeof savedValue !== 'object') return emptyDraft

    const saved = savedValue as { values?: unknown; step?: unknown; savedAt?: unknown }
    if (typeof saved.savedAt !== 'number' || Date.now() - saved.savedAt > 7 * 24 * 60 * 60 * 1000) {
      window.sessionStorage.removeItem(partnerApplicationDraftKey)
      return emptyDraft
    }

    const values = { ...emptyDraft.values }
    if (saved.values && typeof saved.values === 'object') {
      for (const [key, value] of Object.entries(saved.values)) {
        if (key in values && typeof value === 'string') values[key] = value
      }
    }

    const fileStep = allSections('application').findIndex((section) => section.fields.some((field) => field.type === 'files'))
    const savedStep = typeof saved.step === 'number' ? Math.max(0, Math.min(saved.step, sections.length - 1)) : 0
    return { values, step: fileStep >= 0 && savedStep > fileStep ? fileStep : savedStep }
  } catch {
    return emptyDraft
  }
}

interface PartnerQualificationFormProps {
  mode: FormMode
  createdBy?: string
  onComplete?: () => void
  onCancel?: () => void
}

export default function PartnerQualificationForm({ mode, createdBy, onComplete, onCancel }: PartnerQualificationFormProps) {
  const [initialDraft] = useState(() => mode === 'application' ? readPartnerApplicationDraft() : { values: emptyValues(mode), step: 0 })
  const [values, setValues] = useState<QualificationValues>(initialDraft.values)
  const [password, setPassword] = useState('')
  const [files, setFiles] = useState<QualificationDocument[]>([])
  const [step, setStep] = useState(initialDraft.step)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const formSections = allSections(mode)
  const currentSection = formSections[step]
  const fieldCount = formSections.reduce((count, section) => count + section.fields.length, 0) + (mode === 'application' ? 1 : 0)

  useEffect(() => {
    if (mode !== 'application' || complete) return
    try {
      window.sessionStorage.setItem(partnerApplicationDraftKey, JSON.stringify({ values, step, savedAt: Date.now() }))
    } catch {
      // The form remains usable when browser storage is unavailable.
    }
  }, [complete, mode, step, values])

  const updateValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }))
  const toggleCheckbox = (key: string, option: string) => {
    const selected = selectedValues(values[key])
    updateValue(key, selected.includes(option) ? selected.filter((item) => item !== option).join('||') : [...selected, option].join('||'))
  }

  const goNext = () => {
    if (!currentSection || !formRef.current?.reportValidity()) return
    const emptyCheckboxes = currentSection.fields.filter((field) => {
      if (field.type !== 'checkbox') return false
      const selected = selectedValues(values[field.key])
      return field.requireAllOptions ? selected.length !== (field.options?.length || 0) : selected.length === 0
    })
    if (emptyCheckboxes.length) {
      setError(`Sélectionnez au moins une réponse pour : ${emptyCheckboxes.map((field) => field.label).join(', ')}.`)
      return
    }
    if (currentSection.fields.some((field) => field.type === 'files') && files.length === 0) {
      setError('Joignez au moins un justificatif pour poursuivre.')
      return
    }
    setError('')
    setStep((current) => Math.min(current + 1, formSections.length - 1))
  }

  const uploadFiles = async (profileId: string, uploadedBy: string | null) => {
    if (!supabase) throw new Error('Supabase non configuré')
    for (const document of files) {
      const path = `${profileId}/${document.storage_id}-${document.file.name}`
      const { error: uploadError } = await supabase.storage.from('partner-documents').upload(path, document.file)
      if (uploadError) throw uploadError
      const { error: documentError } = await supabase.from('partner_documents').insert({
        partner_profile_id: profileId,
        file_path: path,
        file_name: document.file.name,
        document_type: document.document_type,
        expires_at: document.expires_at || null,
        uploaded_by: uploadedBy,
      })
      if (documentError) throw documentError
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (step < formSections.length - 1) {
      goNext()
      return
    }
    if (!formRef.current?.reportValidity()) return
    const emptyCheckboxes = currentSection.fields.filter((field) => {
      if (field.type !== 'checkbox') return false
      const selected = selectedValues(values[field.key])
      return field.requireAllOptions ? selected.length !== (field.options?.length || 0) : selected.length === 0
    })
    if (emptyCheckboxes.length) {
      setError(`Sélectionnez au moins une réponse pour : ${emptyCheckboxes.map((field) => field.label).join(', ')}.`)
      return
    }
    if (!supabase) {
      setError('Le service est temporairement indisponible.')
      return
    }

    setBusy(true)
    try {
      let userId: string | null = null
      if (mode === 'application') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: values.contact_email,
          password,
          options: { data: { role: 'partner', full_name: values.contact_name, company: values.business_name } },
        })
        if (authError) throw authError
        if (!data.user) throw new Error('Création du compte impossible')
        userId = data.user.id
        const { error: userError } = await supabase.from('users').insert({
          id: userId,
          email: values.contact_email,
          full_name: values.contact_name,
          company: values.business_name,
          role: 'partner',
          is_active: false,
        })
        if (userError) throw userError
      }

      const initialStatus = mode === 'application' ? 'pending' : values.review_status || 'to_qualify'
      const { data: profile, error: profileError } = await supabase.from('partner_profiles').insert({
        user_id: userId,
        business_name: values.business_name,
        contact_email: values.contact_email,
        contact_name: values.contact_name,
        qualification_data: values,
        status: initialStatus,
        internal_notes: mode === 'admin' ? values.review_comments || '' : '',
        created_by: createdBy || null,
      }).select('id').single()
      if (profileError) throw profileError
      await uploadFiles(profile.id, userId || createdBy || null)
      if (mode === 'application') window.sessionStorage.removeItem(partnerApplicationDraftKey)
      setComplete(true)
      onComplete?.()
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible d’enregistrer la fiche partenaire.')
    } finally {
      setBusy(false)
    }
  }

  if (complete) {
    return <div className="partner-form-success" role="status">
      <h2>{mode === 'application' ? 'Candidature reçue' : 'Fiche partenaire créée'}</h2>
      <p>{mode === 'application' ? 'STATUT : EN ATTENTE DE VALIDATION. Votre compte ne donne pas encore accès aux missions.' : 'La fiche et les éléments de vérification Scope-Verify sont enregistrés.'}</p>
      <button type="button" onClick={onCancel}>Terminer</button>
    </div>
  }

  return (
    <form ref={formRef} className="partner-qualification-form" onSubmit={handleSubmit}>
      <div className="partner-form-heading">
        <div><p className="partner-form-kicker">Fiche de qualification partenaire Scope-Verify</p><h2>{mode === 'application' ? 'Candidature partenaire' : 'Ajouter un partenaire'}</h2></div>
        <span>{step + 1} / {formSections.length}</span>
      </div>
      <div className="partner-form-progress" aria-label={`Étape ${step + 1}`}><i style={{ width: `${((step + 1) / formSections.length) * 100}%` }} /></div>
      {mode === 'application' && <p className="partner-form-draft-notice">Vos réponses restent conservées dans cet onglet, y compris après un rechargement. Si vous le fermez, le brouillon sera effacé. Après rechargement, vous devrez joindre à nouveau les justificatifs et ressaisir votre mot de passe.</p>}
      <div className="partner-form-steps" aria-label="Étapes de qualification">
        {formSections.map((section, index) => <span key={section.title} className={index === step ? 'current' : index < step ? 'done' : ''}>{section.title}</span>)}
      </div>
      <fieldset className="partner-field-grid">
        <legend>{currentSection.title}</legend>
        {currentSection.fields.map((field) => {
          const type = field.type || 'text'
          if (type === 'checkbox') return <fieldset key={field.key} className="partner-choice-group wide" aria-required="true">
            <legend>{field.label} <span aria-hidden="true">*</span></legend>
            <div className="partner-choice-grid">{field.options?.map((option) => <label key={option.value} className="partner-choice"><input type="checkbox" checked={selectedValues(values[field.key]).includes(option.value)} onChange={() => toggleCheckbox(field.key, option.value)} disabled={busy} /><span>{option.label}</span></label>)}</div>
            {field.requireAllOptions && <small>Toutes les confirmations de cette rubrique sont requises.</small>}
            {error.includes(field.label) && (field.requireAllOptions ? selectedValues(values[field.key]).length !== (field.options?.length || 0) : !values[field.key]) && <span className="partner-form-error">{field.requireAllOptions ? 'Toutes les confirmations sont requises.' : 'Effectuez au moins une sélection.'}</span>}
          </fieldset>
          if (type === 'radio') return <fieldset key={field.key} className="partner-choice-group wide">
            <legend>{field.label} <span aria-hidden="true">*</span></legend>
            <div className="partner-choice-grid">{field.options?.map((option) => <label key={option.value} className="partner-choice"><input type="radio" name={field.key} value={option.value} checked={values[field.key] === option.value} onChange={(event) => updateValue(field.key, event.target.value)} required disabled={busy} /><span>{option.label}</span></label>)}</div>
          </fieldset>
          if (type === 'files') return <div key={field.key} className="partner-file-upload wide">
            <label>{field.label} <span aria-hidden="true">*</span><input type="file" multiple required accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setFiles(Array.from(event.target.files || []).map((file) => ({ file, storage_id: crypto.randomUUID(), document_type: 'other', expires_at: '' })))} disabled={busy} /><small>PDF, JPG, PNG ou WEBP, 15 Mo maximum par document. Au moins un fichier est requis.</small></label>
            {files.map((document, index) => <div className="partner-document-entry" key={`${document.file.name}-${index}`}>
              <strong>{document.file.name}</strong>
              <label>Nature du document<select value={document.document_type} onChange={(event) => setFiles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, document_type: event.target.value } : item))}><option value="registration">Immatriculation / registre</option><option value="company_identity">Identification entreprise</option><option value="insurance">Assurance RC professionnelle</option><option value="approval">Agrément</option><option value="accreditation">Accréditation</option><option value="qualification">Certification / qualification</option><option value="competence_evidence">Justificatif de compétence</option><option value="reference">Référence professionnelle</option><option value="sample_report">Rapport anonymisé</option><option value="authorization">Autorisation spécifique</option><option value="diploma">Diplôme / qualification intervenant</option><option value="other">Autre document</option></select></label>
              <label>Valide jusqu’au (si applicable)<input type="date" value={document.expires_at} onChange={(event) => setFiles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, expires_at: event.target.value } : item))} /></label>
            </div>)}
          </div>
          if (type === 'select') return <label key={field.key} className="wide">{field.label} <span aria-hidden="true">*</span><select required value={values[field.key]} onChange={(event) => updateValue(field.key, event.target.value)} disabled={busy}><option value="">Sélectionner une réponse</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          if (type === 'textarea') return <label key={field.key} className="wide">{field.label} <span aria-hidden="true">*</span><textarea required value={values[field.key]} onChange={(event) => updateValue(field.key, event.target.value)} rows={field.rows || 3} disabled={busy} /></label>
          return <label key={field.key} className={type === 'date' || type === 'number' ? '' : ''}>{field.label} <span aria-hidden="true">*</span><input required type={type} min={type === 'number' ? '0' : undefined} value={values[field.key]} onChange={(event) => updateValue(field.key, event.target.value)} disabled={busy} /></label>
        })}
        {mode === 'application' && step === sections.length - 1 && <label>Mot de passe du compte *<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /><small>Le compte restera en attente jusqu’à validation de la candidature.</small></label>}
        {mode === 'admin' && step === sections.length - 1 && <p className="partner-form-notice wide">La section « Réservé à Scope-Verify » est interne. Son statut détermine le statut initial de la fiche partenaire.</p>}
        {step === 11 && <p className="partner-form-notice wide">Les justificatifs sont confidentiels. Les champs « Non applicable » ou « À fournir » doivent correspondre à la situation du partenaire et du pays concerné.</p>}
      </fieldset>
      {error && !error.includes('Sélectionnez au moins une réponse') && <p className="partner-form-error" role="alert">{error}</p>}
      <p className="partner-form-count">{fieldCount} informations obligatoires, plus les justificatifs requis.</p>
      <div className="partner-form-actions">
        {onCancel && <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Annuler</button>}
        {step > 0 && <button type="button" className="secondary" onClick={() => { setError(''); setStep((current) => current - 1) }} disabled={busy}>Précédent</button>}
        {step < formSections.length - 1 ? <button type="button" onClick={goNext} disabled={busy}>Continuer</button> : <button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : mode === 'application' ? 'Envoyer ma candidature' : 'Créer la fiche'}</button>}
        {mode === 'application' && <button type="button" className="secondary" onClick={() => {
          if (!window.confirm('Effacer les réponses enregistrées dans cet onglet ?')) return
          window.sessionStorage.removeItem(partnerApplicationDraftKey)
          setValues(emptyValues('application'))
          setStep(0)
          setFiles([])
          setPassword('')
          setError('')
          formRef.current?.reset()
        }} disabled={busy}>Effacer la progression</button>}
      </div>
    </form>
  )
}
