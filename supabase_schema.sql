-- ============================================================================
-- Internship Management System (IMS) — COMPLETE DATABASE SCHEMA
-- ============================================================================
-- Paste this ENTIRE file into Supabase: SQL Editor -> New query -> Run.
-- It creates enums, all tables, indexes, RLS policies, the auth trigger,
-- and the storage bucket. Safe to run once on a fresh project.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type user_role as enum ('admin', 'hr_staff', 'supervisor', 'intern');
create type intern_status as enum ('active', 'completed', 'archived');
create type attendance_status as enum ('present', 'late', 'absent', 'pending');
create type journal_status as enum ('pending', 'approved', 'rejected');
create type document_status as enum ('pending', 'approved', 'rejected');


-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  avatar_url text,
  contact_number text,
  bio text,
  role user_role not null default 'intern',
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);


-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid (),
  name text not null unique,
  description text,
  created_at timestamptz not null default now ()
);


-- ---------------------------------------------------------------------------
-- supervisors
-- ---------------------------------------------------------------------------
create table if not exists public.supervisors (
  id uuid primary key default gen_random_uuid (),
  profile_id uuid references public.profiles (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  created_at timestamptz not null default now ()
);


-- ---------------------------------------------------------------------------
-- interns
-- ---------------------------------------------------------------------------
create table if not exists public.interns (
  id uuid primary key default gen_random_uuid (),
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  student_number text,
  school text,
  course text,
  contact_number text,
  email text,
  emergency_contact text,
  department_id uuid references public.departments (id) on delete set null,
  supervisor_id uuid references public.supervisors (id) on delete set null,
  start_date date,
  end_date date,
  required_hours numeric not null default 300,
  status intern_status not null default 'active',
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);

create index if not exists interns_department_idx on public.interns (department_id);
create index if not exists interns_supervisor_idx on public.interns (supervisor_id);
create index if not exists interns_status_idx on public.interns (status);


-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid (),
  intern_id uuid not null references public.interns (id) on delete cascade,
  date date not null default current_date,
  time_in timestamptz,
  time_out timestamptz,
  total_hours numeric not null default 0,
  method text default 'manual',
  status attendance_status not null default 'present',
  created_at timestamptz not null default now ()
);

create index if not exists attendance_intern_idx on public.attendance (intern_id);
create index if not exists attendance_date_idx on public.attendance (date);


-- ---------------------------------------------------------------------------
-- daily_journals
-- ---------------------------------------------------------------------------
create table if not exists public.daily_journals (
  id uuid primary key default gen_random_uuid (),
  intern_id uuid not null references public.interns (id) on delete cascade,
  supervisor_id uuid references public.supervisors (id) on delete set null,
  date date not null default current_date,
  activities text not null,
  hours_worked numeric not null default 0,
  challenges text,
  learnings text,
  status journal_status not null default 'pending',
  supervisor_comment text,
  created_at timestamptz not null default now ()
);

create index if not exists journals_intern_idx on public.daily_journals (intern_id);
create index if not exists journals_status_idx on public.daily_journals (status);


-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid (),
  intern_id uuid not null references public.interns (id) on delete cascade,
  type text not null,
  label text,
  file_path text,
  file_url text,
  status document_status not null default 'pending',
  created_at timestamptz not null default now ()
);

create index if not exists documents_intern_idx on public.documents (intern_id);


-- ---------------------------------------------------------------------------
-- evaluations
-- ---------------------------------------------------------------------------
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid (),
  intern_id uuid not null references public.interns (id) on delete cascade,
  supervisor_id uuid references public.supervisors (id) on delete set null,
  attendance integer not null default 0,
  communication integer not null default 0,
  teamwork integer not null default 0,
  initiative integer not null default 0,
  technical_skills integer not null default 0,
  professionalism integer not null default 0,
  overall_rating integer not null default 0,
  comments text,
  final_recommendation text,
  status text not null default 'completed',
  created_at timestamptz not null default now ()
);

create index if not exists evaluations_intern_idx on public.evaluations (intern_id);


-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid (),
  title text not null,
  body text not null,
  category text not null default 'company_news',
  published_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now ()
);


-- ---------------------------------------------------------------------------
-- settings  (singleton, id = 1)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id integer primary key default 1,
  company_name text,
  internship_duration text,
  required_hours numeric not null default 300,
  updated_at timestamptz not null default now ()
);


-- ============================================================================
-- ROW LEVEL SECURITY + POLICIES + TRIGGERS
-- ============================================================================

-- Helper: role of the current user.
create or replace function public.current_role ()
  returns user_role
  language sql
  stable
  security definer
  set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid ();
$$;

-- Helper: true if current user is admin or hr_staff.
create or replace function public.is_admin ()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid ()
      and role in ('admin', 'hr_staff')
  );
$$;

-- Helper: supervisor row id for the current user.
create or replace function public.current_supervisor_id ()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select s.id
  from public.supervisors s
  join public.profiles p on p.id = s.profile_id
  where p.id = auth.uid ();
$$;

-- Helper: intern row id for the current user.
create or replace function public.current_intern_id ()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select i.id
  from public.interns i
  join public.profiles p on p.id = i.profile_id
  where p.id = auth.uid ();
$$;

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user ()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'intern')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

-- Enable RLS on all tables.
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.supervisors enable row level security;
alter table public.interns enable row level security;
alter table public.attendance enable row level security;
alter table public.daily_journals enable row level security;
alter table public.documents enable row level security;
alter table public.evaluations enable row level security;
alter table public.announcements enable row level security;
alter table public.settings enable row level security;

-- profiles
create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);
create policy "users manage own profile"
  on public.profiles for update to authenticated using (id = auth.uid ());
create policy "admins manage profiles"
  on public.profiles for all to authenticated
  using (public.is_admin ()) with check (public.is_admin ());

-- departments
create policy "departments readable"
  on public.departments for select to authenticated using (true);
create policy "admins manage departments"
  on public.departments for all to authenticated
  using (public.is_admin ()) with check (public.is_admin ());

-- supervisors
create policy "supervisors readable"
  on public.supervisors for select to authenticated using (true);
create policy "admins manage supervisors"
  on public.supervisors for all to authenticated
  using (public.is_admin ()) with check (public.is_admin ());

-- interns
create policy "interns readable"
  on public.interns for select to authenticated using (true);
create policy "admins manage interns"
  on public.interns for all to authenticated
  using (public.is_admin ()) with check (public.is_admin ());
create policy "intern reads own row"
  on public.interns for select to authenticated
  using (id = public.current_intern_id ());
create policy "supervisor reads assigned interns"
  on public.interns for select to authenticated
  using (supervisor_id = public.current_supervisor_id ());

-- attendance
create policy "attendance readable"
  on public.attendance for select to authenticated using (true);
create policy "admins manage attendance"
  on public.attendance for all to authenticated
  using (public.is_admin ()) with check (public.is_admin ());
create policy "intern manages own attendance"
  on public.attendance for all to authenticated
  using (intern_id = public.current_intern_id ())
  with check (intern_id = public.current_intern_id ());
create policy "supervisor reads assigned attendance"
  on public.attendance for select to authenticated
  using (
    intern_id in (
      select id from public.interns
      where supervisor_id = public.current_supervisor_id ()
    )
  );

-- daily_journals
create policy "journals readable"
  on public.daily_journals for select to authenticated using (true);
create policy "admins manage journals"
  on public.daily_journals for all to authenticated
  using (public.is_admin ()) with check (public.is_admin ());
create policy "intern manages own journals"
  on public.daily_journals for all to authenticated
  using (intern_id = public.current_intern_id ())
  with check (intern_id = public.current_intern_id ());
create policy "supervisor reviews assigned journals"
  on public.daily_journals for update to authenticated
  using (
    intern_id in (
      select id from public.interns
      where supervisor_id = public.current_supervisor_id ()
    )
  );

-- documents
create policy "documents readable"
  on public.documents for select to authenticated using (true);
create policy "admins manage documents"
  on public.documents for all to authenticated
  using (public.is_admin ()) with check (public.is_admin ());
create policy "intern manages own documents"
  on public.documents for all to authenticated
  using (intern_id = public.current_intern_id ())
  with check (intern_id = public.current_intern_id ());

-- evaluations
create policy "evaluations readable"
  on public.evaluations for select to authenticated using (true);
create policy "admins manage evaluations"
  on public.evaluations for all to authenticated
  using (public.is_admin ()) with check (public.is_admin ());
create policy "supervisor manages assigned evaluations"
  on public.evaluations for all to authenticated
  using (supervisor_id = public.current_supervisor_id ())
  with check (supervisor_id = public.current_supervisor_id ());
create policy "intern reads own evaluation"
  on public.evaluations for select to authenticated
  using (intern_id = public.current_intern_id ());

-- announcements
create policy "announcements readable"
  on public.announcements for select to authenticated using (true);
create policy "admins manage announcements"
  on public.announcements for all to authenticated
  using (public.is_admin ()) with check (public.is_admin ());

-- settings
create policy "settings readable"
  on public.settings for select to authenticated using (true);
create policy "admins manage settings"
  on public.settings for all to authenticated
  using (public.is_admin ()) with check (public.is_admin ());

-- Storage bucket for intern documents.
insert into storage.buckets (id, name, public)
values ('intern-documents', 'intern-documents', true)
on conflict (id) do nothing;

create policy "documents storage readable"
  on storage.objects for select to authenticated
  using (bucket_id = 'intern-documents');

create policy "intern uploads own documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'intern-documents'
    and (storage.foldername (name))[1] = public.current_intern_id ()::text
  );

create policy "admins manage storage"
  on storage.objects for all to authenticated
  using (bucket_id = 'intern-documents')
  with check (bucket_id = 'intern-documents');
