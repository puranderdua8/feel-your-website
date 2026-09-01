-- The permission catalog's Postgres mirror.
--
-- Code stays authoritative: `PLATFORM_PERMISSIONS` in @feel-your-website/rbac
-- defines the vocabulary and `supabase/seed/permissions.sql` is generated from
-- it. This table exists so the database can do the two things code cannot —
-- enforce referential integrity on grants, and let RLS join against the
-- vocabulary. See the drift section of the README for what that costs.

create table public.permissions (
  name        text primary key,
  description text not null,
  "group"     text
);

comment on table public.permissions is
  'Derived, one-directional mirror of the code permission catalog. Never edit by hand: regenerate supabase/seed/permissions.sql.';

alter table public.permissions enable row level security;

-- Readable by everyone signed in, because the role editor renders these
-- descriptions. There is nothing sensitive here — it is a list of the names of
-- gates, not of who holds them.
create policy permissions_read
  on public.permissions
  for select
  to authenticated
  using (true);

-- Writes are not merely unpolicied but ungranted. Supabase's default
-- privileges hand every new public table to anon/authenticated, so an RLS
-- policy is the only thing standing between them and this table — and a
-- policy is one review mistake away from being widened. Revoking the grant
-- means even a policy that said `using (true)` could not write.
--
-- The generated seed runs as the migration role, which is unaffected by both.
revoke insert, update, delete on public.permissions from anon, authenticated;
