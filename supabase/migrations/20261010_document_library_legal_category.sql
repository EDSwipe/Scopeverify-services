-- Give legal documents their own category in the central library.
-- Preserve document IDs, version history, statuses, and Storage paths.

insert into public.document_library_categories(key, name, sort_order, is_active)
values ('legal-documents', 'Documents juridiques', 55, true)
on conflict (key) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

update public.document_library_documents
set category_id = (
  select id from public.document_library_categories where key = 'legal-documents'
),
updated_at = now()
where key like 'legal-%'
  and category_id <> (
    select id from public.document_library_categories where key = 'legal-documents'
  );

notify pgrst, 'reload schema';