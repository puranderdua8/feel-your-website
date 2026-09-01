-- Read access to the config-bundle substrate.
--
-- A separate migration rather than added alongside the tables in
-- `..._config_bundles.sql`, because these policies call `has_permission()`,
-- which is not defined until `..._permission_helpers.sql`.
--
-- Enabling RLS with no policy denies everyone, including
-- `published_route_manifest` — that view is declared `security_invoker`
-- (deliberately, to avoid the RLS-bypass footgun a definer view would be), so
-- it sees exactly what the querying role can see on the tables it joins. Without
-- these, a real site visitor would get zero rows back for a manifest that
-- exists.

-- config_bundles: template_key rows are visible to anyone once published, and
-- to route authors always (so they can see their own drafts). permission
-- rows (roles) are visible only to role authors — nobody browsing the site
-- needs to know a role bundle's header exists.
create policy config_bundles_read_published_routes
  on public.config_bundles
  for select
  to anon, authenticated
  using (
    vocabulary = 'template_key'
    and exists (
      select 1 from public.route_bundles rb
      where rb.bundle_id = config_bundles.id and rb.published
    )
  );

create policy config_bundles_read_route_authors
  on public.config_bundles
  for select
  to authenticated
  using (vocabulary = 'template_key' and public.has_permission('manage:routes'));

create policy config_bundles_read_role_authors
  on public.config_bundles
  for select
  to authenticated
  using (vocabulary = 'permission' and public.has_permission('manage:roles'));

-- route_bundles: published rows are the manifest; drafts are for authors only.
create policy route_bundles_read_published
  on public.route_bundles
  for select
  to anon, authenticated
  using (published);

create policy route_bundles_read_authors
  on public.route_bundles
  for select
  to authenticated
  using (public.has_permission('manage:routes'));

-- route_templates has no `published` column of its own — visibility follows
-- its parent bundle, checked the same way `published_route_manifest` does.
create policy route_templates_read_published
  on public.route_templates
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.route_bundles rb
      where rb.bundle_id = route_templates.bundle_id and rb.published
    )
  );

create policy route_templates_read_authors
  on public.route_templates
  for select
  to authenticated
  using (public.has_permission('manage:routes'));

-- role_permissions: never public. Only someone who can manage roles needs to
-- see what a role currently grants.
create policy role_permissions_read_authors
  on public.role_permissions
  for select
  to authenticated
  using (public.has_permission('manage:roles'));

-- config_bundle_versions: the audit trail. Gated on view:audit specifically
-- rather than reusing manage:roles/manage:routes — reading history is a
-- weaker, separately grantable capability from authoring the thing itself.
create policy config_bundle_versions_read_audit
  on public.config_bundle_versions
  for select
  to authenticated
  using (public.has_permission('view:audit'));

-- user_roles: visible to role authors (the role editor shows who holds a
-- role) and to the subject about their own assignments.
create policy user_roles_read_authors
  on public.user_roles
  for select
  to authenticated
  using (public.has_permission('manage:roles'));

create policy user_roles_read_self
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());
