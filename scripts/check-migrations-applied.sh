#!/usr/bin/env bash
#
# Fails if any file in supabase/migrations/ is not recorded as applied to the
# hosted Supabase project in supabase/migrations/applied.txt.
#
# Why this exists: nothing applies migrations to the hosted project
# automatically — that is a deliberate choice, migrations are run by hand.
# This check is what stops a PR merging while the live database is behind the
# migrations already on `main`; the failure mode it prevents is a deployed
# app calling RPCs or tables that do not exist there yet ("The content
# backend is unreachable" in the CMS).
#
# When it fails: apply the pending migrations to the hosted project yourself,
#
#     pnpm exec supabase login          # once, opens a browser
#     pnpm exec supabase link --project-ref <ref>
#     pnpm exec supabase db push
#
# then append each newly-applied version (the timestamp prefix of the
# filename, e.g. 20260906000100) to supabase/migrations/applied.txt, in
# filename order, and commit — in the same PR or a follow-up. Reconcile
# against the project's real state with `pnpm exec supabase migration list
# --linked` if the manifest and the database ever disagree.
#
# Runs in CI (a required check) and locally: bash scripts/check-migrations-applied.sh
#
# Portable to bash 3.2 (macOS /bin/bash) on purpose — no mapfile, no
# associative arrays.

set -euo pipefail

cd "$(dirname "$0")/.."

manifest="supabase/migrations/applied.txt"
[ -f "$manifest" ] || {
  echo "error: $manifest is missing — it is the source of truth for what is live on the hosted project" >&2
  exit 1
}

# Timestamp prefix of every migration file, sorted.
present="$(for f in supabase/migrations/*.sql; do b="${f##*/}"; echo "${b%%_*}"; done | sort)"

# Recorded-applied versions, ignoring blank lines and # comments, sorted.
recorded="$(grep -vE '^[[:space:]]*(#|$)' "$manifest" | sort || true)"

# In the files but not recorded → the hosted project is behind these.
missing="$(comm -23 <(printf '%s\n' "$present") <(printf '%s\n' "$recorded"))"
# Recorded but no matching file → a migration was renamed/deleted after being
# applied, and the manifest now misdescribes the project.
orphans="$(comm -13 <(printf '%s\n' "$present") <(printf '%s\n' "$recorded"))"

status=0

if [ -n "$missing" ]; then
  status=1
  echo "::error::migration(s) not recorded as applied in $manifest:" $missing
  echo
  echo "  The hosted project is behind these migrations. Apply them, then record them:"
  echo "    pnpm exec supabase db push"
  echo "    printf '%s\\n'" $missing ">> $manifest"
  echo "    git add $manifest && git commit -m 'chore(db): record applied migrations'"
  echo
fi

if [ -n "$orphans" ]; then
  status=1
  echo "::error::$manifest records version(s) with no migration file:" $orphans
fi

if [ "$status" -eq 0 ]; then
  echo "OK — all $(printf '%s\n' "$present" | grep -c .) migrations recorded as applied in $manifest."
fi

exit "$status"
