#!/bin/sh
# Regenerate supabase/schema.sql from the local database (after npx supabase start / db reset).
set -e
{ echo "-- Generated snapshot of the public schema after all migrations (npm run db:snapshot)."
  echo "-- Do not edit: change the database with a new file in supabase/migrations/."; echo
  npx supabase db dump --local --schema public; } > supabase/schema.sql
