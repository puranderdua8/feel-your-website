#!/bin/sh
# One-shot database setup for `compose.yaml`. Idempotent: on a database that
# already has the schema it prints a line and exits 0, so it is safe to leave
# `cms` depending on it across every `docker compose up`. Force a fresh run
# with `docker compose down -v`.
#
# Runs as the postgres superuser (bypasses RLS, can write auth.* and public.*).
set -eu

PSQL="psql -v ON_ERROR_STOP=1 -h db -U postgres -d postgres"

echo "migrate: waiting for postgres..."
until pg_isready -h db -U postgres -q; do sleep 1; done

# supabase/migrations FK `user_roles.user_id -> auth.users(id)`. The auth
# schema comes from the supabase/postgres image baseline and GoTrue's own
# startup migrations; wait for it rather than ordering on the auth service.
echo "migrate: waiting for auth.users..."
until [ "$($PSQL -tAc "select to_regclass('auth.users') is not null")" = "t" ]; do sleep 1; done

if [ "$($PSQL -tAc "select to_regclass('public.config_bundles') is not null")" = "t" ]; then
  echo "migrate: public.config_bundles already exists — nothing to do"
  exit 0
fi

echo "migrate: applying supabase/migrations/*.sql"
for f in $(ls /repo/supabase/migrations/*.sql | sort); do
  echo "  >> ${f#/repo/}"
  $PSQL -f "$f"
done

echo "migrate: applying supabase/seed/*.sql"
for f in $(ls /repo/supabase/seed/*.sql | sort); do
  echo "  >> ${f#/repo/}"
  $PSQL -f "$f"
done

echo "migrate: seeding the local dev admin user"
$PSQL -f /repo/docker/seed-dev-user.sql

echo "migrate: done"
