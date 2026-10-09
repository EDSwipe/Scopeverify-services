import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase'
import { getErrorMessage } from '../../lib/errors'
import type { ModeratorPermission } from '../../types'
import PartnerQualificationForm from './PartnerQualificationForm'
import './PartnerManagement.css'

type PartnerStatus = 'pending' | 'to_qualify' | 'under_review' | 'referenced' | 'network' | 'rejected' | 'suspended'
type PartnerProfile = {
  id: string
  user_id: string | null
  business_name: string
  contact_email: string
  contact_name: string
  qualification_data: Record<string, string>
  status: PartnerStatus
  internal_notes: string
  public_name: string | null
  public_summary: string | null
  public_domains: string[]
  public_country: string | null
  public_area: string | null
  public_website: string | null
  public_logo_path: string | null
  is_public: boolean
  created_at: string
}
type PartnerDocument = { id: string; partner_profile_id: string; file_path: string; file_name: string; document_type: string; expires_at: string | null; uploaded_at: string }
type PartnerHistory = { id: string; partner_profile_id: string; event: string; details: string; created_at: string }
type PartnerMission = { id: string; partner_profile_id: string; title: string; status: string }

const statuses: { value: PartnerStatus; label: string }[] = [
  { value: 'pending', label: 'En attente de validation' }, { value: 'to_qualify', label: 'À qualifier' },
  { value: 'under_review', label: 'En cours de vérification' }, { value: 'referenced', label: 'Référencé' },
  { value: 'network', label: 'Réseau Scope-Verify' }, { value: 'rejected', label: 'Non retenu' },
  { value: 'suspended', label: 'Suspendu' },
]
const qualificationLabels: Record<string, string> = {
  business_name: 'Dénomination sociale', trade_name: 'Nom commercial', legal_form: 'Forme juridique',
  country: 'Pays', city: 'Ville / siège', address: 'Adresse du siège', website: 'Site internet',
  registration_number: 'Identifiant légal / registre', company_created_at: 'Date de création',
  contact_name: 'Nom et prénom du responsable', contact_title: 'Fonction', contact_phone: 'Téléphone',
  contact_email: 'E-mail professionnel', mission_contact: 'Référent missions Scope-Verify',
  domains: 'Domaines de compétence', domains_other: 'Autres domaines', services: 'Compétences et prestations',
  mission_types: 'Types de missions', scope_limits: 'Limites ou exclusions',
  qualification_type: 'Qualification : type', qualification_issuer: 'Organisme délivrant',
  qualification_reference: 'Référence / numéro', qualification_scope: 'Périmètre / portée',
  qualification_validity: 'Validité de la qualification', other_qualifications: 'Autres qualifications / agréments / accréditations',
  insurance_provider: 'Assureur RC professionnelle', insurance_policy: 'N° de contrat',
  insurance_validity: 'Validité de l’assurance', insurance_coverage: 'Activités couvertes',
  insurance_attestation: 'Attestation d’assurance jointe', other_insurances: 'Autres assurances',
  experience_years: 'Années d’expérience', sectors: 'Secteurs d’intervention',
  reference_1: 'Référence professionnelle 1', reference_2: 'Référence professionnelle 2',
  reference_3: 'Référence professionnelle 3', similar_missions: 'Missions similaires',
  coverage_levels: 'Niveaux de couverture', coverage: 'Villes / régions couvertes', outside_area: 'Intervention hors zone habituelle',
  lead_time: 'Délai de mobilisation', occasional_missions: 'Missions ponctuelles', languages: 'Langues de travail',
  written_report: 'Rapport écrit', report_lead_time: 'Délai de remise du rapport', deliverables: 'Types de livrables',
  deliverables_other: 'Autres livrables', sample_report_available: 'Exemple de livrable disponible',
  billing_method: 'Mode de facturation', billing_other: 'Autre mode de facturation', commercial_terms: 'Tarifs indicatifs',
  travel_expenses: 'Frais de déplacement', payment_terms: 'Conditions de paiement', special_conditions: 'Conditions particulières',
  accept_qualified_missions: 'Réception de missions qualifiées', independent_network_member: 'Intervention indépendante au sein du réseau',
  collaboration_conditions: 'Conditions de collaboration',
  registration_document_status: 'Immatriculation / registre légal', company_identity_document_status: 'Identification de l’entreprise',
  insurance_document_status: 'Attestation RC professionnelle', approval_document_status: 'Agréments',
  accreditation_document_status: 'Accréditations', qualification_document_status: 'Certifications / qualifications professionnelles',
  competence_evidence_status: 'Justificatifs de compétences', references_document_status: 'Références jointes',
  sample_report_document_status: 'Rapport anonymisé joint', specific_authorizations_status: 'Autorisations spécifiques',
  staff_diplomas_status: 'Diplômes des intervenants', other_documents_status: 'Autres documents',
  other_documents_description: 'Détail des autres documents', declaration_name: 'Signataire : nom',
  declaration_title: 'Signataire : fonction', declaration_date: 'Date de déclaration',
  declaration_confirmed: 'Confirmations du responsable', declaration_signature: 'Signature saisie',
  review_received_date: 'Date de réception', review_legal_identity: 'Contrôle identité juridique',
  review_competences: 'Contrôle des compétences', review_qualifications: 'Contrôle des qualifications',
  review_insurance: 'Contrôle des assurances', review_references: 'Contrôle des références',
  review_coverage: 'Contrôle de la zone', review_commercial_terms: 'Contrôle des conditions commerciales',
  review_deliverables: 'Contrôle de la qualité des livrables', review_additional_checks: 'Vérifications complémentaires',
  review_interview_date: 'Date d’entretien', review_evaluator: 'Évaluateur Scope-Verify', review_status: 'Statut de qualification',
  review_comments: 'Commentaires / réserves', review_next_date: 'Prochaine réévaluation',
  review_validation_name: 'Validateur : nom', review_validation_title: 'Validateur : fonction',
  review_validation_date: 'Date de validation', review_validation_signature: 'Signature Scope-Verify',
}
const qualificationValueLabels: Record<string, string> = {
  yes: 'Oui', no: 'Non', attached: 'Joint à la candidature', to_provide: 'À fournir', not_applicable: 'Non applicable',
  under_24h: '< 24 h', '24_48h': '24–48 h', '2_5_days': '2–5 jours', over_5_days: '> 5 jours',
  mission_dependent: 'À définir selon la mission', fixed_fee: 'Forfait', hourly: 'Taux horaire', quote: 'Selon devis',
  other: 'Autre',
  to_qualify: 'À qualifier', under_review: 'En cours de vérification', referenced: 'Référencé', network: 'Réseau Scope-Verify', rejected: 'Non retenu', suspended: 'Suspendu',
}
const formatQualificationValue = (value: string) => value.split('||').map((part) => qualificationValueLabels[part] || part).join(', ')

export default function PartnerManagement({ adminId, moderatorOnly = false, permissions = [] }: { adminId: string; moderatorOnly?: boolean; permissions?: ModeratorPermission[] }) {
  const [partners, setPartners] = useState<PartnerProfile[]>([])
  const [documents, setDocuments] = useState<PartnerDocument[]>([])
  const [history, setHistory] = useState<PartnerHistory[]>([])
  const [missions, setMissions] = useState<PartnerMission[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [qualificationFilter, setQualificationFilter] = useState('')
  const [documentFilter, setDocumentFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [documentUrl, setDocumentUrl] = useState('')

  const loadData = useCallback(async () => {
    if (!supabase) return
    try {
      const [partnerResult, documentResult, historyResult] = await Promise.all([
        supabase.from('partner_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('partner_documents').select('*').order('uploaded_at', { ascending: false }),
        supabase.from('partner_history').select('*').order('created_at', { ascending: false }),
      ])
      if (partnerResult.error) throw partnerResult.error
      if (documentResult.error) throw documentResult.error
      if (historyResult.error) throw historyResult.error
      setPartners((partnerResult.data || []) as PartnerProfile[])
      setDocuments((documentResult.data || []) as PartnerDocument[])
      setHistory((historyResult.data || []) as PartnerHistory[])
      if (!moderatorOnly) {
        const { data, error: missionError } = await supabase.from('missions').select('id,partner_profile_id,title,status').not('partner_profile_id', 'is', null)
        if (missionError) throw missionError
        setMissions((data || []) as PartnerMission[])
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'Chargement des partenaires impossible.')
    } finally {
      setLoading(false)
    }
  }, [moderatorOnly])

  useEffect(() => { void Promise.resolve().then(() => loadData()) }, [loadData])

  const selected = partners.find((partner) => partner.id === selectedId) ?? null
  const canReview = !moderatorOnly || permissions.includes('partners.review')
  const canManageDocuments = !moderatorOnly || permissions.includes('partners.documents')
  const filteredPartners = useMemo(() => partners.filter((partner) => {
    const searchText = `${partner.business_name} ${partner.contact_name} ${partner.contact_email} ${JSON.stringify(partner.qualification_data)}`.toLocaleLowerCase()
    const terms = search.trim().toLocaleLowerCase()
    const data = partner.qualification_data || {}
    const partnerDocuments = documents.filter((document) => document.partner_profile_id === partner.id)
    const today = new Date().toISOString().slice(0, 10)
    const documentsMatch = !documentFilter
      || (documentFilter === 'missing' && partnerDocuments.length === 0)
      || (documentFilter === 'expired' && partnerDocuments.some((document) => document.expires_at && document.expires_at < today))
      || (documentFilter === 'valid' && partnerDocuments.length > 0 && partnerDocuments.every((document) => !document.expires_at || document.expires_at >= today))
      || (documentFilter === 'no-date' && partnerDocuments.some((document) => !document.expires_at))
    return (!terms || searchText.includes(terms))
      && (!statusFilter || partner.status === statusFilter)
      && (!countryFilter || data.country?.toLocaleLowerCase().includes(countryFilter.toLocaleLowerCase()))
      && (!domainFilter || data.domains?.toLocaleLowerCase().includes(domainFilter.toLocaleLowerCase()))
      && (!cityFilter || `${data.city || ''} ${data.coverage || ''}`.toLocaleLowerCase().includes(cityFilter.toLocaleLowerCase()))
      && (!qualificationFilter || `${data.qualifications || ''} ${data.approvals || ''} ${data.certifications_validity || ''}`.toLocaleLowerCase().includes(qualificationFilter.toLocaleLowerCase()))
      && documentsMatch
  }), [partners, documents, search, statusFilter, countryFilter, cityFilter, domainFilter, qualificationFilter, documentFilter])

  const updatePartner = async (updates: Partial<PartnerProfile>, event: string, details: string) => {
    if (!supabase || !selected) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { error: updateError } = await supabase.from('partner_profiles').update(updates).eq('id', selected.id)
      if (updateError) throw updateError
      await supabase.from('partner_history').insert({ partner_profile_id: selected.id, event, details, created_by: adminId })
      setNotice('Fiche mise à jour.')
      await loadData()
    } catch (err) {
      setError(getErrorMessage(err) || 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (status: PartnerStatus) => {
    if (!selected || status === selected.status) return
    const label = statuses.find((item) => item.value === status)?.label || status
    await updatePartner({ status }, 'status_changed', `Statut : ${label}`)
  }

  const savePublicProfile = async () => {
    if (!selected) return
    let logoPath = selected.public_logo_path
    if (logoFile && supabase) {
      const path = `${selected.id}/${Date.now()}-${crypto.randomUUID()}-${logoFile.name}`
      const { error: uploadError } = await supabase.storage.from('partner-public-assets').upload(path, logoFile, { upsert: true })
      if (uploadError) { setError(getErrorMessage(uploadError)); return }
      logoPath = path
    }
    await updatePartner({
      public_name: selected.public_name || selected.business_name,
      public_summary: selected.public_summary,
      public_domains: selected.public_domains,
      public_country: selected.public_country,
      public_area: selected.public_area,
      public_website: selected.public_website,
      public_logo_path: logoPath,
      is_public: selected.is_public && selected.status === 'network',
    }, 'public_profile_updated', 'Présentation publique modifiée')
    setLogoFile(null)
  }

  const openDocument = async (filePath: string) => {
    if (!supabase) return
    const { data, error: urlError } = await supabase.storage.from('partner-documents').createSignedUrl(filePath, 3600)
    if (urlError) { setError(getErrorMessage(urlError)); return }
    setDocumentUrl(data.signedUrl)
  }

  const saveDocumentExpiry = async (document: PartnerDocument) => {
    if (!supabase) return
    const { error: updateError } = await supabase.from('partner_documents').update({ expires_at: document.expires_at }).eq('id', document.id)
    if (updateError) { setError(getErrorMessage(updateError)); return }
    await supabase.from('partner_history').insert({ partner_profile_id: document.partner_profile_id, event: 'document_validity_updated', details: `Validité mise à jour : ${document.file_name}`, created_by: adminId })
    setNotice('Validité du document enregistrée.')
    await loadData()
  }

  if (loading) return <div className="partner-management-loading">Chargement des partenaires…</div>

  return <section className="partner-management">
    <header className="partner-management-header"><div><p className="partner-form-kicker">SCOPE-VERIFY · RÉSEAU</p><h1>{moderatorOnly ? 'Validation des candidatures' : 'Partenaires'}</h1></div>
      {!moderatorOnly && <button className="pm-primary" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Fermer' : '+ Ajouter une fiche'}</button>}
    </header>
    {showCreate && <div className="pm-create-panel"><PartnerQualificationForm mode="admin" createdBy={adminId} onComplete={() => { setShowCreate(false); void loadData() }} onCancel={() => setShowCreate(false)} /></div>}
    {error && <p className="pm-error" role="alert">{error}</p>}{notice && <p className="pm-notice" role="status">{notice}</p>}
    <div className="pm-layout">
      <div className="pm-list-panel">
        <div className="pm-filters">
          <label>Recherche<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Entreprise, personne, compétence…" /></label>
          <label>Statut<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tous les statuts</option>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <label>Pays<input value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} placeholder="Pays" /></label>
          <label>Ville / zone<input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="Ville ou zone" /></label>
          <label>Domaine<input value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)} placeholder="Compétence" /></label>
          <label>Qualifications<input value={qualificationFilter} onChange={(event) => setQualificationFilter(event.target.value)} placeholder="Qualification / agrément" /></label>
          <label>Documents<select value={documentFilter} onChange={(event) => setDocumentFilter(event.target.value)}><option value="">Toutes les validités</option><option value="valid">Documents valides</option><option value="expired">Documents expirés</option><option value="no-date">Date à renseigner</option><option value="missing">Sans document</option></select></label>
        </div>
        <p className="pm-count">{filteredPartners.length} partenaire(s)</p>
        <ul className="pm-partner-list">{filteredPartners.map((partner) => <li key={partner.id}>
          <button className={selectedId === partner.id ? 'selected' : ''} onClick={() => { setSelectedId(partner.id); setDocumentUrl('') }}>
            <strong>{partner.business_name}</strong><span>{partner.qualification_data?.country} · {partner.qualification_data?.city}</span>
            <small>{statuses.find((status) => status.value === partner.status)?.label}</small>
          </button>
        </li>)}</ul>
      </div>
      {selected ? <article className="pm-detail">
        <div className="pm-detail-title"><div><p className="partner-form-kicker">{selected.contact_email}</p><h2>{selected.business_name}</h2><p>{selected.contact_name} · {selected.qualification_data?.contact_phone}</p></div><select aria-label="Statut du partenaire" value={selected.status} disabled={saving || !canReview} onChange={(event) => void changeStatus(event.target.value as PartnerStatus)}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div>
        <div className="pm-facts"><div><span>Compétences</span><strong>{formatQualificationValue(selected.qualification_data?.domains || '')}</strong></div><div><span>Pays / zone</span><strong>{selected.qualification_data?.country} · {formatQualificationValue(selected.qualification_data?.coverage_levels || '')} · {selected.qualification_data?.coverage}</strong></div><div><span>Qualifications</span><strong>{selected.qualification_data?.qualification_type} · {selected.qualification_data?.qualification_issuer} · {selected.qualification_data?.qualification_reference} · {selected.qualification_data?.qualification_validity}</strong></div><div><span>Assurances</span><strong>{selected.qualification_data?.insurance_provider} · {selected.qualification_data?.insurance_validity}</strong></div><div><span>Délais et capacité</span><strong>{formatQualificationValue(selected.qualification_data?.lead_time || '')} · {selected.qualification_data?.languages} · {selected.qualification_data?.report_lead_time}</strong></div><div><span>Conditions commerciales</span><strong>{formatQualificationValue(selected.qualification_data?.billing_method || '')} · {selected.qualification_data?.commercial_terms} · {selected.qualification_data?.payment_terms}</strong></div></div>
        <details className="pm-qualification-full"><summary>Fiche de qualification complète ({Object.keys(selected.qualification_data || {}).length} champs)</summary><dl>{Object.entries(selected.qualification_data || {}).map(([key, value]) => <div key={key}><dt>{qualificationLabels[key] || key.replaceAll('_', ' ')}</dt><dd>{formatQualificationValue(value)}</dd></div>)}</dl></details>
        <section className="pm-subsection"><h3>Documents justificatifs</h3>{documents.filter((document) => document.partner_profile_id === selected.id).length ? <ul className="pm-documents">{documents.filter((document) => document.partner_profile_id === selected.id).map((document) => {
          const expired = document.expires_at && new Date(document.expires_at) < new Date()
          return <li key={document.id}><div><button onClick={() => void openDocument(document.file_path)}>{document.file_name}</button><span className={expired ? 'expired' : ''}>{document.expires_at ? `Valide jusqu’au ${new Date(document.expires_at).toLocaleDateString('fr-FR')}${expired ? ' · expiré' : ''}` : 'Date non renseignée'}</span></div><label>Validité<input type="date" value={document.expires_at || ''} disabled={!canManageDocuments} onChange={(event) => setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, expires_at: event.target.value || null } : item))} /></label><button className="pm-secondary" disabled={!canManageDocuments} onClick={() => void saveDocumentExpiry(document)}>Enregistrer</button></li>
        })}</ul> : <p>Aucun document transmis.</p>}{documentUrl && <a href={documentUrl} target="_blank" rel="noreferrer">Ouvrir le justificatif sélectionné ↗</a>}</section>
        <section className="pm-subsection"><label className="pm-notes-label">Notes internes<textarea value={selected.internal_notes} disabled={!canReview} onChange={(event) => setPartners((current) => current.map((partner) => partner.id === selected.id ? { ...partner, internal_notes: event.target.value } : partner))} rows={3} /></label><button className="pm-secondary" disabled={saving || !canReview} onClick={() => void updatePartner({ internal_notes: selected.internal_notes }, 'internal_note', 'Note interne mise à jour')}>Enregistrer les notes</button></section>
        {!moderatorOnly && <section className="pm-subsection pm-public"><div className="pm-public-heading"><div><h3>Présentation publique</h3><p>Seuls les profils « Réseau Scope-Verify » activés sont visibles.</p></div><label className="pm-toggle"><input type="checkbox" checked={selected.is_public} disabled={selected.status !== 'network'} onChange={(event) => setPartners((current) => current.map((partner) => partner.id === selected.id ? { ...partner, is_public: event.target.checked } : partner))} /> Afficher</label></div>
          <div className="pm-public-fields"><label>Nom public<input value={selected.public_name || ''} onChange={(event) => setPartners((current) => current.map((partner) => partner.id === selected.id ? { ...partner, public_name: event.target.value } : partner))} /></label><label>Site internet<input type="url" value={selected.public_website || ''} onChange={(event) => setPartners((current) => current.map((partner) => partner.id === selected.id ? { ...partner, public_website: event.target.value } : partner))} /></label><label className="wide">Présentation courte<textarea rows={2} value={selected.public_summary || ''} onChange={(event) => setPartners((current) => current.map((partner) => partner.id === selected.id ? { ...partner, public_summary: event.target.value } : partner))} /></label><label>Domaines publics<input value={selected.public_domains.join(', ')} onChange={(event) => setPartners((current) => current.map((partner) => partner.id === selected.id ? { ...partner, public_domains: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) } : partner))} /></label><label>Pays<input value={selected.public_country || ''} onChange={(event) => setPartners((current) => current.map((partner) => partner.id === selected.id ? { ...partner, public_country: event.target.value } : partner))} /></label><label>Ville / zone<input value={selected.public_area || ''} onChange={(event) => setPartners((current) => current.map((partner) => partner.id === selected.id ? { ...partner, public_area: event.target.value } : partner))} /></label><label>Logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} /></label></div><button className="pm-primary" disabled={saving || selected.status !== 'network'} onClick={() => void savePublicProfile()}>Enregistrer la présentation</button>
        </section>}
        <section className="pm-subsection"><h3>Historique</h3><ul className="pm-history">{history.filter((item) => item.partner_profile_id === selected.id).map((item) => <li key={item.id}><span>{new Date(item.created_at).toLocaleDateString('fr-FR')}</span><strong>{item.details || item.event}</strong></li>)}</ul></section>
        {!moderatorOnly && <section className="pm-subsection"><h3>Missions réalisées / affectées</h3>{missions.filter((mission) => mission.partner_profile_id === selected.id).length ? <ul className="pm-history">{missions.filter((mission) => mission.partner_profile_id === selected.id).map((mission) => <li key={mission.id}><strong>{mission.title}</strong><span>{mission.status}</span></li>)}</ul> : <p>Aucune mission enregistrée.</p>}</section>}
      </article> : <div className="pm-empty">Sélectionnez un partenaire pour consulter sa fiche.</div>}
    </div>
  </section>
}
