-- Who holds which role, and when their permissions last changed.

create table public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  bundle_id  uuid not null references public.config_bundles (id) on delete cascade,
  granted_at timestamptz not null default now(),
  -- Nullable: the seed grants the first administrator, and no human did that.
  granted_by uuid,
  primary key (user_id, bundle_id)
);

create index user_roles_by_bundle on public.user_roles (bundle_id);

-- The counterpart to `Session.issuedAt`.
--
-- Custom claims are baked into an access token when it is issued and cannot be
-- reached afterwards, so a permission revoked at 10:00 stays in a token minted
-- at 09:59 until it expires. `areClaimsStale()` compares the token's issue
-- time against this value; a route that guards something sensitive can then
-- force a refresh instead of trusting a claim it can see is out of date.
--
-- A separate table rather than a column on a profile row, because the auth
-- hook reads it on every token issue and it is written by triggers — keeping
-- it narrow keeps both cheap.
create table public.user_permission_state (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  permissions_updated_at timestamptz not null default now()
);

alter table public.user_roles            enable row level security;
alter table public.user_permission_state enable row level security;

-- Marks a set of users as having had their permissions change.
--
-- Upserts because a user with no state row yet is the normal case: rows appear
-- the first time something about a subject's access changes, not at signup.
create function public.touch_permission_state(p_user_ids uuid[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.user_permission_state (user_id, permissions_updated_at)
  select unnest(p_user_ids), now()
  on conflict (user_id) do update set permissions_updated_at = now();
$$;

comment on function public.touch_permission_state is
  'Records that the named subjects'' effective permissions changed, so stale access tokens can be detected.';

-- Granting or revoking a role changes exactly one subject's access.
create function public.user_roles_touch_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.touch_permission_state(array[coalesce(new.user_id, old.user_id)]);
  return null;
end;
$$;

create trigger user_roles_touch_state
  after insert or update or delete on public.user_roles
  for each row execute function public.user_roles_touch_state();

-- Editing a role's permissions changes access for everyone holding it, which
-- is the case that is easy to forget and the reason this is a trigger rather
-- than something the writer remembers to call.
--
-- Bundle *deletion* is handled explicitly in `delete_config_bundle` instead:
-- deleting a bundle cascades into both `role_permissions` and `user_roles`,
-- and nothing guarantees this trigger runs while there are still holders left
-- to find.
create function public.role_permissions_touch_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.touch_permission_state(
    array(
      select user_id
      from public.user_roles
      where bundle_id = coalesce(new.bundle_id, old.bundle_id)
    )
  );
  return null;
end;
$$;

create trigger role_permissions_touch_state
  after insert or update or delete on public.role_permissions
  for each row execute function public.role_permissions_touch_state();
