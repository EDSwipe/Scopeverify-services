export interface PartnerLogo {
  id: string
  name: string
  website: string
  logo_path: string
}

export type PartnerLogoDraft = Omit<PartnerLogo, 'id'>

interface PartnerLogoContentRow {
  section: string
  key: string
  content: string
}

export function parsePartnerLogo(row: PartnerLogoContentRow): PartnerLogo | null {
  if (row.section !== 'partner_logos') return null

  try {
    const value: unknown = JSON.parse(row.content)
    if (!value || typeof value !== 'object') return null

    const entry = value as Partial<PartnerLogoDraft>
    if (
      typeof entry.name !== 'string' || !entry.name.trim() ||
      typeof entry.website !== 'string' ||
      typeof entry.logo_path !== 'string' || !entry.logo_path.trim()
    ) return null

    return { id: row.key, name: entry.name.trim(), website: entry.website.trim(), logo_path: entry.logo_path.trim() }
  } catch {
    return null
  }
}