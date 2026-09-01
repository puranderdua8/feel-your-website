-- The Custom Access Token hook.
--
-- Supabase Auth calls this as it mints each access token, and whatever it
-- returns becomes the token's claims. This is what makes `Session.permissions`
-- readable without a database round trip on every request, and what lets RLS
-- policies decide using `has_permission()` alone.
--
-- Registered in `supabase/config.toml` for local development, and under
-- Authentication → Hooks for a hosted project. Registration is not part of the
-- schema, so a database restored without it authenticates fine and authorises
-- nothing — see the startup check in the app.

create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user_id     uuid := (event ->> 'user_id')::uuid;
  v_permissions jsonb;
  v_updated_at  timestamptz;
  v_claims      jsonb;
begin
  select coalesce(jsonb_agg(p order by p), '[]'::jsonb)
    into v_permissions
    from public.effective_permissions(v_user_id) as p;

  select ups.permissions_updated_at
    into v_updated_at
    from public.user_permission_state ups
   where ups.user_id = v_user_id;

  v_claims := event -> 'claims';
  v_claims := jsonb_set(v_claims, '{app_permissions}', v_permissions);

  -- JSON null, not absent, when nothing has ever changed this subject's
  -- access. `areClaimsStale()` reads null as "no reason to suspect the token",
  -- so the distinction between "never changed" and "changed long ago" is
  -- carried rather than flattened.
  v_claims := jsonb_set(
    v_claims,
    '{permissions_updated_at}',
    coalesce(to_jsonb(v_updated_at), 'null'::jsonb)
  );

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

comment on function public.custom_access_token_hook is
  'Stamps effective permissions into each access token. Called by Supabase Auth as supabase_auth_admin.';

-- Least privilege for the hook, following Supabase's documented pattern: the
-- auth admin is granted exactly the reads the hook performs, rather than the
-- function being made SECURITY DEFINER.
--
-- The difference matters for a boilerplate that gets copied: DEFINER is one
-- line shorter and means every future edit to this function runs as the table
-- owner, bypassing RLS on anything it happens to touch. The grants below fail
-- loudly instead.
grant usage on schema public to supabase_auth_admin;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant execute on function public.effective_permissions(uuid)     to supabase_auth_admin;

-- The hook must never be callable by a client: it is the thing that decides
-- what a client may do.
revoke execute on function public.custom_access_token_hook(jsonb) from anon, authenticated, public;

grant select on table public.user_roles            to supabase_auth_admin;
grant select on table public.config_bundles        to supabase_auth_admin;
grant select on table public.role_permissions      to supabase_auth_admin;
grant select on table public.user_permission_state to supabase_auth_admin;

-- Grants alone are not enough: RLS is enabled on all four, and a table with
-- RLS on and no matching policy denies everything.
create policy user_roles_auth_admin_read
  on public.user_roles for select to supabase_auth_admin using (true);

create policy config_bundles_auth_admin_read
  on public.config_bundles for select to supabase_auth_admin using (true);

create policy role_permissions_auth_admin_read
  on public.role_permissions for select to supabase_auth_admin using (true);

create policy user_permission_state_auth_admin_read
  on public.user_permission_state for select to supabase_auth_admin using (true);
