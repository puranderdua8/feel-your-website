output "supabase_project_ref" {
  description = "Project reference, needed for the Supabase CLI (`supabase link --project-ref ...`) and for running migrations against the hosted project."
  value       = supabase_project.this.id
}

output "supabase_url" {
  description = "Same value written to Netlify as SUPABASE_URL."
  value       = "https://${supabase_project.this.id}.supabase.co"
}

output "netlify_site_id" {
  value = data.netlify_site.this.id
}
