variable "supabase_organization_id" {
  description = <<-EOT
    Supabase organization slug (from the dashboard URL or organization
    settings). Terraform cannot create the organization itself — creating an
    account and picking a plan is an account-level action that has to happen
    in the dashboard once, the same way `terraform` cannot sign you up for
    Netlify either.
  EOT
  type        = string
}

variable "supabase_project_name" {
  description = "Supabase project name, shown in the dashboard."
  type        = string
  default     = "feel-your-website"
}

variable "supabase_database_password" {
  description = <<-EOT
    Password for the project's Postgres superuser. Generate one (e.g.
    `openssl rand -base64 32`) and pass it via TF_VAR_supabase_database_password
    — never commit it, and note it stays out of Terraform's own state as
    plaintext only insofar as your state backend is itself secured; the local
    backend this repo defaults to is not encrypted at rest.
  EOT
  type        = string
  sensitive   = true
}

variable "supabase_region" {
  description = <<-EOT
    AWS region Supabase hosts the project in. This is Supabase's own
    infrastructure choice, unrelated to any region constraint on your own AWS
    account elsewhere in this stack.
  EOT
  type        = string
  default     = "us-east-1"
}

variable "supabase_instance_size" {
  description = "Compute add-on size. \"micro\" is the free-tier default and what keeps this stack at $0."
  type        = string
  default     = "micro"
}

variable "netlify_team_slug" {
  description = "Netlify team slug that owns the site."
  type        = string
}

variable "netlify_site_name" {
  description = <<-EOT
    Name of the Netlify site to configure. The site itself is created outside
    Terraform — linking a git repository goes through Netlify's GitHub App
    OAuth flow, which is a one-time UI step (already done for this repo). This
    module looks the site up and manages its settings, it does not create it.
  EOT
  type        = string
  default     = "feel-your-website"
}
