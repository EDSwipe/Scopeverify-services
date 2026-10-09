import { useEffect, useState } from 'react'
import { resolvePublishedDocument } from '../lib/document-library'
import type { ResolvedDocumentLibraryDocument } from '../lib/document-library'
import './PublishedDocumentLinks.css'

interface PublishedDocumentLinksProps {
  categoryKey?: string
  allVisible?: boolean
  publicOnly?: boolean
  title: string
  language?: 'fr' | 'en'
}

export default function PublishedDocumentLinks({ categoryKey, allVisible = false, publicOnly = false, title, language = 'fr' }: PublishedDocumentLinksProps) {
  const [documents, setDocuments] = useState<ResolvedDocumentLibraryDocument[]>([])
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      const lookup = allVisible
        ? { all: true as const, ...(publicOnly ? { audience: 'public' as const } : {}) }
        : categoryKey ? { category: categoryKey } : null
      if (!lookup) {
        setUnavailable(true)
        return
      }
      void resolvePublishedDocument(lookup)
        .then((result) => {
          if (active) setDocuments(Array.isArray(result) ? result : [result])
        })
        .catch(() => {
          if (active) setUnavailable(true)
        })
    })
    return () => { active = false }
  }, [allVisible, categoryKey, publicOnly])

  if (documents.length === 0 && !unavailable) return null

  return <aside className="published-document-links" aria-label={title}>
    <h3>{title}</h3>
    {documents.length > 0 ? <ul>
      {documents.map((document) => <li key={document.id}>
        <a href={document.url} target="_blank" rel="noopener noreferrer">
          <strong>{document.title}</strong>
          <span>{allVisible ? `${document.category_name} · ` : ''}{document.file_name} · v{document.version_number}</span>
        </a>
      </li>)}
    </ul> : <p role="status">
      {language === 'fr' ? 'Documents momentanément indisponibles.' : 'Documents are temporarily unavailable.'}
    </p>}
  </aside>
}