-- Generated from the permission catalog in @feel-your-website/rbac.
-- Do not edit by hand: regenerate with catalogToSeedSql().

insert into public.permissions (name, description, "group") values
  ('manage:content', 'Create, edit and publish CMS content.', 'CMS'),
  ('manage:roles', 'Create roles and assign permissions to them. Seeded only — never offered by the role editor.', 'Administration'),
  ('manage:routes', 'Assign content and templates to routes.', 'CMS'),
  ('view:audit', 'Read the audit log of configuration changes.', 'Administration')
on conflict (name) do update set
  description = excluded.description,
  "group" = excluded."group";

-- Remove permissions the code no longer defines. Fails if a role still
-- references one, which is intended: that needs a human decision.
delete from public.permissions where name not in ('manage:content', 'manage:roles', 'manage:routes', 'view:audit');
