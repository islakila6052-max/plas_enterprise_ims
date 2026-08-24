-- Wipe everything in the public schema (tables, views, functions, data)
-- so migrations can be applied cleanly from 0001.
drop schema public cascade;
create schema public;

-- Restore default grants Supabase expects
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
