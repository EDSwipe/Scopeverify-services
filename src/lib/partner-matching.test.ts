import { describe, expect, it } from 'vitest'
import { recommendPartnersForMission } from './partner-matching'
import type { Mission } from '../types'

const mission: Mission = {
  id: 'mission-1',
  client_id: 'client-1',
  title: 'Visite et contrôle fournisseur',
  description: 'Vérifier la production et la conformité des équipements à Lyon.',
  mission_type: 'supplier_visit',
  location: 'Lyon, France',
  status: 'submitted',
  requirements: { checklist: ['Visiter les locaux de production', 'Contrôler les documents qualité'] },
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
}

const partner = (overrides: Partial<Parameters<typeof recommendPartnersForMission>[1][number]> = {}) => ({
  id: 'partner-1',
  user_id: 'user-1',
  business_name: 'Partenaire industrie Lyon',
  status: 'network',
  qualification_data: {
    country: 'France',
    city: 'Lyon',
    coverage: 'Auvergne-Rhône-Alpes',
    domains: 'supplier_visit||inspection qualité||production industrielle',
    mission_types: 'supplier_visit||verification',
    qualification_type: 'Certification qualité industrielle',
    qualification_scope: 'Contrôle qualité production équipement',
    insurance_validity: '2027-12-31',
    accept_qualified_missions: 'yes',
    lead_time: '24_48h',
  },
  ...overrides,
})

describe('recommendPartnersForMission', () => {
  it('ranks a qualified partner by domain, location, qualifications, and readiness', () => {
    const result = recommendPartnersForMission(mission, [partner()], new Set(['user-1']), [], new Date('2026-10-04T00:00:00.000Z'))

    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0].partner.id).toBe('partner-1')
    expect(result.recommendations[0].score).toBeGreaterThan(50)
    expect(result.recommendations[0].criteria.map((criterion) => criterion.maximum)).toEqual([40, 25, 20, 15])
  })

  it('excludes inactive, unqualified, and explicitly unavailable partner profiles', () => {
    const pending = partner({ id: 'pending', status: 'pending' })
    const inactive = partner({ id: 'inactive', user_id: 'inactive-user' })
    const unavailable = partner({ id: 'unavailable', qualification_data: { accept_qualified_missions: 'no' } })
    const result = recommendPartnersForMission(mission, [pending, inactive, unavailable], new Set(['user-1']), [], new Date('2026-10-04T00:00:00.000Z'))

    expect(result.recommendations).toHaveLength(0)
    expect(result.excludedCount).toBe(3)
  })

  it('excludes profiles with an expired insurance document', () => {
    const result = recommendPartnersForMission(
      mission,
      [partner()],
      new Set(['user-1']),
      [{ partner_profile_id: 'partner-1', document_type: 'insurance', expires_at: '2026-01-01' }],
      new Date('2026-10-04T00:00:00.000Z'),
    )

    expect(result.recommendations).toHaveLength(0)
    expect(result.excludedCount).toBe(1)
  })
})