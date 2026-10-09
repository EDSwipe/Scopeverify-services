import { describe, expect, it } from 'vitest'
import {
  defaultGeographicCoverage,
  geographicCoverageContentSeed,
  parseGeographicCoverage,
} from './geographic-coverage'

describe('geographic coverage configuration', () => {
  it('preselects the requested client countries', () => {
    expect(defaultGeographicCoverage.clientCountryIds).toEqual([
      '056', '442', '528', '276', '756', '250', '380', '724', '124', '840', '156',
    ])
  })

  it('falls back safely and filters unsupported ids', () => {
    expect(parseGeographicCoverage('{')).toEqual(defaultGeographicCoverage)
    expect(parseGeographicCoverage(JSON.stringify({
      interventionCountryIds: ['250', 'unknown', '250'],
      clientCountryIds: [],
      officeCountryIds: ['504'],
    }))).toEqual({
      interventionCountryIds: ['250'],
      clientCountryIds: [],
      officeCountryIds: ['504'],
    })
  })

  it('stores the default configuration in the existing CMS section', () => {
    expect(geographicCoverageContentSeed.section).toBe('geographic')
    expect(JSON.parse(geographicCoverageContentSeed.content)).toEqual(defaultGeographicCoverage)
  })
})