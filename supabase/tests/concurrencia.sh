#!/usr/bin/env bash
# Prueba de concurrencia: N conexiones intentan entregar el MISMO cupón a la vez.
# Resultado esperado: exactamente 1 entrega exitosa y N-1 'already_delivered'.
#
# Requiere Supabase local en marcha (supabase start) y Docker/Colima.
# Uso: bash supabase/tests/concurrencia.sh [N]
set -euo pipefail

N="${1:-10}"
DB_CONTAINER="${DB_CONTAINER:-supabase_db_cupones-qr}"
ADMIN_ID="eeeeeeee-0000-0000-0000-00000000000a"
TOKEN="0123456789abcdef0123456789abcdef"

psql_pg() { docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

cleanup() {
  psql_pg -c "delete from public.orders where coupon_token = '$TOKEN';" >/dev/null 2>&1 || true
  psql_pg -c "delete from public.combos where name = 'Combo Concurrencia';" >/dev/null 2>&1 || true
  psql_pg -c "delete from auth.users where id = '$ADMIN_ID';" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

psql_pg <<SQL >/dev/null
insert into auth.users (id, email) values ('$ADMIN_ID', 'concurrencia@test.local');
insert into public.admin_profiles (user_id) values ('$ADMIN_ID');
with c as (insert into public.combos (name, price) values ('Combo Concurrencia', 5) returning id)
insert into public.orders (short_code, coupon_token, buyer_name, combo_id, combo_name, quantity, unit_price, payment_status, paid_at)
select 'CON234', '$TOKEN', 'Prueba Concurrencia', c.id, 'Combo Concurrencia', 1, 5, 'pagado', now() from c;
SQL

OUT_DIR="$(mktemp -d)"
for i in $(seq 1 "$N"); do
  (
    docker exec -i "$DB_CONTAINER" psql -U postgres -qAt <<SQL >"$OUT_DIR/$i.out" 2>&1 || true
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"$ADMIN_ID","role":"authenticated"}', true);
select 'ENTREGADO' from public.deliver_coupon('$TOKEN');
commit;
SQL
  ) &
done
wait

ok=$(grep -l '^ENTREGADO' "$OUT_DIR"/*.out 2>/dev/null | wc -l | tr -d ' ')
dup=$(grep -l 'already_delivered' "$OUT_DIR"/*.out 2>/dev/null | wc -l | tr -d ' ')
rows=$(psql_pg -c "select count(*) from public.orders where coupon_token = '$TOKEN' and delivery_status = 'entregado';")

echo "Solicitudes simultáneas : $N"
echo "Entregas exitosas       : $ok  (esperado: 1)"
echo "Rechazadas (duplicadas) : $dup  (esperado: $((N - 1)))"
echo "Filas entregadas en BD  : $rows (esperado: 1)"
rm -rf "$OUT_DIR"

if [ "$ok" -eq 1 ] && [ "$dup" -eq $((N - 1)) ] && [ "$rows" -eq 1 ]; then
  echo "OK: solo una solicitud pudo entregar el cupón."
else
  echo "FALLO: revisar la lógica de entrega." >&2
  exit 1
fi
