-- Give legal documents their own category in the central library.
-- Preserve document IDs, version history, statuses, and Storage paths.

insert into public.document_library_categories(key, name, sort_order, is_active)
values ('legal-documents', 'Documents juridiques', 55, true)
on conflict (key) do nothing;

-- Import legacy legal metadata if the initial library migration ran before these rows existed.
-- The Storage objects stay in their original private bucket and are never copied or deleted.
do $$
declare
  legacy_bucket storage.buckets%rowtype;
begin
  if to_regclass('public.legal_documents') is not null then
    if exists (select 1 from public.legal_documents) then
      select * into legacy_bucket from storage.buckets where id = 'legal-documents';
      if not found then
        raise exception 'Le bucket legal-documents est absent; vérifier les fichiers historiques avant de continuer';
      end if;
      if legacy_bucket.public then
        raise exception 'Le bucket legal-documents est public; le rendre privé avant de continuer';
      end if;
    end if;

    perform set_config('app.document_library_import', 'on', true);
    execute $import_documents$
      insert into public.document_library_documents(
        id, key, category_id, title, description, kind, audience, status, created_by, updated_by, created_at, updated_at
      )
      select l.id,
        'legal-' || replace(l.type, '_', '-') || '-' || l.id::text,
        c.id,
        case l.type
          when 'mentions_legales' then 'Mentions légales'
          when 'cgu' then 'Conditions générales d’utilisation (CGU)'
          when 'cgv' then 'Conditions générales de vente (CGV)'
          when 'rgpd' then 'Politique de confidentialité (RGPD)'
          when 'cookies' then 'Politique de cookies'
          else 'Autre document juridique'
        end,
        '', 'downloadable', 'admin', 'draft', l.updated_by, l.updated_by,
        coalesce(l.created_at, now()), coalesce(l.updated_at, l.created_at, now())
      from public.legal_documents l
      cross join public.document_library_categories c
      where c.key = 'legal-documents'
        and not exists (select 1 from public.document_library_documents d where d.id = l.id)
    $import_documents$;

    execute $import_versions$
      insert into public.document_library_versions(
        document_id, version_number, file_name, storage_bucket, storage_path, mime_type,
        file_size, sha256, uploaded_by, created_at
      )
      select l.id, 1, l.file_name, 'legal-documents', l.file_path, 'application/pdf',
        null, null, l.updated_by, coalesce(l.updated_at, l.created_at, now())
      from public.legal_documents l
      join public.document_library_documents d on d.id = l.id
      where not exists (select 1 from public.document_library_versions v where v.document_id = l.id)
    $import_versions$;

    perform set_config('app.document_library_managed_status', 'on', true);
    update public.document_library_documents d
    set status = 'published', published_version_id = v.id
    from public.legal_documents l
    join public.document_library_versions v on v.document_id = l.id and v.version_number = 1
    where d.id = l.id and d.status = 'draft';
    perform set_config('app.document_library_managed_status', 'off', true);
    perform set_config('app.document_library_import', 'off', true);
  end if;
end;
$$;

update public.document_library_documents d
set category_id = c.id,
    updated_at = now()
from public.document_library_categories c
where c.key = 'legal-documents'
  and d.key like 'legal-%'
  and d.category_id is distinct from c.id;

notify pgrst, 'reload schema';