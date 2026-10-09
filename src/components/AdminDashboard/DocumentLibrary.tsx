import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../supabase'
import { getErrorMessage } from '../../lib/errors'
import {
  createLegalDocumentKey,
  getLegalDocumentType,
  LEGAL_DOCUMENT_TYPE_LABELS,
  validateDocumentLibraryFile,
} from '../../lib/document-library'
import type {
  DocumentLibraryAudience,
  DocumentLibraryCategory,
  DocumentLibraryDocument,
  DocumentLibraryKind,
  DocumentLibraryStatus,
  DocumentLibraryUsage,
  DocumentLibraryVersion,
  LegalDocumentType,
} from '../../lib/document-library'
import './DocumentLibrary.css'

interface DocumentLibraryProps {
  adminId: string
}

interface DocumentLibraryEvent {
  id: string
  document_id: string | null
  event_type: string
  details: Record<string, unknown>
  actor_id: string | null
  created_at: string
}

interface DocumentDraft {
  key: string
  category_id: string
  legal_type: LegalDocumentType | ''
  title: string
  description: string
  kind: DocumentLibraryKind
  audience: DocumentLibraryAudience
}

const emptyDraft: DocumentDraft = {
  key: '',
  category_id: '',
  legal_type: '',
  title: '',
  description: '',
  kind: 'downloadable',
  audience: 'admin',
}

const kindLabels: Record<DocumentLibraryKind, string> = {
  downloadable: 'Document téléchargeable',
  generated_template: 'Modèle de document généré',
  digital_form: 'Formulaire numérique',
  reference: 'Document de référence',
}

const statusLabels: Record<DocumentLibraryStatus, string> = {
  draft: 'Brouillon',
  published: 'Publié',
  archived: 'Archivé',
}

const audienceLabels: Record<DocumentLibraryAudience, string> = {
  public: 'Public',
  authenticated: 'Comptes connectés',
  admin: 'Administrateurs',
}

const usageTypes = [
  ['form', 'Formulaire'],
  ['mission', 'Mission'],
  ['mission_request', 'Demande de mission'],
  ['page', 'Page'],
  ['workflow', 'Processus'],
  ['report', 'Rapport'],
  ['partner', 'Partenaire'],
  ['other', 'Autre'],
] as const

function slugify(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function createUsageDraft() {
  return { consumer_type: 'workflow', consumer_key: '', label: '', version_id: '' }
}

export default function DocumentLibrary({ adminId }: DocumentLibraryProps) {
  const [categories, setCategories] = useState<DocumentLibraryCategory[]>([])
  const [documents, setDocuments] = useState<DocumentLibraryDocument[]>([])
  const [events, setEvents] = useState<DocumentLibraryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DocumentDraft>(emptyDraft)
  const [file, setFile] = useState<File | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterKind, setFilterKind] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [usageDrafts, setUsageDrafts] = useState<Record<string, ReturnType<typeof createUsageDraft>>>({})

  const loadLibrary = useCallback(async () => {
    if (!supabase) {
      setError('Supabase n’est pas configuré.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [categoryResult, documentResult, versionResult, usageResult, eventResult] = await Promise.all([
        supabase.from('document_library_categories').select('*').order('sort_order').order('name'),
        supabase.from('document_library_documents').select('*').order('updated_at', { ascending: false }),
        supabase.from('document_library_versions').select('*').order('version_number', { ascending: false }),
        supabase.from('document_library_usages').select('*').order('created_at', { ascending: false }),
        supabase.from('document_library_events').select('*').order('created_at', { ascending: false }).limit(300),
      ])
      const queryError = categoryResult.error || documentResult.error || versionResult.error || usageResult.error || eventResult.error
      if (queryError) throw queryError

      const categoryRows = (categoryResult.data || []) as DocumentLibraryCategory[]
      const versionRows = (versionResult.data || []) as DocumentLibraryVersion[]
      const usageRows = (usageResult.data || []) as DocumentLibraryUsage[]
      const categoryById = new Map(categoryRows.map((category) => [category.id, category]))
      const versionsByDocument = new Map<string, DocumentLibraryVersion[]>()
      for (const version of versionRows) {
        const versions = versionsByDocument.get(version.document_id) || []
        versions.push(version)
        versionsByDocument.set(version.document_id, versions)
      }
      const usagesByDocument = new Map<string, DocumentLibraryUsage[]>()
      for (const usage of usageRows) {
        const usages = usagesByDocument.get(usage.document_id) || []
        usages.push(usage)
        usagesByDocument.set(usage.document_id, usages)
      }
      setCategories(categoryRows)
      setDocuments(((documentResult.data || []) as DocumentLibraryDocument[]).map((document) => {
        const versions = versionsByDocument.get(document.id) || []
        return {
          ...document,
          category: categoryById.get(document.category_id),
          versions,
          published_version: versions.find((version) => version.id === document.published_version_id) || null,
          usages: usagesByDocument.get(document.id) || [],
        }
      }))
      setEvents((eventResult.data || []) as DocumentLibraryEvent[])
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible de charger la bibliothèque de documents.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void loadLibrary())
  }, [loadLibrary])

  const resetForm = () => {
    setShowForm(false)
    setEditingDocumentId(null)
    setDraft({ ...emptyDraft, category_id: categories.find((category) => category.is_active)?.id || '' })
    setFile(null)
  }

  const uploadVersion = async (document: DocumentLibraryDocument, selectedFile: File) => {
    if (!supabase) throw new Error('Supabase n’est pas configuré.')
    const validationError = validateDocumentLibraryFile(selectedFile)
    if (validationError) throw new Error(validationError)
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Votre session a expiré. Reconnectez-vous avant le téléversement.')

    const versionNumber = (document.versions?.[0]?.version_number || 0) + 1
    const response = await fetch('/api/document-library', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': selectedFile.type,
        'X-Library-Document-Id': document.id,
        'X-Library-Category-Key': document.category?.key || '',
        'X-Library-Version-Number': String(versionNumber),
        'X-Library-File-Name': encodeURIComponent(selectedFile.name),
      },
      body: selectedFile,
    })
    const uploaded = await response.json()
    if (!response.ok) throw new Error(uploaded?.error || 'Le téléversement sécurisé a échoué.')

    const { error: insertError } = await supabase.from('document_library_versions').insert({
      document_id: document.id,
      version_number: versionNumber,
      file_name: uploaded.file_name,
      storage_path: uploaded.storage_path,
      mime_type: uploaded.mime_type,
      file_size: uploaded.file_size,
      sha256: uploaded.sha256,
      uploaded_by: adminId,
    })
    if (insertError) {
      const cleanupUrl = new URL('/api/document-library', window.location.origin)
      cleanupUrl.searchParams.set('document_id', document.id)
      cleanupUrl.searchParams.set('path', uploaded.storage_path)
      await fetch(cleanupUrl, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined)
      throw insertError
    }
  }

  const handleSaveDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    const title = draft.title.trim()
    const keySuffix = slugify(draft.key.replace(/^legal-(mentions[_-]legales|cgu|cgv|rgpd|cookies|autre)-/, '')) || slugify(title)
    const key = editingDocumentId
      ? draft.key
      : draft.legal_type
        ? createLegalDocumentKey(draft.legal_type, keySuffix)
        : slugify(draft.key || title)
    if (!key) {
      setError('La clé stable du document ne peut pas être vide.')
      return
    }

    setBusyAction('save')
    setError(null)
    setNotice(null)
    let savedDocument: DocumentLibraryDocument | undefined
    try {
      if (editingDocumentId) {
        const { data, error: updateError } = await supabase
          .from('document_library_documents')
          .update({
            category_id: draft.category_id,
            title,
            description: draft.description.trim(),
            kind: draft.kind,
            audience: draft.audience,
          })
          .eq('id', editingDocumentId)
          .select('*')
          .single()
        if (updateError) throw updateError
        savedDocument = data as DocumentLibraryDocument
      } else {
        const { data, error: insertError } = await supabase
          .from('document_library_documents')
          .insert({
            key,
            category_id: draft.category_id,
            title,
            description: draft.description.trim(),
            kind: draft.kind,
            audience: draft.audience,
            created_by: adminId,
            updated_by: adminId,
          })
          .select('*')
          .single()
        if (insertError) throw insertError
        savedDocument = data as DocumentLibraryDocument
      }

      if (file && savedDocument) {
        const category = categories.find((item) => item.id === savedDocument?.category_id)
        const existingDocument = documents.find((document) => document.id === savedDocument?.id)
        await uploadVersion({
          ...savedDocument,
          category,
          versions: existingDocument?.versions || [],
        }, file)
      }
      setNotice(file ? 'Document enregistré et nouvelle version ajoutée en brouillon.' : 'Métadonnées enregistrées.')
      resetForm()
      await loadLibrary()
    } catch (err) {
      if (savedDocument && !editingDocumentId) setEditingDocumentId(savedDocument.id)
      setError(getErrorMessage(err) || 'Impossible d’enregistrer ce document.')
      await loadLibrary()
    } finally {
      setBusyAction(null)
    }
  }

  const startEdit = (document: DocumentLibraryDocument) => {
    setEditingDocumentId(document.id)
    setDraft({
      key: document.key,
      category_id: document.category_id,
      legal_type: getLegalDocumentType(document.key) || '',
      title: document.title,
      description: document.description,
      kind: document.kind,
      audience: document.audience,
    })
    setFile(null)
    setShowForm(true)
  }

  const handlePublish = async (document: DocumentLibraryDocument, version: DocumentLibraryVersion) => {
    if (!supabase) return
    setBusyAction(`publish-${document.id}`)
    setError(null)
    try {
      const { error: publishError } = await supabase.rpc('publish_document_library_version', {
        p_document_id: document.id,
        p_version_id: version.id,
      })
      if (publishError) throw publishError
      setNotice(`La version ${version.version_number} de « ${document.title} » est maintenant publiée.`)
      await loadLibrary()
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible de publier cette version.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleArchive = async (document: DocumentLibraryDocument) => {
    if (!supabase || !window.confirm(`Archiver « ${document.title} » ? Les versions et les usages resteront conservés.`)) return
    setBusyAction(`archive-${document.id}`)
    setError(null)
    try {
      const { error: archiveError } = await supabase.rpc('archive_document_library_document', { p_document_id: document.id })
      if (archiveError) throw archiveError
      setNotice(`« ${document.title} » est archivé; son historique est conservé.`)
      await loadLibrary()
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible d’archiver ce document.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleFileAction = async (version: DocumentLibraryVersion, download: boolean) => {
    if (!supabase) return
    setBusyAction(`file-${version.id}`)
    setError(null)
    try {
      const options = download ? { download: version.file_name } : undefined
      const { data, error: urlError } = await supabase.storage
        .from(version.storage_bucket)
        .createSignedUrl(version.storage_path, 300, options)
      if (urlError) throw urlError
      const link = document.createElement('a')
      link.href = data.signedUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      if (download) link.download = version.file_name
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible d’ouvrir ce fichier.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleAddCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    const name = categoryName.trim()
    const key = slugify(name)
    if (key.length < 2) {
      setError('Le nom de catégorie doit permettre de créer une clé stable.')
      return
    }
    setBusyAction('category')
    setError(null)
    try {
      const { error: insertError } = await supabase.from('document_library_categories').insert({
        key,
        name,
        sort_order: categories.reduce((max, category) => Math.max(max, category.sort_order), 0) + 10,
        created_by: adminId,
        updated_by: adminId,
      })
      if (insertError) throw insertError
      setCategoryName('')
      setNotice('Catégorie ajoutée.')
      await loadLibrary()
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible d’ajouter cette catégorie.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleToggleCategory = async (category: DocumentLibraryCategory) => {
    if (!supabase) return
    setBusyAction(`category-${category.id}`)
    setError(null)
    try {
      const { error: updateError } = await supabase.from('document_library_categories')
        .update({ is_active: !category.is_active }).eq('id', category.id)
      if (updateError) throw updateError
      await loadLibrary()
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible de modifier cette catégorie.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleAddUsage = async (event: FormEvent<HTMLFormElement>, document: DocumentLibraryDocument) => {
    event.preventDefault()
    if (!supabase) return
    const usage = usageDrafts[document.id] || createUsageDraft()
    setBusyAction(`usage-${document.id}`)
    setError(null)
    try {
      const { error: insertError } = await supabase.from('document_library_usages').insert({
        document_id: document.id,
        consumer_type: usage.consumer_type,
        consumer_key: usage.consumer_key.trim(),
        label: usage.label.trim(),
        version_id: usage.version_id || null,
        created_by: adminId,
      })
      if (insertError) throw insertError
      setUsageDrafts((current) => ({ ...current, [document.id]: createUsageDraft() }))
      setNotice('Emplacement d’utilisation enregistré.')
      await loadLibrary()
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible d’enregistrer cet emplacement.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleRemoveUsage = async (usageId: string) => {
    if (!supabase) return
    setBusyAction(`usage-${usageId}`)
    setError(null)
    try {
      const { error: deleteError } = await supabase.from('document_library_usages').delete().eq('id', usageId)
      if (deleteError) throw deleteError
      await loadLibrary()
    } catch (err) {
      setError(getErrorMessage(err) || 'Impossible de retirer cet emplacement.')
    } finally {
      setBusyAction(null)
    }
  }

  const activeCategories = categories.filter((category) => category.is_active)
  const selectedCategory = categories.find((category) => category.id === draft.category_id)
  const isLegalCategory = selectedCategory?.key === 'legal-documents'
  const selectableCategories = activeCategories.some((category) => category.id === draft.category_id)
    ? activeCategories
    : [...activeCategories, ...categories.filter((category) => category.id === draft.category_id)]
  const filteredDocuments = documents.filter((document) => {
    const matchesCategory = !filterCategory || document.category_id === filterCategory
    const matchesKind = !filterKind || document.kind === filterKind
    const matchesStatus = !filterStatus || document.status === filterStatus
    const searchValue = `${document.title} ${document.key} ${document.description} ${document.category?.name || ''}`.toLowerCase()
    return matchesCategory && matchesKind && matchesStatus && searchValue.includes(search.trim().toLowerCase())
  })
  const legalDocumentCount = documents.filter((document) => getLegalDocumentType(document.key)).length

  return (
    <section className="admin-section document-library">
      <header className="document-library-header">
        <div>
          <h2>Bibliothèque de documents</h2>
          <p>Les remplacements créent une nouvelle version; seule une publication explicite change le modèle actif.</p>
        </div>
        <button type="button" className="document-library-primary" onClick={() => {
          setDraft({ ...emptyDraft, category_id: activeCategories[0]?.id || '' })
          setEditingDocumentId(null)
          setFile(null)
          setShowForm((visible) => !visible)
        }}>
          {showForm && !editingDocumentId ? 'Fermer le formulaire' : 'Ajouter un document'}
        </button>
      </header>

      {error && <p className="document-library-message is-error" role="alert">{error}</p>}
      {notice && <p className="document-library-message is-success" role="status">{notice}</p>}

      {showForm && <form className="document-library-form" onSubmit={handleSaveDocument}>
        <div className="document-library-form-heading">
          <h3>{editingDocumentId ? 'Modifier le document ou ajouter une version' : 'Nouveau document'}</h3>
          {editingDocumentId && <button type="button" className="document-library-text-button" onClick={resetForm}>Annuler</button>}
        </div>
        <div className="document-library-form-grid">
          <label>
            Titre
            <input required minLength={2} maxLength={200} value={draft.title} onChange={(event) => {
              const title = event.target.value
              setDraft((current) => ({
                ...current,
                title,
                key: editingDocumentId
                  ? current.key
                  : current.legal_type
                    ? createLegalDocumentKey(current.legal_type, slugify(title))
                    : slugify(title),
              }))
            }} />
          </label>
          <label>
            Clé stable
            <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.key} disabled={Boolean(editingDocumentId)} onChange={(event) => {
              const suffix = slugify(event.target.value.replace(/^legal-(mentions[_-]legales|cgu|cgv|rgpd|cookies|autre)-/, ''))
              setDraft((current) => ({ ...current, key: current.legal_type ? createLegalDocumentKey(current.legal_type, suffix) : suffix }))
            }} />
          </label>
          <label>
            Catégorie
            <select required value={draft.category_id} onChange={(event) => {
              const category = categories.find((item) => item.id === event.target.value)
              const legalCategory = category?.key === 'legal-documents'
              setDraft((current) => ({
                ...current,
                category_id: event.target.value,
                legal_type: legalCategory ? current.legal_type : '',
                key: editingDocumentId || legalCategory ? current.key : slugify(current.title),
              }))
            }}>
              <option value="">Sélectionner une catégorie</option>
              {selectableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.is_active ? '' : ' (inactive)'}</option>)}
            </select>
          </label>
          {isLegalCategory && <label>
            Type de document juridique
            <select value={draft.legal_type} disabled={Boolean(editingDocumentId)} onChange={(event) => {
              const legalType = event.target.value as LegalDocumentType | ''
              setDraft((current) => ({
                ...current,
                legal_type: legalType,
                key: legalType ? createLegalDocumentKey(legalType, slugify(current.title)) : slugify(current.title),
                audience: legalType ? 'public' : current.audience,
              }))
            }}>
              <option value="">Document administratif</option>
              {Object.entries(LEGAL_DOCUMENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>}
          <label>
            Type de document
            <select value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as DocumentLibraryKind }))}>
              {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Accès
            <select value={draft.audience} onChange={(event) => setDraft((current) => ({ ...current, audience: event.target.value as DocumentLibraryAudience }))}>
              {Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="document-library-file-field">
            {editingDocumentId ? 'Ajouter une nouvelle version' : 'Fichier initial (facultatif)'}
            <input type="file" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.webp" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            <span>PDF, DOCX, XLSX, JPEG, PNG ou WebP, 3 Mo maximum.</span>
          </label>
          <label className="document-library-description">
            Description
            <textarea maxLength={5000} rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          </label>
        </div>
        <div className="document-library-form-actions">
          <button type="submit" className="document-library-primary" disabled={busyAction === 'save' || !activeCategories.length}>
            {busyAction === 'save' ? 'Enregistrement…' : editingDocumentId ? 'Enregistrer les modifications' : 'Créer le document'}
          </button>
        </div>
      </form>}

      <div className="document-library-category-tools">
        <div>
          <h3>Catégories</h3>
          <ul className="document-library-category-list">
            {categories.map((category) => <li key={category.id}>
              <span className={!category.is_active ? 'is-inactive' : ''}>{category.name}</span>
              <button type="button" onClick={() => void handleToggleCategory(category)} disabled={busyAction === `category-${category.id}`}>
                {category.is_active ? 'Désactiver' : 'Réactiver'}
              </button>
            </li>)}
          </ul>
        </div>
        <form className="document-library-category-form" onSubmit={handleAddCategory}>
          <label htmlFor="document-library-category-name">Ajouter une catégorie</label>
          <div>
            <input id="document-library-category-name" required minLength={2} maxLength={120} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
            <button type="submit" disabled={busyAction === 'category'}>Ajouter</button>
          </div>
        </form>
      </div>

      <div className="document-library-filters" aria-label="Filtres de documents">
        <label>Rechercher<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Titre, clé ou description" /></label>
        <label>Catégorie<select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
          <option value="">Toutes</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select></label>
        <label>Type<select value={filterKind} onChange={(event) => setFilterKind(event.target.value)}>
          <option value="">Tous</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Statut<select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
          <option value="">Tous</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>

      <p className="document-library-legal-summary">Documents juridiques classés dans leur catégorie : {legalDocumentCount}</p>

      {loading ? <p className="document-library-empty">Chargement de la bibliothèque…</p> : filteredDocuments.length === 0 ? (
        <p className="document-library-empty">Aucun document ne correspond aux filtres.</p>
      ) : <div className="document-library-list">
        {filteredDocuments.map((document) => {
          const publishedVersion = document.published_version
          const latestVersion = document.versions?.[0]
          const needsPublication = Boolean(latestVersion && (
            document.status !== 'published' || latestVersion.id !== document.published_version_id
          ))
          const documentEvents = events.filter((event) => event.document_id === document.id)
          return <article className="document-library-item" key={document.id}>
            <div className="document-library-item-main">
              <div className="document-library-item-copy">
                <div className="document-library-item-title">
                  <h3>{document.title}</h3>
                  {getLegalDocumentType(document.key) && <span className="document-library-legal-type">{LEGAL_DOCUMENT_TYPE_LABELS[getLegalDocumentType(document.key)!]}</span>}
                  <span className={`document-library-status status-${document.status}`}>{statusLabels[document.status]}</span>
                  {publishedVersion && <span className="document-library-current-version">Publié · v{publishedVersion.version_number}</span>}
                </div>
                <p>{document.category?.name || 'Catégorie inactive'} · {kindLabels[document.kind]} · {audienceLabels[document.audience]}</p>
                <code>{document.key}</code>
                {document.description && <p className="document-library-description-text">{document.description}</p>}
                <small>Mis à jour le {new Date(document.updated_at).toLocaleString('fr-FR')} · {document.versions?.length || 0} version(s)</small>
              </div>
              <div className="document-library-item-actions">
                <button type="button" onClick={() => startEdit(document)}>Modifier / remplacer</button>
                {latestVersion && needsPublication && <button
                  type="button"
                  className="is-publish"
                  disabled={busyAction === `publish-${document.id}`}
                  onClick={() => void handlePublish(document, latestVersion)}
                >
                  {busyAction === `publish-${document.id}` ? 'Publication…' : `Publier v${latestVersion.version_number}`}
                </button>}
                {!latestVersion && <button type="button" className="is-publish" onClick={() => startEdit(document)}>Ajouter un fichier</button>}
                {publishedVersion && <button type="button" onClick={() => void handleFileAction(publishedVersion, false)}>Prévisualiser</button>}
                {publishedVersion && <button type="button" onClick={() => void handleFileAction(publishedVersion, true)}>Télécharger</button>}
                {document.status !== 'archived' && <button type="button" className="is-danger" onClick={() => void handleArchive(document)}>Archiver</button>}
                <button type="button" aria-expanded={expandedId === document.id} onClick={() => setExpandedId((current) => current === document.id ? null : document.id)}>
                  {expandedId === document.id ? 'Masquer l’historique' : 'Historique et usages'}
                </button>
              </div>
            </div>

            {expandedId === document.id && <div className="document-library-details">
              <section>
                <h4>Versions</h4>
                {(document.versions || []).length === 0 ? <p>Aucun fichier ajouté.</p> : <ul className="document-library-version-list">
                  {document.versions?.map((version) => <li key={version.id}>
                    <div>
                      <strong>v{version.version_number}{version.id === document.published_version_id ? ' · version publiée' : ''}</strong>
                      <span>{version.file_name} · {version.mime_type} · {version.file_size === null ? 'taille inconnue' : `${(version.file_size / 1024).toFixed(0)} Ko`}</span>
                      <small>{new Date(version.created_at).toLocaleString('fr-FR')}{version.sha256 ? ` · SHA-256 ${version.sha256}` : ' · empreinte non disponible (fichier historique)'}</small>
                    </div>
                    <div>
                      <button type="button" onClick={() => void handleFileAction(version, false)}>Ouvrir</button>
                      {version.id !== document.published_version_id && <button type="button" disabled={busyAction === `publish-${document.id}`} onClick={() => void handlePublish(document, version)}>
                        {busyAction === `publish-${document.id}` ? 'Publication…' : 'Publier cette version'}
                      </button>}
                    </div>
                  </li>)}
                </ul>}
              </section>
              <section>
                <h4>Utilisé dans</h4>
                {(document.usages || []).length === 0 ? <p>Aucun emplacement métier déclaré.</p> : <ul className="document-library-usage-list">
                  {document.usages?.map((usage) => <li key={usage.id}>
                    <span><strong>{usage.label}</strong> · {usage.consumer_type}/{usage.consumer_key}{usage.version_id ? ` · version ${document.versions?.find((version) => version.id === usage.version_id)?.version_number ?? 'historique'}` : ' · modèle courant'}</span>
                    <button type="button" onClick={() => void handleRemoveUsage(usage.id)}>Retirer</button>
                  </li>)}
                </ul>}
                <form className="document-library-usage-form" onSubmit={(event) => void handleAddUsage(event, document)}>
                  <label>Emplacement<select value={(usageDrafts[document.id] || createUsageDraft()).consumer_type} onChange={(event) => setUsageDrafts((current) => ({ ...current, [document.id]: { ...(current[document.id] || createUsageDraft()), consumer_type: event.target.value } }))}>
                    {usageTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select></label>
                  <label>Clé d’utilisation<input required maxLength={200} value={(usageDrafts[document.id] || createUsageDraft()).consumer_key} onChange={(event) => setUsageDrafts((current) => ({ ...current, [document.id]: { ...(current[document.id] || createUsageDraft()), consumer_key: event.target.value } }))} /></label>
                  <label>Libellé<input required maxLength={200} value={(usageDrafts[document.id] || createUsageDraft()).label} onChange={(event) => setUsageDrafts((current) => ({ ...current, [document.id]: { ...(current[document.id] || createUsageDraft()), label: event.target.value } }))} /></label>
                  <label>Version associée<select value={(usageDrafts[document.id] || createUsageDraft()).version_id} onChange={(event) => setUsageDrafts((current) => ({ ...current, [document.id]: { ...(current[document.id] || createUsageDraft()), version_id: event.target.value } }))}>
                    <option value="">Modèle courant</option>{document.versions?.map((version) => <option key={version.id} value={version.id}>Version {version.version_number}</option>)}
                  </select></label>
                  <button type="submit" disabled={busyAction === `usage-${document.id}`}>Ajouter l’emplacement</button>
                </form>
              </section>
              <section>
                <h4>Journal d’activité</h4>
                {documentEvents.length === 0 ? <p>Aucune activité enregistrée.</p> : <ul className="document-library-event-list">
                  {documentEvents.map((event) => <li key={event.id}>
                    <strong>{event.event_type.replaceAll('_', ' ')}</strong>
                    <span>{new Date(event.created_at).toLocaleString('fr-FR')} · {event.actor_id || 'Administrateur système'}</span>
                    <code>{JSON.stringify(event.details)}</code>
                  </li>)}
                </ul>}
              </section>
            </div>}
          </article>
        })}
      </div>}
    </section>
  )
}