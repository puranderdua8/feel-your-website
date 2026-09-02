# Infrastructure

Terraform for the two things that were previously clicked through in a UI
with no record of who set them or when: the Supabase project's auth
settings (chiefly, registering the Custom Access Token hook the `supabase/`
migrations define but do not themselves activate), and the Netlify site's
build settings and environment variables.

**Nothing here has been applied.** This is declarative configuration,
checked with `terraform validate` against the real provider schemas — it has
never been run against real infrastructure, and doing so is your call to
make with your own credentials, not something to run sight-unseen.

## What this does not manage, and why

- **The Supabase organization.** Signing up and picking a plan is an
  account-level action. Create the organization once in the
  [dashboard](https://supabase.com/dashboard), then pass its slug as
  `supabase_organization_id`.
- **The Netlify team, and the site's git link.** Linking a repository goes
  through Netlify's GitHub App installation — an OAuth flow with no
  non-interactive equivalent. Already done for this repo; a fresh clone does
  it once in the Netlify UI, the same way you already connected this one.
- **`netlify.toml`'s build command and publish directory.** Netlify's
  documented precedence is file-based config over UI/API config, so
  `netlify.toml` wins regardless of what `netlify_site_build_settings`
  says — see the comment in `netlify.tf`. Edit `netlify.toml` to change
  either.
- **`CONTENT_ADAPTER=supabase`.** Not set here on purpose: the adapter that
  value selects does not exist until Phase 5, and `getContentAdapter()`
  throws deliberately rather than silently serving fixtures in production.
  It belongs in the PR that lands the adapter.

## Prerequisites

- A Supabase organization and a Netlify team, both already created.
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.6.
- A [Supabase access token](https://supabase.com/dashboard/account/tokens)
  and a [Netlify personal access token](https://app.netlify.com/user/applications).

## Running it

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # fill in the two slugs
export SUPABASE_ACCESS_TOKEN=...
export NETLIFY_API_TOKEN=...
export TF_VAR_supabase_database_password=$(openssl rand -base64 32)

terraform init
terraform plan   # read it before the next line
terraform apply
```

After the first apply, run the migrations and the generated seed against the
new project (`supabase link --project-ref "$(terraform output -raw
supabase_project_ref)"`, then `supabase db push`) — Terraform manages project
_settings_, never schema. That split is deliberate: `supabase/migrations` is
already its own reviewable, ordered, re-playable history, and folding SQL
execution into `terraform apply` would just be a second, worse mechanism for
the same job.

This manual `db push` is only the one-time bootstrap of a fresh project.
From then on `.github/workflows/db-migrate.yml` applies new migrations to the
hosted project automatically, on every merge to `main` that changes
`supabase/migrations/`. It reads three repo secrets — `SUPABASE_ACCESS_TOKEN`
(same token as above), `SUPABASE_DB_PASSWORD` (`TF_VAR_supabase_database_password`),
and `SUPABASE_PROJECT_ID` (`terraform output -raw supabase_project_ref`).

## State

No remote backend is configured — state defaults to local
(`infra/terraform.tfstate`, gitignored) and never leaves your machine. That
is the right default for one person running this alone; the moment a second
person runs `terraform apply`, local state has no locking and two concurrent
applies can corrupt each other's plan. See the comment in `backend.tf` for
the free upgrade path (HCP Terraform's free tier) if that becomes true for
your clone.

`.terraform.lock.hcl` **is** committed, unlike everything else Terraform
writes — it pins the exact provider versions, the same job `pnpm-lock.yaml`
does for npm packages.
