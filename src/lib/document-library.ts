import { supabase } from '../supabase'

export const DOCUMENT_LIBRARY_BUCKET = 'document-library'
export const DOCUMENT_LIBRARY_MAX_FILE_SIZE = 3 * 1024 * 1024

export const DOCUMENT_LIBRARY_MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
} as const

export type DocumentLibraryMimeType = typeof DOCUMENT_LIBRARY_MIME_TYPES[keyof typeof DOCUMENT_LIBRARY_MIME_TYPES]
export type DocumentLibraryStatus = 'draft' | 'published' | 'archived'
export type DocumentLibraryKind = 'downloadable' | 'generated_template' | 'digital_form' | 'reference'
export type DocumentLibraryAudience = 'public' | 'authenticated' | 'admin'

export interface DocumentLibraryCategory {
  id: string
  key: string
  name: string
  sort_order: number
  is_active: boolean
}

export interface DocumentLibraryVersion {
  id: string
  document_id: string
  version_number: number
  file_name: string
  storage_bucket: 'document-library' | 'legal-documents'
  storage_path: string
  mime_type: DocumentLibraryMimeType
  file_size: number | null
  sha256: string | null
  uploaded_by: string | null
  created_at: string
}

export interface DocumentLibraryUsage {
  id: string
  document_id: string
  consumer_type: string
  consumer_key: string
  label: string
  version_id: string | null
  created_at: string
}

export interface DocumentLibraryDocument {
  id: string
  key: string
  category_id: string
  title: string
  description: string
  kind: DocumentLibraryKind
  audience: DocumentLibraryAudience
  status: DocumentLibraryStatus
  published_version_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  category?: DocumentLibraryCategory
  published_version?: DocumentLibraryVersion | null
  versions?: DocumentLibraryVersion[]
  usages?: DocumentLibraryUsage[]
}

export interface ResolvedDocumentLibraryDocument {
  id: string
  key: string
  category_id: string
  title: string
  description: string
  kind: DocumentLibraryKind
  version_id: string
  version_number: number
  file_name: string
  mime_type: DocumentLibraryMimeType
  file_size: number | null
  url: string
  expires_in: number
}

export async function resolvePublishedDocument(
  lookup: { key: string } | { category: string },
): Promise<ResolvedDocumentLibraryDocument | ResolvedDocumentLibraryDocument[]> {
  const params = new URLSearchParams(lookup)
  const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
  const response = await fetch(`/api/document-library?${params.toString()}`, {
    headers: sessionData.session?.access_token
      ? { Authorization: `Bearer ${sessionData.session.access_token}` }
      : undefined,
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error || 'Impossible de récupérer le document publié')
  return 'key' in lookup
    ? payload as ResolvedDocumentLibraryDocument
    : payload.documents as ResolvedDocumentLibraryDocument[]
}

export function validateDocumentLibraryFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  const expectedMimeType = DOCUMENT_LIBRARY_MIME_TYPES[extension as keyof typeof DOCUMENT_LIBRARY_MIME_TYPES]

  if (!expectedMimeType) return 'Format non pris en charge. Utilisez PDF, DOCX, XLSX, JPEG, PNG ou WebP.'
  if (file.type !== expectedMimeType) return 'Le type MIME déclaré ne correspond pas à l’extension du fichier.'
  if (file.size <= 0 || file.size > DOCUMENT_LIBRARY_MAX_FILE_SIZE) return 'Le fichier doit peser au maximum 3 Mo.'
  return null
}