# The Supabase project and the settings that are otherwise clicked through
# in the dashboard: the Custom Access Token hook registration, the site URL
# used for auth redirects, and the free-tier instance size.
#
# Registering the hook here is the point of this file. It is what closes the
# gap the README calls out for the auth hook migration
# (supabase/migrations/..._auth_hook.sql): the SQL creates
# `custom_access_token_hook` and grants it to `supabase_auth_admin`, but a
# function existing in the database does not mean Supabase Auth calls it —
# that registration is project *configuration*, not schema, and previously
# only existed as a dashboard checkbox with no record of who set it or when.

resource "supabase_project" "this" {
  organization_id   = var.supabase_organization_id
  name              = var.supabase_project_name
  database_password = var.supabase_database_password
  region            = var.supabase_region
  instance_size     = var.supabase_instance_size
}

resource "supabase_settings" "this" {
  project_ref = supabase_project.this.id

  auth = jsonencode({
    site_url = "https://${var.netlify_site_name}.netlify.app"

    # A single comma-separated string, not a list — and `**` (not `*`)
    # because it must cross the `/` separator to cover every route the
    # router adds, not just one path segment. Matches
    # `additional_redirect_urls` in supabase/config.toml, which governs local
    # dev only; this is the same allowance for the hosted project.
    uri_allow_list = "https://${var.netlify_site_name}.netlify.app/**"

    # `pg-functions://<database>/<schema>/<function>` is Supabase's URI
    # scheme for a hook implemented as a Postgres function rather than an
    # HTTP endpoint — no extra compute, no network hop, and the function
    # already runs `security invoker` with grants scoped to exactly the
    # tables it reads (see the migration).
    hook_custom_access_token_enabled = true
    hook_custom_access_token_uri     = "pg-functions://postgres/public/custom_access_token_hook"
  })
}
