import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, getAuthenticatorAssuranceLevel } from './_supabaseAuth.js'

const BUCKET = 'document-library'
const MAX_FILE_SIZE = 3 * 1024 * 1024
const SIGNED_URL_TTL_SECONDS = 300
const ADMIN_EMAIL = (process.env.VITE_ADMIN_EMAIL || 'sotbirida@yahoo.fr').toLowerCase()
const FILE_TYPES = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export const config = { api: { bodyParser: false } }

function getServiceClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getCaller(request, response, requireAdmin = false) {
  const authorization = request.headers.authorization || ''
  const caller = authorization ? await getAuthenticatedUser(request) : null
  if (authorization && !caller) {
    response.status(401).json({ error: 'Session invalide ou expirée' })
    return null
  }
  if (requireAdmin && !caller) {
    response.status(401).json({ error: 'Authentification requise' })
    return null
  }

  const serviceClient = getServiceClient()
  if (!serviceClient) {
    response.status(503).json({ error: 'La bibliothèque de documents n’est pas configurée sur ce déploiement' })
    return null
  }
  if (!caller) return { serviceClient, user: null, isAdmin: false }

  const { data: profile, error } = await serviceClient
    .from('users')
    .select('role,is_active')
    .eq('id', caller.id)
    .maybeSingle()
  if (error) {
    response.status(500).json({ error: 'Impossible de vérifier les droits du compte' })
    return null
  }

  let isAdmin = caller.email?.toLowerCase() === ADMIN_EMAIL
    || (profile?.role === 'admin' && profile.is_active === true)
  const isActiveUser = isAdmin || profile?.is_active === true
  if (!isActiveUser) {
    response.status(403).json({ error: 'Un compte actif est nécessaire' })
    return null
  }
  if (requireAdmin && !isAdmin) {
    response.status(403).json({ error: 'Accès réservé à l’administrateur' })
    return null
  }
  if (requireAdmin) {
    const assurance = await getAuthenticatorAssuranceLevel(request)
    if (!assurance || (assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2')) {
      response.status(403).json({ error: 'Terminez la vérification MFA avant de continuer' })
      return null
    }
  } else if (isAdmin) {
    const assurance = await getAuthenticatorAssuranceLevel(request)
    if (!assurance || (assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2')) {
      isAdmin = false
    }
  }
  return { serviceClient, user: caller, isAdmin }
}

function getExtension(fileName) {
  return fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
}

function hasZipEntry(buffer, expectedNames) {
  const minimumOffset = Math.max(0, buffer.length - 65557)
  let endOffset = -1
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset
      break
    }
  }
  if (endOffset < 0) return false

  const entryCount = buffer.readUInt16LE(endOffset + 10)
  let offset = buffer.readUInt32LE(endOffset + 16)
  if (entryCount === 0xffff || offset === 0xffffffff) return false
  const names = new Set()
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) return false
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength
    if (nextOffset > buffer.length) return false
    names.add(buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'))
    offset = nextOffset
  }
  return expectedNames.every((name) => names.has(name))
}

function hasExpectedSignature(buffer, extension) {
  if (extension === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  if (extension === '.jpg' || extension === '.jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (extension === '.png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (extension === '.webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  if (extension === '.docx') return hasZipEntry(buffer, ['[Content_Types].xml', 'word/document.xml'])
  if (extension === '.xlsx') return hasZipEntry(buffer, ['[Content_Types].xml', 'xl/workbook.xml'])
  return false
}

async function readRawBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > MAX_FILE_SIZE) throw Object.assign(new Error('Le fichier dépasse la limite de 3 Mo'), { statusCode: 413 })
    chunks.push(bytes)
  }
  return Buffer.concat(chunks, size)
}

async function handleResolve(request, response, caller) {
  const key = typeof request.query?.key === 'string' ? request.query.key.trim() : ''
  const categoryKey = typeof request.query?.category === 'string' ? request.query.category.trim() : ''
  const allRequested = request.query?.all === 'true'
  const publicOnly = request.query?.audience === 'public'
  if ((key && categoryKey) || (allRequested && (key || categoryKey)) || (!key && !categoryKey && !allRequested)) {
    return response.status(400).json({ error: 'Fournissez une clé, une catégorie ou la liste des documents publiés' })
  }

  let categoryId
  if (categoryKey) {
    const { data: category, error } = await caller.serviceClient
      .from('document_library_categories')
      .select('id,is_active')
      .eq('key', categoryKey)
      .maybeSingle()
    if (error) throw error
    if (!category?.is_active) return response.status(404).json({ error: 'Catégorie introuvable' })
    categoryId = category.id
  }

  let query = caller.serviceClient
    .from('document_library_documents')
    .select('id,key,category_id,title,description,kind,audience,status,published_version_id')
    .eq('status', 'published')
  if (key) query = query.eq('key', key)
  if (categoryKey) query = query.eq('category_id', categoryId)
  const { data: documents, error: documentsError } = await query.order('title')
  if (documentsError) throw documentsError
  if (!documents?.length) return key
    ? response.status(404).json({ error: 'Document publié introuvable' })
    : response.status(200).json({ documents: [] })

  const categoryIds = [...new Set(documents.map((document) => document.category_id))]
  const { data: categories, error: categoryError } = await caller.serviceClient
    .from('document_library_categories')
    .select('id,key,name,is_active')
    .in('id', categoryIds)
  if (categoryError) throw categoryError
  const activeCategoryIds = new Set((categories || []).filter((category) => category.is_active).map((category) => category.id))

  const visibleDocuments = documents.filter((document) => activeCategoryIds.has(document.category_id) && (() => {
    if (publicOnly) return document.audience === 'public'
    if (document.audience === 'public') return true
    if (!caller.user) return false
    if (document.audience === 'admin') return caller.isAdmin
    return true
  })())
  if (key && !visibleDocuments.length) return response.status(caller.user ? 403 : 401).json({ error: 'Accès refusé' })
  if (!visibleDocuments.length) return response.status(200).json({ documents: [] })

  const versionIds = visibleDocuments.map((document) => document.published_version_id)
  const { data: versions, error: versionsError } = await caller.serviceClient
    .from('document_library_versions')
    .select('id,document_id,version_number,file_name,storage_bucket,storage_path,mime_type,file_size,sha256')
    .in('id', versionIds)
  if (versionsError) throw versionsError
  const byVersionId = new Map((versions || []).map((version) => [version.id, version]))
  const categoryById = new Map((categories || []).map((category) => [category.id, category]))
  const result = []
  for (const document of visibleDocuments) {
    const version = byVersionId.get(document.published_version_id)
    if (!version) continue
    const { data: signed, error: signedError } = await caller.serviceClient.storage
      .from(version.storage_bucket)
      .createSignedUrl(version.storage_path, SIGNED_URL_TTL_SECONDS, { download: version.file_name })
    if (signedError) throw signedError
    result.push({
      id: document.id,
      key: document.key,
      category_id: document.category_id,
      category_key: categoryById.get(document.category_id)?.key || '',
      category_name: categoryById.get(document.category_id)?.name || '',
      title: document.title,
      description: document.description,
      kind: document.kind,
      version_id: version.id,
      version_number: version.version_number,
      file_name: version.file_name,
      mime_type: version.mime_type,
      file_size: version.file_size,
      url: signed.signedUrl,
      expires_in: SIGNED_URL_TTL_SECONDS,
    })
  }
  return key ? response.status(200).json(result[0] || null) : response.status(200).json({ documents: result })
}

async function handleUpload(request, response, caller) {
  const documentId = request.headers['x-library-document-id'] || ''
  const categoryKey = request.headers['x-library-category-key'] || ''
  const versionNumber = Number(request.headers['x-library-version-number'])
  let fileName
  try {
    fileName = decodeURIComponent(request.headers['x-library-file-name'] || '')
  } catch {
    return response.status(400).json({ error: 'Nom de fichier invalide' })
  }
  if (!/^[0-9a-f-]{36}$/i.test(documentId) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(categoryKey)
    || !Number.isInteger(versionNumber) || versionNumber < 1
    || !fileName || fileName.length > 255 || /[\\/\u0000-\u001f]/.test(fileName)) {
    return response.status(400).json({ error: 'Métadonnées de fichier invalides' })
  }

  const extension = getExtension(fileName)
  const expectedMime = FILE_TYPES[extension]
  const declaredMime = (request.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
  if (!expectedMime || declaredMime !== expectedMime) {
    return response.status(415).json({ error: 'Extension et type MIME incompatibles ou non pris en charge' })
  }

  const { data: document, error: documentError } = await caller.serviceClient
    .from('document_library_documents')
    .select('id,category_id')
    .eq('id', documentId)
    .maybeSingle()
  if (documentError) throw documentError
  if (!document) return response.status(404).json({ error: 'Document introuvable' })
  const { data: category, error: categoryError } = await caller.serviceClient
    .from('document_library_categories')
    .select('id,key')
    .eq('id', document.category_id)
    .single()
  if (categoryError) throw categoryError
  if (category.key !== categoryKey) return response.status(400).json({ error: 'Catégorie du document incohérente' })

  const { data: latestVersion, error: versionError } = await caller.serviceClient
    .from('document_library_versions')
    .select('version_number')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (versionError) throw versionError
  const expectedNumber = (latestVersion?.version_number || 0) + 1
  if (versionNumber !== expectedNumber) return response.status(409).json({ error: 'Le numéro de version est périmé; rechargez l’historique.' })

  const file = await readRawBody(request)
  if (file.length === 0) return response.status(400).json({ error: 'Le fichier est vide' })
  if (!hasExpectedSignature(file, extension)) {
    return response.status(415).json({ error: 'Le contenu du fichier ne correspond pas à son extension' })
  }

  const storagePath = `${category.key}/${documentId}/v${versionNumber}-${randomUUID()}${extension}`
  const sha256 = createHash('sha256').update(file).digest('hex')
  const { error: uploadError } = await caller.serviceClient.storage.from(BUCKET).upload(storagePath, file, {
    contentType: expectedMime,
    cacheControl: '300',
    upsert: false,
  })
  if (uploadError) throw uploadError
  return response.status(201).json({
    file_name: fileName,
    storage_path: storagePath,
    mime_type: expectedMime,
    file_size: file.length,
    sha256,
  })
}

async function handleOrphanCleanup(request, response, caller) {
  const documentId = typeof request.query?.document_id === 'string' ? request.query.document_id : ''
  const storagePath = typeof request.query?.path === 'string' ? request.query.path : ''
  if (!/^[0-9a-f-]{36}$/i.test(documentId) || storagePath.length > 500) {
    return response.status(400).json({ error: 'Référence de fichier invalide' })
  }
  const { data: version, error: versionError } = await caller.serviceClient
    .from('document_library_versions')
    .select('id')
    .eq('storage_path', storagePath)
    .maybeSingle()
  if (versionError) throw versionError
  if (version) return response.status(409).json({ error: 'Une version enregistrée ne peut pas être supprimée' })
  const { data: document, error: documentError } = await caller.serviceClient
    .from('document_library_documents')
    .select('category_id')
    .eq('id', documentId)
    .maybeSingle()
  if (documentError) throw documentError
  if (!document) return response.status(404).json({ error: 'Document introuvable' })
  const { data: category, error: categoryError } = await caller.serviceClient
    .from('document_library_categories')
    .select('key')
    .eq('id', document.category_id)
    .single()
  if (categoryError) throw categoryError
  if (!storagePath.startsWith(`${category.key}/${documentId}/v`)) {
    return response.status(400).json({ error: 'Chemin de fichier incohérent' })
  }
  const { error: removeError } = await caller.serviceClient.storage.from(BUCKET).remove([storagePath])
  if (removeError) throw removeError
  return response.status(200).json({ removed: true })
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0')
  try {
    if (request.method === 'GET') {
      const caller = await getCaller(request, response)
      if (!caller) return
      return await handleResolve(request, response, caller)
    }
    if (request.method === 'POST' || request.method === 'DELETE') {
      const caller = await getCaller(request, response, true)
      if (!caller) return
      return request.method === 'POST'
        ? await handleUpload(request, response, caller)
        : await handleOrphanCleanup(request, response, caller)
    }
    response.setHeader('Allow', 'GET, POST, DELETE')
    return response.status(405).json({ error: 'Méthode non autorisée' })
  } catch (error) {
    console.error('Document library request failed:', error)
    return response.status(error?.statusCode || 500).json({ error: error?.message || 'Erreur de la bibliothèque de documents' })
  }
}