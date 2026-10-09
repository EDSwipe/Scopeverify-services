import { describe, expect, it } from 'vitest'
import { parseTestimonial } from './testimonials'

describe('parseTestimonial', () => {
  it('parses a valid CMS testimonial entry', () => {
    const result = parseTestimonial({
      section: 'testimonials',
      key: 'experience-1',
      content: JSON.stringify({
        name: 'Alex Martin',
        organization: 'Example Ltd',
        role: 'Purchasing Director',
        quote_fr: 'Un retour réel.',
        quote_en: 'A real testimonial.',
        consent_confirmed: true,
        is_published: true,
      }),
    })

    expect(result?.id).toBe('experience-1')
    expect(result?.is_published).toBe(true)
  })

  it('rejects malformed or incomplete entries', () => {
    expect(parseTestimonial({ section: 'testimonials', key: 'bad', content: '{' })).toBeNull()
    expect(parseTestimonial({ section: 'testimonials', key: 'empty', content: '{}' })).toBeNull()
    expect(parseTestimonial({ section: 'hero', key: 'other', content: '{}' })).toBeNull()
  })
})