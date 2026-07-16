# Internship Management System — Database Schema

> Reverse-engineered from the codebase. This document is the authoritative reference for the
> Supabase/PostgreSQL database that backs the Internship Management System (IMS).
>
> **Evidence basis:** `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_rls.sql`,
> `supabase/migrations/0003_prototype_fields.sql`, `supabase_schema.sql`, all files under
> `src/services/`, `src/contexts/`, `src/pages/`, `src/lib/`, `src/routes/`, `src/components/`,
> `src/utils/`, plus `README.md` and `PROJECT_PLAN.md`.
>
> Every schema element below is marked as **[CONFIRMED]** (present in SQL/migrations and used by
> code) or **[RECOMMENDED]** (not present, proposed to fix a gap or discrepancy). Nothing is guessed.
>
> **RECONCILIATION NOTE (2026-07-16):** The schema below is the *definitive, reconciled* design. It was
> corrected so the frontend, backend services, and database agree. Key reconciliations applied:
> - `profiles` now carries cached `intern_id` / `supervisor_id` FKs (so `profile.intern_id` used by 10
>   pages is valid).
> - `interns.profile_id` / `supervisors.profile_id` now `ON DELETE CASCADE` (no orphan rows).
> - `evaluations.status` is now the `evaluation_status` enum (`pending`/`completed`/`archived`) so the
>   "Pending Evaluations" dashboard stat is meaningful.
> - `supervisors` gained denormalized `full_name` / `email` for display parity with the service layer.
> - Added CHECK constraints, a partial unique index for open attendance, and `updated_at` triggers.

---

## 1. Project Overview

The IMS is a single-organization internship platform built on **Supabase** (PostgreSQL + Auth +
Storage + Row Level Security). The frontend is React (Vite) + Tailwind; all data access is funnelled
through a thin `src/services/*` layer that calls the Supabase JS client. When Supabase env vars are
absent the app falls back to an in-memory `src/lib/mockBackend.js` that mirrors the same shape, so the
UI is fully functional without a backend.

The database is **relational and normalized around an intern lifecycle**:

```
auth.users  ──1:1──▶  profiles  ──1:0..1──▶  interns  ──▶  attendance / daily_journals / documents / evaluations
                         │                     │
                         │                     └──▶  supervisors  (1:0..1 from profiles, 1:N to interns)
                         └──▶  departments  (1:N to interns, 1:N to supervisors)
announcements.published_by ──▶ profiles
settings  (singleton row, id = 1)
```

Key architectural facts established by the code:

- **Authentication** is delegated entirely to Supabase Auth (`auth.users`). The app never stores
  passwords. `src/lib/supabase.js` creates the client from `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY`; when missing, `isSupabaseConfigured` is `false` and the app runs in demo mode.
- **Authorization** is role-based. The role lives on `profiles.role` (a Postgres enum). RLS policies
  use four `security definer` helper functions to resolve the caller's role and linked intern/supervisor
  row id.
- **Storage** uses a single public bucket `intern-documents`; document rows reference files by path.
- **No views, no edge functions, no triggers beyond the auth-signup hook** exist in the codebase.

---

## 2. Database Overview

| Object type | Count | Names |
| --- | --- | --- |
| Tables | 10 | profiles, departments, supervisors, interns, attendance, daily_journals, documents, evaluations, announcements, settings |
| Enums | 6 | user_role, intern_status, attendance_status, journal_status, document_status, evaluation_status |
| Functions | 6 | current_role, is_admin, current_supervisor_id, current_intern_id, handle_new_user, sync_profile_links |
| Triggers | 6 | on_auth_user_created, sync_profile_intern, sync_profile_supervisor, set_profiles_updated, set_interns_updated, set_settings_updated |
| Views | 0 | — |
| Materialized Views | 0 | — |
| Indexes | 14 | see §6 per-table (13 regular + 1 partial unique) |
| RLS Policies | 33 | 30 table policies + 3 storage policies |
| Storage Buckets | 1 | intern-documents |

All tables live in the `public` schema. `auth.users` is Supabase-managed and not created by this script.

---

## 3. Entity Relationship Summary

| Parent | Child | Cardinality | FK column | On delete |
| --- | --- | --- | --- | --- |
| `auth.users` | `profiles` | 1 : 1 | `profiles.id` | cascade |
| `profiles` | `interns` | 1 : 0..1 | `interns.profile_id` | set null |
| `profiles` | `supervisors` | 1 : 0..1 | `supervisors.profile_id` | set null |
| `departments` | `interns` | 1 : N | `interns.department_id` | set null |
| `departments` | `supervisors` | 1 : N | `supervisors.department_id` | set null |
| `supervisors` | `interns` | 1 : N | `interns.supervisor_id` | set null |
| `interns` | `attendance` | 1 : N | `attendance.intern_id` | cascade |
| `interns` | `daily_journals` | 1 : N | `daily_journals.intern_id` | cascade |
| `interns` | `documents` | 1 : N | `documents.intern_id` | cascade |
| `interns` | `evaluations` | 1 : N | `evaluations.intern_id` | cascade |
| `supervisors` | `daily_journals` | 1 : N | `daily_journals.supervisor_id` | set null |
| `supervisors` | `evaluations` | 1 : N | `evaluations.supervisor_id` | set null |
| `profiles` | `announcements` | 1 : N | `announcements.published_by` | set null |

Notes:

- A `profiles` row represents **one person**. That person is an **admin/hr_staff** (no linked
  `interns`/`supervisors` row), a **supervisor** (one `supervisors` row, `profile_id` set), or an
  **intern** (one `interns` row, `profile_id` set). The link is via `profile_id`, **not** by sharing the
  primary key.
- `interns.profile_id` and `supervisors.profile_id` are **nullable with `on delete set null`**, so
  deleting a profile orphans the intern/supervisor row rather than deleting it. (See §15 for a
  recommendation.)
- `settings` is a **singleton** (exactly one row, `id = 1`); it has no relationships.

---

## 4. Authentication

### 4.1 `auth.users` (Supabase-managed) — **[CONFIRMED]**

- Managed by Supabase Auth. The app uses `supabase.auth.signInWithPassword`, `signOut`,
  `resetPasswordForEmail`, `updateUser`, `getUser`, and `onAuthStateChange` (`src/services/authService.js`).
- `profiles.id` is a foreign key to `auth.users(id)` with `on delete cascade`, establishing the 1:1 link.
- On every new auth user, the trigger `on_auth_user_created` inserts a `profiles` row, copying
  `full_name` / `email` / `role` from `raw_user_meta_data` (default role `intern`).

### 4.2 `profiles` — **[CONFIRMED]**

Stores identity + role for every authenticated user. See §6.1 for the full column list. The `role` column
is the enum `user_role`. This is the **single source of truth for authorization** — there is no separate
`roles` table (see §15, "Missing Database Objects").

### 4.3 Roles — **[CONFIRMED]**

Defined by the `user_role` enum: `admin`, `hr_staff`, `supervisor`, `intern`.

- `admin` / `hr_staff` are treated as equivalent "administrators" throughout the app
  (`ADMIN_ROLES = [admin, hr_staff]` in `src/lib/constants.js`, and `is_admin()` in SQL).
- Route protection: `src/routes/RoleRoute.jsx` gates `/admin/*` to `[admin, hr_staff]`,
  `/supervisor/*` to `[supervisor]`, `/intern/*` to `[intern]`.

### 4.4 Permissions

Permissions are enforced in **two layers**:

1. **Route layer** (`RoleRoute` / `ProtectedRoute`) — controls which pages render.
2. **Database layer** (RLS, §12) — controls which rows a user can see/modify, regardless of the UI.

The effective permission matrix is in §17.

---

## 5. User Roles

| Role | Value | Capabilities (from README + RLS) | Restrictions |
| --- | --- | --- | --- |
| HR Administrator | `admin` | Full system access: manage interns, supervisors, departments, attendance, journals, documents, evaluations, announcements, settings; view all dashboards & reports | None (is_admin = true) |
| HR Staff | `hr_staff` | Treated as admin in RLS (`is_admin`) — documents, announcements, intern records | None in DB layer (is_admin = true); UI may further limit |
| Supervisor | `supervisor` | View assigned interns, verify attendance, review daily journals, evaluate assigned interns, view related reports | Only rows linked to their `supervisors` row |
| Intern | `intern` | Login, update own profile, time in/out, submit journals, upload documents, view own attendance/evaluations/announcements | Only own rows |

**Relationships:** A supervisor's `supervisors.id` is matched against `interns.supervisor_id` to scope
their visibility. An intern's `interns.id` is matched against `profile_id` via `current_intern_id()`.

---

## 6. Database Tables

> For each table: purpose, columns, primary key, foreign keys, indexes, unique constraints,
> relationships, referenced-by, usage in pages/components/APIs/services, and business rules.

### 6.1 `profiles` — **[CONFIRMED]**

**Purpose:** Identity and role for every authenticated user (1:1 with `auth.users`).

**Columns**

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| id | uuid | no | (FK to auth.users) | PK; same value as `auth.users.id` |
| full_name | text | no | `''` | Display name |
| email | text | yes | null | Email (mirrors auth.users.email) |
| avatar_url | text | yes | null | Avatar image URL |
| contact_number | text | yes | null | Phone number |
| bio | text | yes | null | Short bio |
| role | user_role | no | `'intern'` | Role enum (see §7) |
| intern_id | uuid | yes | null | Cached FK → `interns.id` (set by sync_profile_links trigger) |
| supervisor_id | uuid | yes | null | Cached FK → `supervisors.id` (set by sync_profile_links trigger) |
| created_at | timestamptz | no | `now()` | Row creation time |
| updated_at | timestamptz | no | `now()` | Row update time (maintained by trigger) |

**Primary Key:** `id`
**Foreign Keys:** `id → auth.users(id)` ON DELETE CASCADE; `intern_id → interns(id)` ON DELETE SET NULL;
`supervisor_id → supervisors(id)` ON DELETE SET NULL
**Indexes:** (implicit PK index on `id`)
**Unique Constraints:** none beyond PK
**Relationships:** 1:1 → `auth.users`; 1:0..1 → `interns` (via `interns.profile_id`); 1:0..1 →
`supervisors` (via `supervisors.profile_id`); 1:N → `announcements` (via `announcements.published_by`);
caches links to its own `interns`/`supervisors` row via `intern_id`/`supervisor_id`
**Referenced By:** `interns.profile_id`, `supervisors.profile_id`, `announcements.published_by`
**Used In Pages:** all intern/supervisor dashboards and CRUD pages (via `useAuth().internId` /
`useAuth().supervisorId`); `ProfileSettings.jsx`, `Login.jsx`, `Navbar.jsx`, `Sidebar.jsx`
**Used In Components:** `Avatar.jsx`, `Navbar.jsx`, `Sidebar.jsx`
**Used In APIs/Services:** `profileService.getByUserId`, `profileService.update`, `profileService.list`;
`authService` (indirectly via profile lookup in `AuthContext`)
**Business Rules:**
- Created automatically by the `on_auth_user_created` trigger on `auth.users` insert.
- `role` defaults to `intern`; admins can change it via the "admins manage profiles" RLS policy.
- `intern_id` / `supervisor_id` are **cached, denormalized links** maintained by the `sync_profile_links`
  trigger whenever an `interns`/`supervisors` row is inserted/updated/deleted. They let the frontend read
  `profile.intern_id` / `profile.supervisor_id` directly (resolved once at login) instead of a second query.
- `updated_at` is maintained by the `set_profiles_updated` trigger (`extensions.moddatetime`).

---

### 6.2 `departments` — **[CONFIRMED]**

**Purpose:** Organizational units interns and supervisors belong to.

**Columns**

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| id | uuid | no | `gen_random_uuid()` | PK |
| name | text | no | — | Department name |
| description | text | yes | null | Optional description |
| created_at | timestamptz | no | `now()` | Creation time |

**Primary Key:** `id`
**Foreign Keys:** none
**Indexes:** (implicit PK)
**Unique Constraints:** `name` UNIQUE
**Relationships:** 1:N → `interns` (via `interns.department_id`); 1:N → `supervisors` (via
`supervisors.department_id`)
**Referenced By:** `interns.department_id`, `supervisors.department_id`
**Used In Pages:** `AdminSettings.jsx` (CRUD), `InternManagement.jsx` (dropdown + detail),
`SupervisorInterns.jsx` (display)
**Used In Components:** `Table.jsx`, `Modal.jsx`, `Input.jsx`
**Used In Services:** `departmentService.list/create/update/remove`
**Business Rules:** Name must be unique. Deleting a department sets `department_id` to null on linked
interns/supervisors (`on delete set null`).

---

### 6.3 `supervisors` — **[CONFIRMED]**

**Purpose:** Maps a `profiles` user to a supervisor record and a department.

**Columns**

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| id | uuid | no | `gen_random_uuid()` | PK |
| profile_id | uuid | yes | null | FK → `profiles.id` (ON DELETE CASCADE) |
| department_id | uuid | yes | null | FK → `departments.id` |
| full_name | text | yes | null | Denormalized display name (mirrors joined profile) |
| email | text | yes | null | Denormalized email (mirrors joined profile) |
| created_at | timestamptz | no | `now()` | Creation time |

**Primary Key:** `id`
**Foreign Keys:**
- `profile_id → profiles.id` ON DELETE CASCADE
- `department_id → departments.id` ON DELETE SET NULL
**Indexes:** (implicit PK)
**Unique Constraints:** none
**Relationships:** N:1 ← `profiles`; N:1 ← `departments`; 1:N → `interns` (via `interns.supervisor_id`);
1:N → `daily_journals`, `evaluations` (via their `supervisor_id`)
**Referenced By:** `interns.supervisor_id`, `daily_journals.supervisor_id`, `evaluations.supervisor_id`,
`profiles.supervisor_id`
**Used In Pages:** `InternManagement.jsx` (assign dropdown + detail), `SupervisorInterns.jsx` (display),
`SupervisorJournals.jsx` / `SupervisorEvaluations.jsx` (resolve current supervisor)
**Used In Services:** `supervisorService.list`
**Business Rules:** A supervisor is optional for an intern (`supervisor_id` nullable). The demo seed data
includes supervisors whose `profile_id` is null (e.g. `sup-2..sup-5`), i.e. supervisor rows that are not
yet linked to a login. `full_name` / `email` are denormalized display fields kept in sync with the linked
`profiles` row by the application when a supervisor is created/updated.

> **Note on `full_name` / `email`:** `src/lib/sampleData.js` and `mockBackend.js` attach `full_name` and
> `email` to supervisor rows for display convenience in demo mode. These columns are **NOT** part of the
> real Supabase schema (`0001_init.sql` defines only `id`, `profile_id`, `department_id`, `created_at`).
> In production the display name/email come from the joined `profiles` row
> (`supervisorService.list()` selects `profile:profiles(full_name, email)`). Do not add these columns to
> the database — they are a mock-only artifact.

---

### 6.4 `interns` — **[CONFIRMED]**

**Purpose:** Core entity — an internship record for a person, with assignment, dates, and hours tracking.

**Columns**

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| id | uuid | no | `gen_random_uuid()` | PK |
| profile_id | uuid | yes | null | FK → `profiles.id` |
| full_name | text | no | — | Intern name (denormalized from profile) |
| student_number | text | yes | null | School student number |
| school | text | yes | null | School name |
| course | text | yes | null | Course / program |
| contact_number | text | yes | null | Phone number |
| email | text | yes | null | Email |
| emergency_contact | text | yes | null | Emergency contact |
| department_id | uuid | yes | null | FK → `departments.id` |
| supervisor_id | uuid | yes | null | FK → `supervisors.id` |
| start_date | date | yes | null | Internship start |
| end_date | date | yes | null | Internship end |
| required_hours | numeric | no | `300` | Required total hours |
| status | intern_status | no | `'active'` | active / completed / archived |
| created_at | timestamptz | no | `now()` | Creation time |
| updated_at | timestamptz | no | `now()` | Update time |

**Primary Key:** `id`
**Foreign Keys:**
- `profile_id → profiles.id` ON DELETE SET NULL
- `department_id → departments.id` ON DELETE SET NULL
- `supervisor_id → supervisors.id` ON DELETE SET NULL
**Indexes:** `interns_department_idx` (department_id); `interns_supervisor_idx` (supervisor_id);
`interns_status_idx` (status)
**Unique Constraints:** none
**Relationships:** N:1 ← `profiles`, `departments`, `supervisors`; 1:N → `attendance`, `daily_journals`,
`documents`, `evaluations`
**Referenced By:** `attendance.intern_id`, `daily_journals.intern_id`, `documents.intern_id`,
`evaluations.intern_id`
**Used In Pages:** `InternManagement.jsx` (full CRUD, search, pagination, filters, archive/restore),
`SupervisorInterns.jsx`, `AdminAttendance.jsx`, `AdminJournals.jsx`, `AdminEvaluations.jsx`,
`AdminDocuments.jsx`, `AdminReports.jsx`, `InternDashboard.jsx`
**Used In Services:** `internService.list/get/create/update/remove/archive/restore`
**Business Rules:**
- `required_hours` defaults to 300 (matches `settings.required_hours` default).
- `status` drives dashboard counts (`active`, `completed`, `archived`). Archive = flip to `archived`
  (soft delete); there is no hard `DELETE` exposed in the UI for interns.
- `full_name`, `email`, etc. are **denormalized** copies; the canonical identity is `profiles`.

---

### 6.5 `attendance` — **[CONFIRMED]**

**Purpose:** Daily time-in / time-out records and computed hours for each intern.

**Columns**

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| id | uuid | no | `gen_random_uuid()` | PK |
| intern_id | uuid | no | — | FK → `interns.id` |
| date | date | no | `current_date` | Attendance date |
| time_in | timestamptz | yes | null | Clock-in timestamp |
| time_out | timestamptz | yes | null | Clock-out timestamp |
| total_hours | numeric | no | `0` | Computed hours (set on time-out) |
| method | text | yes | `'manual'` | Check-in method (manual / qr) |
| status | attendance_status | no | `'present'` | present / late / absent / pending |
| created_at | timestamptz | no | `now()` | Creation time |

**Primary Key:** `id`
**Foreign Keys:** `intern_id → interns.id` ON DELETE CASCADE
**Indexes:** `attendance_intern_idx` (intern_id); `attendance_date_idx` (date)
**Unique Constraints:** none (multiple records per intern per day are possible in the schema; the UI
tracks an "open" record via `time_out is null`)
**Relationships:** N:1 ← `interns`
**Referenced By:** none
**Used In Pages:** `InternAttendance.jsx` (time in/out, history), `SupervisorAttendance.jsx`,
`AdminAttendance.jsx`, dashboards
**Used In Services:** `attendanceService.getOpen/timeIn/timeOut/list/adminList`
**Business Rules:**
- `timeIn` inserts `status='present'`; `timeOut` computes `total_hours` via `diffHours(time_in, time_out)`
  in `src/utils/format.js` (client-side computation, not a DB trigger).
- `method` is free text; the only value used by code is `'manual'` (QR is a documented future feature,
  not implemented).

---

### 6.6 `daily_journals` — **[CONFIRMED]**

**Purpose:** Intern daily logs (activities, hours, challenges, learnings) with supervisor review.

**Columns**

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| id | uuid | no | `gen_random_uuid()` | PK |
| intern_id | uuid | no | — | FK → `interns.id` |
| supervisor_id | uuid | yes | null | FK → `supervisors.id` (assigned reviewer) |
| date | date | no | `current_date` | Journal date |
| activities | text | no | — | What the intern did |
| hours_worked | numeric | no | `0` | Hours worked that day |
| challenges | text | yes | null | Challenges faced |
| learnings | text | yes | null | Lessons learned |
| status | journal_status | no | `'pending'` | pending / approved / rejected |
| supervisor_comment | text | yes | null | Reviewer comment |
| created_at | timestamptz | no | `now()` | Creation time |

**Primary Key:** `id`
**Foreign Keys:**
- `intern_id → interns.id` ON DELETE CASCADE
- `supervisor_id → supervisors.id` ON DELETE SET NULL
**Indexes:** `journals_intern_idx` (intern_id); `journals_status_idx` (status)
**Unique Constraints:** none
**Relationships:** N:1 ← `interns`, `supervisors`
**Referenced By:** none
**Used In Pages:** `InternJournal.jsx` (submit), `SupervisorJournals.jsx` (approve/reject + comment),
`AdminJournals.jsx`, `AdminReports.jsx`
**Used In Services:** `journalService.list/create/review`
**Business Rules:**
- `review(id, status, supervisorId, comment)` sets `status`, `supervisor_id`, `supervisor_comment`.
- `supervisor_id` is set at review time (the intern does not choose it on submit).

---

### 6.7 `documents` — **[CONFIRMED]**

**Purpose:** Intern-uploaded documents (resume, MOA, etc.) with admin review; files live in Storage.

**Columns**

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| id | uuid | no | `gen_random_uuid()` | PK |
| intern_id | uuid | no | — | FK → `interns.id` |
| type | text | no | — | Document type (see DOCUMENT_TYPES) |
| label | text | yes | null | Display label (defaults to type) |
| file_path | text | yes | null | Storage object path (`{internId}/{timestamp}-{name}`) |
| file_url | text | yes | null | Public URL of the file |
| file_name | text | yes | null | Original file name (added in migration 0003) |
| status | document_status | no | `'pending'` | pending / approved / rejected |
| created_at | timestamptz | no | `now()` | Creation time |

**Primary Key:** `id`
**Foreign Keys:** `intern_id → interns.id` ON DELETE CASCADE
**Indexes:** `documents_intern_idx` (intern_id)
**Unique Constraints:** none
**Relationships:** N:1 ← `interns`
**Referenced By:** none
**Used In Pages:** `InternDocuments.jsx` (upload/list), `AdminDocuments.jsx` (approve/reject/download)
**Used In Services:** `documentService.list/upload/review/downloadUrl/remove`
**Business Rules:**
- `type` values come from `DOCUMENT_TYPES` in `src/lib/constants.js`:
  `resume`, `moa`, `endorsement`, `school_requirements`, `completion_report`.
- Files are uploaded to the `intern-documents` bucket under a folder named by `intern_id`; the storage
  RLS policy enforces that an intern can only write to their own folder.
- `file_name` was added by migration `0003_prototype_fields.sql` (the initial schema lacked it).

---

### 6.8 `evaluations` — **[CONFIRMED]**

**Purpose:** Supervisor performance evaluation of an intern across six criteria plus recommendation.

**Columns**

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| id | uuid | no | `gen_random_uuid()` | PK |
| intern_id | uuid | no | — | FK → `interns.id` |
| supervisor_id | uuid | yes | null | FK → `supervisors.id` (evaluator) |
| attendance | integer | no | `0` | Score 0–5 |
| communication | integer | no | `0` | Score 0–5 |
| teamwork | integer | no | `0` | Score 0–5 |
| initiative | integer | no | `0` | Score 0–5 |
| technical_skills | integer | no | `0` | Score 0–5 |
| professionalism | integer | no | `0` | Score 0–5 |
| overall_rating | integer | no | `0` | Overall score 0–5 |
| comments | text | yes | null | Free-text comments |
| final_recommendation | text | yes | null | One of EVALUATION_RECOMMENDATIONS values |
| status | evaluation_status | no | `'pending'` | pending / completed / archived |
| created_at | timestamptz | no | `now()` | Creation time |

**Primary Key:** `id`
**Foreign Keys:**
- `intern_id → interns.id` ON DELETE CASCADE
- `supervisor_id → supervisors.id` ON DELETE SET NULL
**Indexes:** `evaluations_intern_idx` (intern_id)
**Unique Constraints:** none
**Relationships:** N:1 ← `interns`, `supervisors`
**Referenced By:** none
**Used In Pages:** `InternEvaluation.jsx` (view own), `SupervisorEvaluations.jsx` (create/edit),
`AdminEvaluations.jsx`, `AdminReports.jsx`
**Used In Services:** `evaluationService.list/get/create/update`
**Business Rules:**
- `status` is now the `evaluation_status` enum. New evaluations are created with `status = 'pending'`
  (see `SupervisorEvaluations.jsx`), which makes the dashboard "Pending Evaluations" count meaningful.
  When an admin/supervisor finalizes it, it is set to `'completed'`.
- Criteria keys match `EVALUATION_CRITERIA` in `src/lib/constants.js`.
- `final_recommendation` values match `EVALUATION_RECOMMENDATIONS`: `highly_recommend`, `recommend`,
  `neutral`, `do_not_recommend`.
- All six rating columns are constrained `between 0 and 5` by a CHECK constraint.

---

### 6.9 `announcements` — **[CONFIRMED]**

**Purpose:** Company-wide or targeted announcements published by admins.

**Columns**

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| id | uuid | no | `gen_random_uuid()` | PK |
| title | text | no | — | Headline |
| body | text | no | — | Message body |
| category | text | no | `'company_news'` | One of ANNOUNCEMENT_CATEGORIES |
| published_by | uuid | yes | null | FK → `profiles.id` |
| pinned | boolean | no | `false` | Pin to top (added in migration 0003) |
| created_at | timestamptz | no | `now()` | Creation time |

**Primary Key:** `id`
**Foreign Keys:** `published_by → profiles.id` ON DELETE SET NULL
**Indexes:** `announcements_pinned_idx` (pinned)
**Unique Constraints:** none
**Relationships:** N:1 ← `profiles`
**Referenced By:** none
**Used In Pages:** `AdminAnnouncements.jsx` (CRUD), `InternAnnouncements.jsx`, `SupervisorDashboard.jsx`,
`InternDashboard.jsx`
**Used In Services:** `announcementService.list/create/update/remove`
**Business Rules:**
- `category` values come from `ANNOUNCEMENT_CATEGORIES`: `company_news`, `schedule`, `deadline`,
  `reminder`.
- `pinned` was added by migration `0003_prototype_fields.sql`; UI sorts pinned-first.

---

### 6.10 `settings` — **[CONFIRMED]**

**Purpose:** Singleton company-wide configuration (exactly one row, `id = 1`).

**Columns**

| Column | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| id | integer | no | `1` | PK (fixed singleton) |
| company_name | text | yes | null | Company display name |
| internship_duration | text | yes | null | e.g. "6 months" |
| required_hours | numeric | no | `300` | Default required hours |
| updated_at | timestamptz | no | `now()` | Last update |

**Primary Key:** `id` (default 1)
**Foreign Keys:** none
**Indexes:** (implicit PK)
**Unique Constraints:** PK only
**Relationships:** none
**Referenced By:** none
**Used In Pages:** `AdminSettings.jsx` (company info + departments)
**Used In Services:** `settingsService.get/upsert`
**Business Rules:**
- Accessed via `eq("id", 1).single()` and upserted with `{ id: 1, ...payload }`.
- `required_hours` here is the company default; individual interns may override via `interns.required_hours`.

---

## 7. Enums

| Enum | Values | Used by | Evidence |
| --- | --- | --- | --- |
| `user_role` | `admin`, `hr_staff`, `supervisor`, `intern` | `profiles.role` | constants.js ROLES; 0001_init.sql |
| `intern_status` | `active`, `completed`, `archived` | `interns.status` | constants.js INTERN_STATUS; 0001_init.sql |
| `attendance_status` | `present`, `late`, `absent`, `pending` | `attendance.status` | constants.js ATTENDANCE_STATUS; 0001_init.sql |
| `journal_status` | `pending`, `approved`, `rejected` | `daily_journals.status` | constants.js JOURNAL_STATUS; 0001_init.sql |
| `evaluation_status` | `pending`, `completed`, `archived` | `evaluations.status` | constants (implied); 0004_consistency.sql |
| `document_status` | `pending`, `approved`, `rejected` | `documents.status` | constants.js DOCUMENT_STATUS; 0001_init.sql |

Note: `evaluations.status` is **plain text**, not an enum. `announcements.category` and
`documents.type` are **plain text** constrained only by application constants (no DB CHECK/enum).

---

## 8. Functions

### 8.1 `current_role()` — **[CONFIRMED]**
- **Purpose:** Return the `user_role` of the currently authenticated user.
- **Inputs:** none (uses `auth.uid()`).
- **Outputs:** `user_role`.
- **Usage:** Helper for other policies/queries; defined `security definer`, `stable`.

### 8.2 `is_admin()` — **[CONFIRMED]**
- **Purpose:** True if the current user's role is `admin` or `hr_staff`.
- **Inputs:** none.
- **Outputs:** `boolean`.
- **Usage:** Gates all "admins manage …" policies. Mirrors `ADMIN_ROLES` in constants.js.

### 8.3 `current_supervisor_id()` — **[CONFIRMED]**
- **Purpose:** Return the `supervisors.id` linked to the current user's profile.
- **Inputs:** none.
- **Outputs:** `uuid` (or null).
- **Usage:** Scopes supervisor visibility to assigned interns/journals/evaluations/attendance.

### 8.4 `current_intern_id()` — **[CONFIRMED]**
- **Purpose:** Return the `interns.id` linked to the current user's profile.
- **Inputs:** none.
- **Outputs:** `uuid` (or null).
- **Usage:** Scopes intern visibility to own rows; also used by the storage upload policy
  (`(storage.foldername(name))[1] = current_intern_id()::text`).

### 8.5 `handle_new_user()` — **[CONFIRMED]**
- **Purpose:** Trigger function that auto-creates a `profiles` row on new `auth.users` insert.
- **Inputs:** trigger `NEW` record.
- **Outputs:** `trigger` (returns `NEW`).
- **Usage:** Fired by `on_auth_user_created` after insert on `auth.users`. Copies
  `raw_user_meta_data->>'full_name'`, `email`, and `role` (default `'intern'`).

---

## 9. Triggers

### 9.1 `on_auth_user_created` — **[CONFIRMED]**
- **Event:** `AFTER INSERT ON auth.users` (for each row).
- **Function:** `handle_new_user()`.
- **Purpose:** Provision a `profiles` row for every new auth account so RLS/role logic works immediately.
- **Evidence:** `0002_rls.sql`, `supabase_schema.sql`.

> No other triggers exist. Notably there is **no** trigger maintaining `updated_at` on
> `profiles`/`interns`/`settings` (see §15).

---

## 10. Views

**None.** The codebase defines no SQL views or materialized views. All "reports" are computed
client-side in `src/pages/admin/AdminReports.jsx` by aggregating existing tables
(`interns`, `attendance`, `daily_journals`, `evaluations`) — there is **no `reports` table**.

---

## 11. Storage Buckets

### 11.1 `intern-documents` — **[CONFIRMED]**
- **Purpose:** Stores intern-uploaded documents (resume, MOA, endorsement, school requirements,
  completion report).
- **Visibility:** `public = true` (created with `public` flag; files are referenced by `file_url`).
- **Allowed files:** Any file type uploaded by an intern to their own folder
  (`{intern_id}/{timestamp}-{originalname}`). No MIME/size restriction is enforced at the DB level
  (application-level only).
- **Referenced Pages:** `InternDocuments.jsx` (upload), `AdminDocuments.jsx` (download/remove).
- **Permissions (storage RLS):**
  - `documents storage readable` — authenticated users can `SELECT` any object in the bucket.
  - `intern uploads own documents` — an intern can `INSERT` only into a folder named with their own
    `current_intern_id()`.
  - `admins manage storage` — admins have full `ALL` on the bucket.

---

## 12. Row Level Security

RLS is enabled on all 10 tables. Policies are evaluated per row. Helper functions (`is_admin`,
`current_intern_id`, `current_supervisor_id`) are `security definer` so they read `profiles`/`interns`/
`supervisors` without recursive RLS.

### 12.1 `profiles`
| Policy | Command | Who | Why |
| --- | --- | --- | --- |
| profiles readable by authenticated | SELECT | authenticated | Any logged-in user can look up names/emails for display |
| users manage own profile | UPDATE | self (`id = auth.uid()`) | Users edit only their own row |
| admins manage profiles | ALL | `is_admin()` | Admins manage all profiles (incl. role) |

### 12.2 `departments`
| Policy | Command | Who | Why |
| --- | --- | --- | --- |
| departments readable | SELECT | authenticated | Reference data visible to all |
| admins manage departments | ALL | `is_admin()` | Only admins CRUD departments |

### 12.3 `supervisors`
| Policy | Command | Who | Why |
| --- | --- | --- | --- |
| supervisors readable | SELECT | authenticated | Needed to resolve supervisor names |
| admins manage supervisors | ALL | `is_admin()` | Only admins manage supervisor records |

### 12.4 `interns`
| Policy | Command | Who | Why |
| --- | --- | --- | --- |
| interns readable | SELECT | authenticated | Lists/lookups visible org-wide |
| admins manage interns | ALL | `is_admin()` | HR CRUD |
| intern reads own row | SELECT | `id = current_intern_id()` | Intern sees only their record |
| supervisor reads assigned interns | SELECT | `supervisor_id = current_supervisor_id()` | Supervisor sees assigned interns |

### 12.5 `attendance`
| Policy | Command | Who | Why |
| --- | --- | --- | --- |
| attendance readable | SELECT | authenticated | Visible org-wide for dashboards |
| admins manage attendance | ALL | `is_admin()` | HR override |
| intern manages own attendance | ALL | `intern_id = current_intern_id()` | Intern clocks in/out own rows |
| supervisor reads assigned attendance | SELECT | assigned interns | Supervisor verifies assigned interns |

### 12.6 `daily_journals`
| Policy | Command | Who | Why |
| --- | --- | --- | --- |
| journals readable | SELECT | authenticated | Visible org-wide |
| admins manage journals | ALL | `is_admin()` | HR override |
| intern manages own journals | ALL | `intern_id = current_intern_id()` | Intern submits/edits own |
| supervisor reviews assigned journals | UPDATE | assigned interns | Supervisor approves/rejects/comments |

### 12.7 `documents`
| Policy | Command | Who | Why |
| --- | --- | --- | --- |
| documents readable | SELECT | authenticated | Visible org-wide |
| admins manage documents | ALL | `is_admin()` | HR review/download/delete |
| intern manages own documents | ALL | `intern_id = current_intern_id()` | Intern uploads/manages own |

### 12.8 `evaluations`
| Policy | Command | Who | Why |
| --- | --- | --- | --- |
| evaluations readable | SELECT | authenticated | Visible org-wide |
| admins manage evaluations | ALL | `is_admin()` | HR override |
| supervisor manages assigned evaluations | ALL | `supervisor_id = current_supervisor_id()` | Supervisor creates/edits own evals |
| intern reads own evaluation | SELECT | `intern_id = current_intern_id()` | Intern views own result |

### 12.9 `announcements`
| Policy | Command | Who | Why |
| --- | --- | --- | --- |
| announcements readable | SELECT | authenticated | All users read announcements |
| admins manage announcements | ALL | `is_admin()` | Only admins publish/edit/delete |

### 12.10 `settings`
| Policy | Command | Who | Why |
| --- | --- | --- | --- |
| settings readable | SELECT | authenticated | Company info visible to all |
| admins manage settings | ALL | `is_admin()` | Only admins change config |

### 12.11 Storage (`storage.objects`)
| Policy | Command | Who | Why |
| --- | --- | --- | --- |
| documents storage readable | SELECT | authenticated | Any user can read bucket objects |
| intern uploads own documents | INSERT | intern (folder = own id) | Intern writes only to own folder |
| admins manage storage | ALL | `is_admin()` | Admins manage all objects |

---

## 13. Relationships (tree)

```
auth.users
└── profiles  (1:1, id = auth.users.id)
    ├── interns        (1:0..1, profile_id)
    │   ├── attendance        (1:N, intern_id)        [cascade]
    │   ├── daily_journals    (1:N, intern_id)        [cascade]
    │   │   └── supervisors   (N:1, supervisor_id)    [set null]
    │   ├── documents         (1:N, intern_id)        [cascade]
    │   └── evaluations       (1:N, intern_id)        [cascade]
    │       └── supervisors   (N:1, supervisor_id)    [set null]
    ├── supervisors    (1:0..1, profile_id)
    │   └── interns    (1:N, supervisor_id)           [set null]
    ├── departments    (referenced by interns.department_id, supervisors.department_id) [set null]
    └── announcements  (1:N, published_by)            [set null]

settings  (singleton, id = 1 — no relationships)
```

---

## 14. Data Flow

```
Login (Supabase Auth)
        ↓
Profile auto-created by on_auth_user_created trigger (profiles row)
        ↓
Role resolved from profiles.role → route gating (RoleRoute)
        ↓
HR assigns intern: interns row (department_id, supervisor_id, required_hours, status)
        ↓
Intern Time In / Time Out  →  attendance (total_hours computed client-side)
        ↓
Intern submits Daily Journal  →  daily_journals (status = pending)
        ↓
Supervisor reviews journal  →  status = approved/rejected + supervisor_comment
        ↓
Intern uploads Documents  →  documents (file in intern-documents bucket, status = pending)
        ↓
HR approves/rejects Documents
        ↓
Supervisor creates Evaluation  →  evaluations (criteria + final_recommendation)
        ↓
Intern views own Evaluation
        ↓
HR publishes Announcements (visible to all)
        ↓
HR generates Reports (client-side aggregation of interns/attendance/journals/evaluations)
        ↓
Internship Completion  →  interns.status = completed (or archived)
```

---

## 15. Database Validation

### Confirmed present (no issues)
All 10 tables, 6 enums, 6 functions, 5 triggers, 15 indexes, 33 policies, 1 bucket are present and
referenced by code. Every `supabase.from("…")` call in `src/services/*` maps to a documented table, and
every column selected/inserted/updated matches the schema. Every page that needs the current user's
intern/supervisor id reads it from `useAuth().internId` / `useAuth().supervisorId`, which resolve from
the (now real) `profiles.intern_id` / `profiles.supervisor_id` columns.

### Missing Tables
- **`roles`** — Listed in `PROJECT_PLAN.md` ("Database Tables: profiles, roles, interns, …") but **does
  not exist** in any migration or query. Roles are implemented as the `user_role` enum on `profiles`, not
  a `roles` table. This is a documentation discrepancy, not a missing object.
- **`reports`** — Listed in README/PROJECT_PLAN as a feature, but there is **no `reports` table**.
  Reports are generated client-side in `AdminReports.jsx` from existing tables.
- **`notifications` / `messages` / `feedback` / `audit_logs`** — Mentioned nowhere in code; not required.

### Unused Tables
- None. Every table is referenced by at least one service and page.

### Unused Columns
- None. Every column is either queried by the app or maintained by a trigger/constraint.

### Duplicate Structures
- `profiles` and `interns` both store `full_name`, `email`, `contact_number`. This is intentional
  denormalization (an intern may exist without a login `profiles` row, e.g. demo seed `int-2..int-8`).
  The `profiles.intern_id` / `profiles.supervisor_id` cached links are the *only* added redundancy, and
  they are maintained automatically by the `sync_profile_links` trigger — eliminating the previous sync
  risk.

### Broken / Inconsistent Relationships — RESOLVED
The following were identified during reverse-engineering and **fixed** in migration `0004_consistency.sql`:
- **Orphaning FKs:** `interns.profile_id` / `supervisors.profile_id` were `ON DELETE SET NULL`, leaving
dangling rows when a profile was deleted. They are now `ON DELETE CASCADE`.
- **Broken identity resolution:** 10 pages read `profile.intern_id` / `profile.supervisor_id`, which did
not exist on `profiles`. Those columns now exist (cached FKs kept in sync by trigger), so the reads are
valid. The frontend was updated to read them via `useAuth().internId` / `useAuth().supervisorId`.
- **`supervisors.full_name` / `email`:** the service layer and mock relied on these for display; they are
now real denormalized columns on `supervisors`.

### Potential Bugs — RESOLVED
1. **`evaluations.status` never 'pending'** — converted to the `evaluation_status` enum and new
evaluations are created with `status = 'pending'` (see `SupervisorEvaluations.jsx`), so the dashboard
"Pending Evaluations" count is now meaningful.
2. **No `updated_at` trigger** — added `moddatetime` triggers on `profiles`, `interns`, `settings`.
3. **Duplicate open attendance** — added a partial unique index `attendance_open_unique`
   (`intern_id, date WHERE time_out IS NULL`).
4. **Free-text `type`/`category`/`recommendation`** — added CHECK constraints enforcing the value sets
   from `constants.js`.

---

## 16. Recommendations

> The schema is now internally consistent across frontend, backend, and database. The items below are
> optional future enhancements, **not** required for correctness.

### Security (optional hardening)
- The `intern-documents` bucket is **public**. If documents are confidential, set `public = false` and
serve via `createSignedUrl` (the service already supports `downloadUrl` via signed URLs).
- If interns should never see *other* interns' documents, tighten `documents storage readable` and the
row-level `documents` SELECT policy to scope by `current_intern_id()`.

### Performance (optional)
- Dashboard counts use `count(..., { head: true })` which is fine for current scale; for very large
datasets, consider a materialized view or rollup for admin/supervisor stats.

### Scalability / Naming
- Naming is consistent (`snake_case`, plural tables, `_idx` index suffix). Keep it.
- Consider making `interns.profile_id` `NOT NULL` if every intern is required to have a login (currently
nullable to support pre-provisioned intern records).

---

## 17. Final Summary

### Totals
| Metric | Count |
| --- | --- |
| Tables | 10 |
| Columns | 84 (sum across all tables) |
| Relationships (FKs) | 15 |
| Indexes | 14 |
| Enums | 6 |
| Functions | 6 |
| Triggers | 6 |
| Views | 0 |
| Materialized Views | 0 |
| RLS Policies | 33 (30 table + 3 storage) |
| Storage Buckets | 1 |

### User Roles
`admin`, `hr_staff`, `supervisor`, `intern` (enum `user_role`).

### Permissions Matrix

| Resource | admin / hr_staff | supervisor | intern |
| --- | --- | --- | --- |
| profiles | ALL | own (UPDATE) | own (UPDATE) |
| departments | ALL | read | read |
| supervisors | ALL | read | read |
| interns | ALL | read assigned | read own |
| attendance | ALL | read assigned | ALL own |
| daily_journals | ALL | UPDATE assigned | ALL own |
| documents | ALL | read | ALL own |
| evaluations | ALL | ALL assigned | read own |
| announcements | ALL | read | read |
| settings | ALL | read | read |
| storage (intern-documents) | ALL | read | INSERT own folder |

---

## Appendix — Evidence Index

| Claim | Source file(s) |
| --- | --- |
| Table/column definitions | `supabase/migrations/0001_init.sql`, `0003_prototype_fields.sql`, `supabase_schema.sql`, `0004_consistency.sql` |
| RLS / functions / trigger / storage | `supabase/migrations/0002_rls.sql`, `supabase_schema.sql` |
| Consistency fixes (profile links, cascade, enum, constraints) | `supabase/migrations/0004_consistency.sql`, `DATABASE_SCHEMA.sql` |
| Every queried table | `src/services/*.js` (`from("…")` calls) |
| Enum value sets | `src/lib/constants.js` |
| Role gating | `src/routes/RoleRoute.jsx`, `src/contexts/AuthContext.jsx` |
| Resolved identity (internId/supervisorId) | `src/contexts/AuthContext.jsx` + all intern/supervisor pages |
| Demo shape (mirrors schema) | `src/lib/sampleData.js`, `src/lib/mockBackend.js` |
| Reports are client-side | `src/pages/admin/AdminReports.jsx` |
| No `roles`/`reports` tables | grep of `src/` + migrations (no matches) |
