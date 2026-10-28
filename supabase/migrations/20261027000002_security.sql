-- Migración 2: seguridad. RLS, permisos mínimos y protección de invariantes.
--
-- Modelo:
--   * Nadie (anon) puede leer ni escribir tablas directamente.
--   * Los administradores (filas en admin_profiles) pueden LEER pedidos y
--     administrar combos.
--   * TODA escritura sobre pedidos pasa por funciones (migración 3), que
--     validan permisos y datos dentro de la base de datos.

-- ---------------------------------------------------------------------------
-- ¿El usuario actual es administrador?
-- SECURITY DEFINER para poder consultar admin_profiles sin depender de su RLS
-- (evita recursión) y search_path vacío para que no se pueda suplantar objetos.
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles where user_id = (select auth.uid())
  );
$$;

-- Supabase concede EXECUTE a anon/authenticated por defecto: se quita y se da solo a quien corresponde.
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Permisos de tabla: partir de cero y conceder solo lo necesario.
-- ---------------------------------------------------------------------------
revoke all on public.admin_profiles from anon, authenticated;
revoke all on public.combos         from anon, authenticated;
revoke all on public.orders         from anon, authenticated;

grant select                 on public.admin_profiles to authenticated;
grant select, insert, update on public.combos         to authenticated;
grant select                 on public.orders         to authenticated;
-- orders: sin INSERT/UPDATE/DELETE directos. Solo las funciones SECURITY DEFINER escriben.

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.admin_profiles enable row level security;
alter table public.combos         enable row level security;
alter table public.orders         enable row level security;

-- Un usuario solo puede ver su propia fila (para que la app sepa si es admin).
-- Sin políticas de escritura: los administradores se crean desde el SQL Editor.
create policy admin_profiles_select_own on public.admin_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy combos_admin_select on public.combos
  for select to authenticated
  using ((select public.is_admin()));

create policy combos_admin_insert on public.combos
  for insert to authenticated
  with check ((select public.is_admin()));

create policy combos_admin_update on public.combos
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy orders_admin_select on public.orders
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Defensa en profundidad: incluso un UPDATE hecho "a mano" (SQL Editor,
-- service_role) no puede retroceder un cupón ni alterar lo ya emitido.
-- ---------------------------------------------------------------------------
create function public.orders_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.short_code is distinct from old.short_code
     or new.combo_id is distinct from old.combo_id
     or new.combo_name is distinct from old.combo_name
     or new.quantity is distinct from old.quantity
     or new.unit_price is distinct from old.unit_price
     or new.created_at is distinct from old.created_at then
    raise exception 'order_immutable_field' using errcode = '23000';
  end if;

  if old.payment_status = 'pagado'
     and (new.payment_status is distinct from old.payment_status
          or new.coupon_token is distinct from old.coupon_token
          or new.paid_at is distinct from old.paid_at) then
    raise exception 'paid_order_locked' using errcode = '23000';
  end if;

  if old.delivery_status = 'entregado'
     and (new.delivery_status is distinct from old.delivery_status
          or new.delivered_at is distinct from old.delivered_at
          or new.delivered_by is distinct from old.delivered_by) then
    raise exception 'delivered_order_locked' using errcode = '23000';
  end if;

  return new;
end;
$$;

create trigger orders_guard
  before update on public.orders
  for each row execute function public.orders_guard();
