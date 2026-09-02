-- Local dev admin for `compose.yaml`. Not used by `supabase db reset`, CI, or
-- any hosted project — only the compose `migrate` one-shot runs this.
--
--   email     editor@example.com
--   password  password
--
-- Gets every permission in the catalog via a role bundle + assignment, so the
-- Custom Access Token hook stamps them into the JWT on sign-in and the cms is
-- fully usable.

create extension if not exists pgcrypto with schema extensions;

\set dev_user_id  '11111111-1111-1111-1111-111111111111'
\set dev_bundle_id '22222222-2222-2222-2222-222222222222'

-- 1. The auth user. GoTrue has already migrated the auth schema.
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  :'dev_user_id', 'authenticated', 'authenticated', 'editor@example.com',
  extensions.crypt('password', extensions.gen_salt('bf')), now(),
  now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  false, false
)
on conflict (id) do nothing;

-- 2. The email identity row GoTrue expects alongside a password user.
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values (
  :'dev_user_id', :'dev_user_id',
  jsonb_build_object(
    'sub', :'dev_user_id',
    'email', 'editor@example.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email', now(), now(), now()
)
on conflict (provider, provider_id) do nothing;

-- 3. A permission bundle holding the whole catalog, and the assignment.
insert into public.config_bundles (id, vocabulary, name, updated_by)
values (:'dev_bundle_id', 'permission', 'Local dev admin', :'dev_user_id')
on conflict (id) do nothing;

insert into public.role_permissions (bundle_id, permission)
values
  (:'dev_bundle_id', 'manage:content'),
  (:'dev_bundle_id', 'manage:roles'),
  (:'dev_bundle_id', 'manage:routes'),
  (:'dev_bundle_id', 'view:audit')
on conflict do nothing;

insert into public.user_roles (user_id, bundle_id)
values (:'dev_user_id', :'dev_bundle_id')
on conflict do nothing;
