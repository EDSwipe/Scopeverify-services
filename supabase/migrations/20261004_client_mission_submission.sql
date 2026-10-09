-- Allow clients to submit their own draft missions without granting broader updates.
drop policy if exists "Clients submit own draft missions" on public.missions;
create policy "Clients submit own draft missions" on public.missions
  for update to authenticated
  using (auth.uid() = client_id and status = 'draft')
  with check (auth.uid() = client_id and status = 'submitted');

notify pgrst, 'reload schema';