#!/usr/bin/env bash
# Applies supabase/migrations/*.sql to the local Supabase Postgres, in order, once each.
# Applied files are recorded in public.schema_migrations so reruns are no-ops.
set -euo pipefail

cd "$(dirname "$0")/.."
compose=(docker compose --env-file supabase/docker/.env)
psql() { "${compose[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -q "$@"; }

echo "Waiting for Realtime (it creates realtime.messages, which the migrations add policies to)..."
for _ in $(seq 1 60); do
  if [ "$("${compose[@]}" ps --format '{{.Health}}' realtime 2>/dev/null)" = "healthy" ]; then break; fi
  sleep 2
done

psql -c "create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now());"

for file in supabase/migrations/*.sql; do
  version="$(basename "$file")"
  done="$(psql -tA -c "select 1 from public.schema_migrations where version = '$version'")"
  if [ "$done" = "1" ]; then
    echo "  skip  $version"
    continue
  fi
  echo "  apply $version"
  { echo "begin;"; cat "$file"; echo; echo "insert into public.schema_migrations (version) values ('$version');"; echo "commit;"; } | psql
done

# PostgREST caches the schema; ask it to reload so new tables and functions are visible at once.
psql -c "notify pgrst, 'reload schema';"
echo "Migrations applied."
