#!/usr/bin/env bash
# Crea un administrador en la base de datos LOCAL (Supabase en Docker/Colima).
# Uso: bash scripts/crear-admin-local.sh correo@ejemplo.com 'UnaClaveLarga123!'
set -euo pipefail
cd "$(dirname "$0")/.."
EMAIL="${1:?Falta el correo}"; PASS="${2:?Falta la contraseña}"

eval "$(supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
case "$API_URL" in http://127.0.0.1*|http://localhost*) ;; *) echo "Solo para la base local." >&2; exit 1;; esac

BODY=$(printf '{"email":"%s","password":"%s","email_confirm":true}' "$EMAIL" "$PASS")
ID=$(curl -s -X POST "$API_URL/auth/v1/admin/users" -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H 'Content-Type: application/json' -d "$BODY" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.id){console.error(j.msg||s);process.exit(1)}console.log(j.id)})')

docker exec -i supabase_db_cupones-qr psql -U postgres -qAt \
  -c "insert into public.admin_profiles (user_id) values ('$ID') on conflict do nothing;"
echo "Administrador local creado: $EMAIL"
