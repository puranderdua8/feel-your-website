# No backend block: state defaults to local (terraform.tfstate, gitignored).
#
# That is a deliberate choice for a project that ships $0-by-default and
# assumes no infrastructure the boilerplate itself did not ask you to create
# — a remote backend is one more account. It is also the wrong choice the
# moment more than one person runs `terraform apply`: local state has no
# locking, so two concurrent applies can corrupt each other's plan.
#
# If that becomes true for your clone, HCP Terraform's free tier is the
# lowest-friction upgrade — state storage and locking, no infrastructure of
# its own to run:
#
#   terraform {
#     cloud {
#       organization = "your-org"
#       workspaces { name = "feel-your-website" }
#     }
#   }
#
# Run `terraform login`, add that block, then `terraform init -migrate-state`.
