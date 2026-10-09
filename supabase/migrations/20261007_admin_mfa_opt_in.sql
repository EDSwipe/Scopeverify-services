-- MFA is opt-in: admins without a verified factor may continue at AAL1.
-- Once an admin verifies a factor, admin database access requires AAL2.
create or replace function public.is_scope_admin()
returns boolean language sql stable security definer set search_path = public set row_security = off
as $$
  select (
      coalesce(auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr', false)
      or exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.role = 'admin' and u.is_active = true
      )
    )
    and (
      coalesce(auth.jwt() ->> 'aal' = 'aal2', false)
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      )
    );
$$;

notify pgrst, 'reload schema';