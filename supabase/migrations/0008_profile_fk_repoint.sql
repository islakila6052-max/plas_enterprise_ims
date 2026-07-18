-- ============================================================================
-- 0008 — Repoint profile_id FKs to public.profiles (fixes PostgREST embed error)
-- ============================================================================
-- Your live database was built from the pasted schema where
-- supervisors.profile_id / interns.profile_id reference auth.users(id).
-- The services layer embeds `profile:profile_id (full_name, email)`, which
-- requires the FK to point at public.profiles(id) so PostgREST can resolve the
-- relationship. profiles.id already references auth.users(id), so the chain
-- (auth.users -> profiles -> supervisors/interns) still holds.
--
-- Run this in the Supabase SQL Editor. Safe to re-run (uses DROP ... IF EXISTS).
-- ============================================================================

-- supervisors -----------------------------------------------------------------
alter table public.supervisors
  drop constraint if exists supervisors_profile_id_fkey;

alter table public.supervisors
  add constraint supervisors_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

-- interns ---------------------------------------------------------------------
alter table public.interns
  drop constraint if exists interns_profile_id_fkey;

alter table public.interns
  add constraint interns_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

-- Reload PostgREST schema cache immediately so the relationship is visible
-- without waiting for the next auto-refresh.
notify pgrst, 'reload schema';
