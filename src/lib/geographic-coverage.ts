export interface GeographicCountryOption {
  id: string
  name_fr: string
  name_en: string
}

export interface GeographicCoverageConfig {
  interventionCountryIds: string[]
  clientCountryIds: string[]
  officeCountryIds: string[]
}

export const geographicCountryOptions: GeographicCountryOption[] = [
  { id: '056', name_fr: 'Belgique', name_en: 'Belgium' },
  { id: '250', name_fr: 'France', name_en: 'France' },
  { id: '756', name_fr: 'Suisse', name_en: 'Switzerland' },
  { id: '504', name_fr: 'Maroc', name_en: 'Morocco' },
  { id: '012', name_fr: 'Algérie', name_en: 'Algeria' },
  { id: '788', name_fr: 'Tunisie', name_en: 'Tunisia' },
  { id: '384', name_fr: 'Côte d’Ivoire', name_en: 'Côte d’Ivoire' },
  { id: '442', name_fr: 'Luxembourg', name_en: 'Luxembourg' },
  { id: '528', name_fr: 'Pays-Bas', name_en: 'Netherlands' },
  { id: '276', name_fr: 'Allemagne', name_en: 'Germany' },
  { id: '380', name_fr: 'Italie', name_en: 'Italy' },
  { id: '724', name_fr: 'Espagne', name_en: 'Spain' },
  { id: '124', name_fr: 'Canada', name_en: 'Canada' },
  { id: '840', name_fr: 'États-Unis', name_en: 'United States' },
  { id: '156', name_fr: 'Chine', name_en: 'China' },
]

export const defaultGeographicCoverage: GeographicCoverageConfig = {
  interventionCountryIds: ['056', '250', '756', '504', '012', '788', '384'],
  clientCountryIds: ['056', '442', '528', '276', '756', '250', '380', '724', '124', '840', '156'],
  officeCountryIds: ['250', '504'],
}

export const geographicCoverageContentKey = 'coverage_configuration'

export function parseGeographicCoverage(content: string): GeographicCoverageConfig {
  try {
    const parsed: unknown = JSON.parse(content)
    if (!parsed || typeof parsed !== 'object') return defaultGeographicCoverage

    const value = parsed as Partial<GeographicCoverageConfig>
    const supportedIds = new Set(geographicCountryOptions.map((country) => country.id))
    const parseIds = (ids: unknown, fallback: string[]) => {
      if (!Array.isArray(ids)) return fallback
      return [...new Set(ids.filter((id): id is string => typeof id === 'string' && supportedIds.has(id)))]
    }

    return {
      interventionCountryIds: parseIds(value.interventionCountryIds, defaultGeographicCoverage.interventionCountryIds),
      clientCountryIds: parseIds(value.clientCountryIds, defaultGeographicCoverage.clientCountryIds),
      officeCountryIds: parseIds(value.officeCountryIds, defaultGeographicCoverage.officeCountryIds),
    }
  } catch {
    return defaultGeographicCoverage
  }
}

export const geographicCoverageContentSeed = {
  section: 'geographic',
  key: geographicCoverageContentKey,
  language: 'fr' as const,
  content: JSON.stringify(defaultGeographicCoverage),
}