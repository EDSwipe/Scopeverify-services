import { useEffect, useState } from 'react'
import { resolvePublishedDocument } from '../lib/document-library'
import type { ResolvedDocumentLibraryDocument } from '../lib/document-library'
import './PublishedDocumentLinks.css'

interface PublishedDocumentLinksProps {
  categoryKey: string
  title: string
  language?: 'fr' | 'en'
}

export default function PublishedDocumentLinks({ categoryKey, title, language = 'fr' }: PublishedDocumentLinksProps) {
  const [documents, setDocuments] = useState<ResolvedDocumentLibraryDocument[]>([])
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      void resolvePublishedDocument({ category: categoryKey })
        .then((result) => {
          if (active) setDocuments(Array.isArray(result) ? result : [result])
        })
        .catch(() => {
          if (active) setUnavailable(true)
        })
    })
    return () => { active = false }
  }, [categoryKey])

  if (documents.length === 0 && !unavailable) return null

  return <aside className="published-document-links" aria-label={title}>
    <h3>{title}</h3>
    {documents.length > 0 ? <ul>
      {documents.map((document) => <li key={document.id}>
        <div>
          <strong>{document.title}</strong>
          <span>{document.file_name} · v{document.version_number}</span>
        </div>
        <a href={document.url} target="_blank" rel="noopener noreferrer">
          {language === 'fr' ? 'Ouvrir' : 'Open'}
        </a>
      </li>)}
    </ul> : <p role="status">
      {language === 'fr' ? 'Documents momentanément indisponibles.' : 'Documents are temporarily unavailable.'}
    </p>}
  </aside>
}