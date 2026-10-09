export interface Testimonial {
  id: string
  name: string
  organization: string
  role: string
  quote_fr: string
  quote_en: string
  consent_confirmed: boolean
  is_published: boolean
}

export type TestimonialDraft = Omit<Testimonial, 'id'>

interface TestimonialContentRow {
  section: string
  key: string
  content: string
}

export function parseTestimonial(row: TestimonialContentRow): Testimonial | null {
  if (row.section !== 'testimonials') return null

  try {
    const value: unknown = JSON.parse(row.content)
    if (!value || typeof value !== 'object') return null

    const entry = value as Partial<TestimonialDraft>
    if (
      typeof entry.name !== 'string' ||
      typeof entry.organization !== 'string' ||
      typeof entry.role !== 'string' ||
      typeof entry.quote_fr !== 'string' ||
      typeof entry.quote_en !== 'string' ||
      typeof entry.consent_confirmed !== 'boolean' ||
      typeof entry.is_published !== 'boolean'
    ) return null

    return { ...entry, id: row.key } as Testimonial
  } catch {
    return null
  }
}