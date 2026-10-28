#!/usr/bin/env bash
# Ejecuta las pruebas de integración contra la base de datos LOCAL (Supabase en Docker/Colima).
# Requiere:  npm run db:start
set -euo pipefail
cd "$(dirname "$0")/.."

if ! supabase status >/dev/null 2>&1; then
  echo "Supabase local no está en marcha. Ejecuta primero:  npm run db:start" >&2
  exit 1
fi

# Las claves salen de la instancia local (claves demo de desarrollo, no de la nube).
eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

npx vitest run --config vitest.integration.config.ts "$@"
