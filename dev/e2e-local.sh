#!/bin/sh
# Build against the LOCAL Supabase (npx supabase start) and run the end-to-end cloud test.
set -e
eval "$(npx supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY)=')"
VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_ANON_KEY="$PUBLISHABLE_KEY" npx vite build --logLevel warn
node dev/cloud-e2e.mjs
