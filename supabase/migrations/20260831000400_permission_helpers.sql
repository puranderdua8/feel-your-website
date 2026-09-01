-- Reading permissions: from the database, and from the token.
--
-- Two functions that look similar and must not be confused.
--
--   effective_permissions() is the truth. It walks role assignments and is
--   what the auth hook stamps into a new token.
--
--   has_permission() is what the token *says*, and is therefore the cheap one
--   — no joins, no round trip to the tables — which is why it is what RLS
--   policies use. It can be out of date by at most one token lifetime; that
--   window is exactly what `permissions_updated_at` exists to expose.

create function public.effective_permissions(p_user_id uuid)
returns setof text
language sql
stable
set search_path = ''
as $$
  select distinct rp.permission
  from public.user_roles ur
  join public.config_bundles cb
    on cb.id = ur.bundle_id
   -- A role assignment can only ever mean a permission bundle. Filtering
   -- rather than assuming, because `user_roles.bundle_id` is structurally
   -- free to point at a route bundle.
   and cb.vocabulary = 'permission'
  join public.role_permissions rp
    on rp.bundle_id = ur.bundle_id
  where ur.user_id = p_user_id;
$$;

comment on function public.effective_permissions is
  'The permissions a subject actually holds, resolved from role assignments. The authority; has_permission() is the token''s cached view of it.';

create function public.has_permission(p_permission text)
returns boolean
language sql
stable
set search_path = ''
as $$
  -- `auth.jwt()` yields '{}' when there is no token at all, so an anonymous
  -- caller falls through to false rather than erroring.
  select jsonb_exists(
    coalesce(auth.jwt() -> 'app_permissions', '[]'::jsonb),
    p_permission
  );
$$;

comment on function public.has_permission is
  'Whether the caller''s access token carries this permission. Used by RLS policies.';
