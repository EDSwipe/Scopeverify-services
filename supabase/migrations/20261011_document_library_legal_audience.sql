-- Preserve the legacy public-facing behavior of legal documents in the new library.
-- Administrators can still select another audience for newly created documents.

do $$
begin
  perform set_config('app.document_library_import', 'on', true);
  update public.document_library_documents d
  set audience = 'public'
  from public.document_library_categories c
  where c.id = d.category_id
    and c.key = 'legal-documents'
    and d.audience is distinct from 'public';
  perform set_config('app.document_library_import', 'off', true);
end;
$$;

notify pgrst, 'reload schema';