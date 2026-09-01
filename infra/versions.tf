terraform {
  required_version = ">= 1.6.0"

  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
    netlify = {
      source = "netlify/netlify"
      # Still pre-1.0 as of writing — pin the minor rather than `~> 1.0`,
      # which would resolve to nothing.
      version = "~> 0.4"
    }
  }
}

# Credentials come from environment variables, never from this file or from
# tfvars: SUPABASE_ACCESS_TOKEN and NETLIFY_API_TOKEN. Both providers read
# them on their own — see README.md.
provider "supabase" {}

provider "netlify" {}
