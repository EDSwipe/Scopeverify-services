import type { Mission } from '../types'

export interface MatchingPartnerProfile {
  id: string
  user_id: string | null
  business_name: string
  status: string
  qualification_data: Record<string, string>
}

export interface MatchingPartnerDocument {
  partner_profile_id: string
  document_type: string
  expires_at: string | null
}

export interface PartnerMatchCriterion {
  label: string
  score: number
  maximum: number
  detail: string
}

export interface PartnerRecommendation {
  partner: MatchingPartnerProfile
  score: number
  criteria: PartnerMatchCriterion[]
  warnings: string[]
}

export interface PartnerRecommendationResult {
  recommendations: PartnerRecommendation[]
  excludedCount: number
}

const missionTypeSignals: Record<Mission['mission_type'], string[]> = {
  simple_visit: ['visite', 'inspection', 'constat', 'site', 'terrain'],
  verification: ['verification', 'controle', 'conformite', 'qualite', 'inspection'],
  supplier_visit: ['fournisseur', 'production', 'usine', 'fabrication', 'industrie'],
  technical_mission: ['technique', 'ingenierie', 'expertise', 'mesure', 'essai'],
  field_day: ['terrain', 'journee terrain', 'multi-site', 'inspection', 'visite'],
  custom: [],
}

const ignoredTerms = new Set([
  'avec', 'dans', 'pour', 'plus', 'moins', 'selon', 'cette', 'cela', 'faire', 'tous', 'toute', 'toutes',
  'mission', 'missions', 'verifier', 'verification', 'souhaite', 'souhaiter', 'besoin', 'besoins', 'lieu',
])
const criticalDocumentTypes = new Set(['insurance', 'approval', 'accreditation', 'qualification'])

const normalize = (value: string) => value
  .toLocaleLowerCase('fr')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const tokenize = (value: string) => new Set(
  normalize(value).split(/\s+/).filter((term) => term.length > 2 && !ignoredTerms.has(term)),
)

const qualificationValue = (data: Record<string, string>, keys: string[]) => keys
  .map((key) => data[key] || '')
  .join(' ')
  .replaceAll('||', ' ')

const matchingTerms = (source: string, terms: Iterable<string>) => {
  const normalizedSource = normalize(source)
  return [...new Set(terms)].filter((term) => normalizedSource.includes(normalize(term)))
}

const overlapRatio = (left: Set<string>, right: Set<string>) => {
  if (!left.size || !right.size) return 0
  let overlap = 0
  for (const term of left) if (right.has(term)) overlap += 1
  return overlap / Math.min(left.size, 6)
}

const parseIsoDate = (value: string | null | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function recommendPartnersForMission(
  mission: Mission,
  partners: MatchingPartnerProfile[],
  activeUserIds: Set<string>,
  documents: MatchingPartnerDocument[],
  today = new Date(),
): PartnerRecommendationResult {
  const requirements = mission.requirements || {}
  const checklist = Array.isArray(requirements.checklist)
    ? requirements.checklist.filter((item): item is string => typeof item === 'string')
    : []
  const missionDescription = [mission.title, mission.description || '', ...checklist].join(' ')
  const missionTerms = tokenize(missionDescription)
  const typeSignals = missionTypeSignals[mission.mission_type]
  const location = normalize(mission.location)
  const recommendations: PartnerRecommendation[] = []
  let excludedCount = 0

  for (const partner of partners) {
    const data = partner.qualification_data || {}
    const warnings: string[] = []
    const partnerDocuments = documents.filter((document) => document.partner_profile_id === partner.id)
    const expiredCriticalDocuments = partnerDocuments.filter((document) => {
      if (!criticalDocumentTypes.has(document.document_type)) return false
      const expiry = parseIsoDate(document.expires_at)
      return expiry !== null && expiry < today
    })
    const expiredInsurance = parseIsoDate(data.insurance_validity)
    const expiredQualification = parseIsoDate(data.qualification_validity)
    const hasExpiredQualification = expiredInsurance !== null && expiredInsurance < today
      || expiredQualification !== null && expiredQualification < today

    if (!partner.user_id || !activeUserIds.has(partner.user_id)) {
      excludedCount += 1
      continue
    }
    if (!['referenced', 'network'].includes(partner.status)) {
      excludedCount += 1
      continue
    }
    if (normalize(data.accept_qualified_missions || '') === 'no') {
      excludedCount += 1
      continue
    }
    if (expiredCriticalDocuments.length || hasExpiredQualification) {
      excludedCount += 1
      continue
    }

    const domainsAndServices = qualificationValue(data, ['domains', 'domains_other', 'services', 'mission_types', 'sectors'])
    const domainMatches = matchingTerms(domainsAndServices, typeSignals)
    const domainTokenOverlap = overlapRatio(tokenize(domainsAndServices), missionTerms)
    const domainScore = Math.min(40, domainMatches.length * 14 + (domainTokenOverlap ? 8 : 0))

    const partnerGeography = normalize([data.country, data.city, data.coverage, data.coverage_levels].filter(Boolean).join(' '))
    const locationTerms = tokenize(location)
    const geographyTerms = tokenize(partnerGeography)
    const locationOverlap = overlapRatio(locationTerms, geographyTerms)
    const locationScore = location && partnerGeography
      ? Math.round(25 * locationOverlap)
      : 0

    const qualificationText = qualificationValue(data, [
      'qualification_type', 'qualification_scope', 'other_qualifications', 'insurance_coverage',
      'approvals', 'certifications_validity', 'competence_evidence_status',
    ])
    const qualificationOverlap = overlapRatio(tokenize(qualificationText), missionTerms)
    const qualificationScore = Math.round(20 * qualificationOverlap)

    const readinessReasons: string[] = []
    let readinessScore = 0
    if (normalize(data.accept_qualified_missions || '') === 'yes') {
      readinessScore += 8
      readinessReasons.push('accepte les missions qualifiées')
    } else {
      warnings.push('acceptation des missions à confirmer')
    }
    if (data.lead_time) {
      readinessScore += 4
      readinessReasons.push(`mobilisation : ${data.lead_time.replaceAll('||', ', ')}`)
    } else {
      warnings.push('délai de mobilisation non renseigné')
    }
    readinessScore += 3
    if (partnerDocuments.some((document) => document.document_type === 'insurance' && document.expires_at)) {
      readinessReasons.push('assurance avec date de validité enregistrée')
    } else if (data.insurance_validity) {
      readinessReasons.push('validité d’assurance renseignée dans la fiche')
    } else {
      warnings.push('date de validité de l’assurance à vérifier')
    }

    const criteria = [
      { label: 'Domaine', score: domainScore, maximum: 40, detail: domainMatches.length ? `correspondance : ${domainMatches.slice(0, 3).join(', ')}` : 'correspondance partielle ou non détectée automatiquement' },
      { label: 'Zone', score: locationScore, maximum: 25, detail: locationOverlap ? 'zone de mission recoupée avec la couverture déclarée' : 'couverture à confirmer pour ce lieu' },
      { label: 'Qualifications', score: qualificationScore, maximum: 20, detail: qualificationOverlap ? 'termes des exigences présents dans la fiche' : 'correspondance à confirmer manuellement' },
      { label: 'Capacité', score: readinessScore, maximum: 15, detail: readinessReasons.join(' · ') || 'informations de disponibilité limitées' },
    ]
    recommendations.push({
      partner,
      score: criteria.reduce((total, criterion) => total + criterion.score, 0),
      criteria,
      warnings,
    })
  }

  recommendations.sort((left, right) => right.score - left.score || left.partner.business_name.localeCompare(right.partner.business_name, 'fr'))
  return { recommendations, excludedCount }
}