# Netlify site settings, applied to a site that already exists.
#
# The site itself is not created here: linking a git repository goes through
# Netlify's GitHub App installation, an OAuth flow with no non-interactive
# equivalent, so it happened once in the dashboard (already done for this
# repo). What Terraform manages from here on is everything that was
# previously a manual settings-page edit: the build command, publish
# directory and — the part that matters for security — the environment
# variables the build and the running functions read, so the two Supabase
# keys never depend on someone remembering to paste them into the UI
# correctly on a fresh clone.

data "netlify_team" "this" {
  slug = var.netlify_team_slug
}

data "netlify_site" "this" {
  team_slug = var.netlify_team_slug
  name      = var.netlify_site_name
}

data "supabase_apikeys" "this" {
  project_ref = supabase_project.this.id
}

resource "netlify_site_build_settings" "this" {
  site_id = data.netlify_site.this.id

  # `build_command` and `publish_directory` are required arguments of this
  # resource, but netlify.toml's own [build] block wins over both of them at
  # deploy time — Netlify's documented precedence is file-based config over
  # UI/API config, not the other way around. They are set here only to keep
  # this resource creatable and to keep the two declarations from silently
  # disagreeing; netlify.toml, not this file, is what to edit to actually
  # change either.
  build_command     = "pnpm turbo run build --filter=@feel-your-website/shell..."
  publish_directory = "apps/shell/dist/client"

  # This one has no netlify.toml equivalent, so it is the field this
  # resource actually controls.
  production_branch = "main"
}

resource "netlify_environment_variable" "supabase_url" {
  team_id = data.netlify_team.this.id
  site_id = data.netlify_site.this.id
  key     = "SUPABASE_URL"
  values = [{
    value   = "https://${supabase_project.this.id}.supabase.co"
    context = "all"
  }]
}

resource "netlify_environment_variable" "supabase_anon_key" {
  team_id = data.netlify_team.this.id
  site_id = data.netlify_site.this.id
  key     = "SUPABASE_ANON_KEY"
  # Not `secret_values`: this key is meant to be public — see .env.example's
  # note that RLS, not secrecy, is what protects data reached through it.
  values = [{
    value   = data.supabase_apikeys.this.anon_key
    context = "all"
  }]
}

resource "netlify_environment_variable" "supabase_service_role_key" {
  team_id = data.netlify_team.this.id
  site_id = data.netlify_site.this.id
  key     = "SUPABASE_SERVICE_ROLE_KEY"
  # `secret_values`, never `values`: this key bypasses RLS entirely. Netlify
  # encrypts it at rest and omits it from build logs; `.env.example` carries
  # the same warning for local development.
  secret_values = [{
    value   = data.supabase_apikeys.this.service_role_key
    context = "production"
  }]

  # Scoped to the server: Vite only inlines `VITE_`-prefixed variables into
  # the client bundle, and this one deliberately isn't prefixed, but keeping
  # it out of the `builds`/`runtime` split that doesn't need it is one more
  # layer against it ending up somewhere it can be read back out.
  scopes = ["functions"]
}

# CONTENT_ADAPTER is deliberately not set here yet. `getContentAdapter()`
# (apps/shell/src/server/adapters.ts) throws on purpose if it is set to
# "supabase" before that adapter exists — failing loudly beats silently
# serving fixtures in production. Setting it to "supabase" belongs in the
# Phase 5 PR that actually lands the adapter, alongside this line.
