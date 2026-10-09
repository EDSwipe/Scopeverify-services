import { describe, expect, it } from 'vitest'
import { parsePartnerLogo } from './partner-logos'

describe('parsePartnerLogo', () => {
  it('parses a valid CMS logo entry', () => {
    const result = parsePartnerLogo({
      section: 'partner_logos',
      key: 'logo-1',
      content: JSON.stringify({ name: 'Example Ltd', website: 'https://example.com', logo_path: 'managed/logo.png' }),
    })

    expect(result).toEqual({ id: 'logo-1', name: 'Example Ltd', website: 'https://example.com', logo_path: 'managed/logo.png' })
  })

  it('rejects malformed, incomplete, or unrelated entries', () => {
    expect(parsePartnerLogo({ section: 'partner_logos', key: 'bad', content: '{' })).toBeNull()
    expect(parsePartnerLogo({ section: 'partner_logos', key: 'empty', content: '{}' })).toBeNull()
    expect(parsePartnerLogo({ section: 'testimonials', key: 'other', content: '{}' })).toBeNull()
  })
})