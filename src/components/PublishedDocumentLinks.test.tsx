import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PublishedDocumentLinks from './PublishedDocumentLinks'
import { resolvePublishedDocument } from '../lib/document-library'
import type { ResolvedDocumentLibraryDocument } from '../lib/document-library'

vi.mock('../lib/document-library', () => ({
  resolvePublishedDocument: vi.fn(),
}))

const resolveMock = vi.mocked(resolvePublishedDocument)

const documentFixture: ResolvedDocumentLibraryDocument = {
  id: 'document-id',
  key: 'authorization-template',
  category_id: 'category-id',
  category_key: 'authorizations-mandates',
  category_name: 'Autorisations et mandats',
  title: 'Autorisation de visite',
  description: '',
  kind: 'downloadable',
  version_id: 'version-id',
  version_number: 2,
  file_name: 'autorisation.pdf',
  mime_type: 'application/pdf',
  file_size: 1024,
  url: 'https://example.com/signed-document',
  expires_in: 300,
}

describe('PublishedDocumentLinks', () => {
  beforeEach(() => resolveMock.mockReset())

  it('shows published documents resolved for its category', async () => {
    resolveMock.mockResolvedValue([documentFixture])
    render(<PublishedDocumentLinks categoryKey="authorizations-mandates" title="Documents utiles" />)

    const link = await screen.findByRole('link', { name: /Autorisation de visite/ })
    expect(resolveMock).toHaveBeenCalledWith({ category: 'authorizations-mandates' })
    expect(screen.getByText('Autorisation de visite')).toBeInTheDocument()
    expect(screen.getByText('autorisation.pdf · v2')).toBeInTheDocument()
    expect(link).toHaveAttribute('href', documentFixture.url)
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not render an empty section when no document is published', async () => {
    resolveMock.mockResolvedValue([])
    render(<PublishedDocumentLinks categoryKey="mission-requests" title="Documents de demande" />)

    await waitFor(() => expect(resolveMock).toHaveBeenCalled())
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('loads all public documents across admin-defined categories', async () => {
    resolveMock.mockResolvedValue([documentFixture])
    render(<PublishedDocumentLinks allVisible publicOnly title="Documents publiés" />)

    expect(await screen.findByRole('link', { name: /Autorisation de visite/ })).toBeInTheDocument()
    expect(resolveMock).toHaveBeenCalledWith({ all: true, audience: 'public' })
    expect(screen.getByText('Autorisations et mandats · autorisation.pdf · v2')).toBeInTheDocument()
  })
})