import { describe, expect, it } from 'vitest'
import { validateDocumentLibraryFile } from './document-library'

describe('validateDocumentLibraryFile', () => {
  it('accepts supported extensions with matching MIME types and size', () => {
    expect(validateDocumentLibraryFile({
      name: 'modele.pdf',
      type: 'application/pdf',
      size: 1024,
    })).toBeNull()
    expect(validateDocumentLibraryFile({
      name: 'tableau.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
    })).toBeNull()
  })

  it('rejects unsupported, mismatched, and oversized files', () => {
    expect(validateDocumentLibraryFile({ name: 'script.exe', type: 'application/octet-stream', size: 1024 })).toContain('Format')
    expect(validateDocumentLibraryFile({ name: 'document.pdf', type: 'text/plain', size: 1024 })).toContain('MIME')
    expect(validateDocumentLibraryFile({ name: 'document.pdf', type: 'application/pdf', size: 4 * 1024 * 1024 })).toContain('3 Mo')
  })
})