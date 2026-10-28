-- Migración 3: funciones (RPC) para registrar, confirmar, consultar y entregar.
--
-- Todas son SECURITY DEFINER con search_path vacío (objetos siempre calificados).
-- Los permisos de EXECUTE se quitan a todos y se conceden explícitamente al final.
-- Los errores usan códigos de mensaje estables que el frontend traduce:
--   not_authorized, invalid_name, invalid_quantity, invalid_price, combo_not_found,
--   combo_inactive, order_not_found, already_paid, coupon_not_found,
--   already_delivered, payment_not_confirmed

-- ---------------------------------------------------------------------------
-- Auxiliares internos (no se exponen a ningún rol de la API).
-- ---------------------------------------------------------------------------

-- Token público: un UUID v4 de Postgres (CSPRNG) sin guiones = 32 caracteres hex.
-- Aporta 122 bits aleatorios: imposible de adivinar por fuerza bruta.
create function public.generate_coupon_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '');
$$;

-- Código corto de 6 caracteres sin letras/números ambiguos (sin 0, 1, I, L, O).
create function public.generate_short_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      into code
      from generate_series(1, 6);
    exit when not exists (select 1 from public.orders where short_code = code);
  end loop;
  return code;
end;
$$;

revoke all on function public.generate_coupon_token() from public, anon, authenticated;
revoke all on function public.generate_short_code()   from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_order: registra una compra. Si p_paid es true, el cupón se emite
-- en la misma operación; si no, queda pendiente de pago y SIN token.
-- p_unit_price es opcional: por defecto se usa el precio vigente del combo.
-- ---------------------------------------------------------------------------
create function public.create_order(
  p_buyer_name    text,
  p_buyer_contact text,
  p_combo_id      uuid,
  p_quantity      integer,
  p_unit_price    numeric default null,
  p_paid          boolean default false
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_combo public.combos;
  v_price numeric(10, 2);
  v_name  text := btrim(coalesce(p_buyer_name, ''));
  v_contact text := nullif(btrim(coalesce(p_buyer_contact, '')), '');
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_contact is not null and char_length(v_contact) > 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity not between 1 and 100 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  select * into v_combo from public.combos where id = p_combo_id;
  if not found then
    raise exception 'combo_not_found' using errcode = 'P0002';
  end if;
  if not v_combo.active then
    raise exception 'combo_inactive' using errcode = '22023';
  end if;

  v_price := coalesce(p_unit_price, v_combo.price);
  if v_price <= 0 or v_price > 9999.99 then
    raise exception 'invalid_price' using errcode = '22023';
  end if;

  insert into public.orders (
    short_code, buyer_name, buyer_contact, combo_id, combo_name,
    quantity, unit_price, created_by,
    payment_status, coupon_token, paid_at, paid_by
  ) values (
    public.generate_short_code(), v_name, v_contact, v_combo.id, v_combo.name,
    p_quantity, v_price, auth.uid(),
    case when p_paid then 'pagado' else 'pendiente' end,
    case when p_paid then public.generate_coupon_token() end,
    case when p_paid then now() end,
    case when p_paid then auth.uid() end
  )
  returning * into v_order;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_payment: pasa un pedido pendiente a pagado y emite su cupón.
-- ---------------------------------------------------------------------------
create function public.confirm_payment(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.orders
     set payment_status = 'pagado',
         coupon_token   = public.generate_coupon_token(),
         paid_at        = now(),
         paid_by        = auth.uid()
   where id = p_order_id
     and payment_status = 'pendiente'
  returning * into v_order;

  if found then
    return v_order;
  end if;

  if exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'already_paid' using errcode = 'P0001';
  end if;
  raise exception 'order_not_found' using errcode = 'P0002';
end;
$$;

-- ---------------------------------------------------------------------------
-- lookup_coupon (solo admin): busca por token del QR o por código corto.
-- Devuelve 0 filas si no existe. No modifica nada.
-- ---------------------------------------------------------------------------
create function public.lookup_coupon(p_code text)
returns setof public.orders
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := btrim(coalesce(p_code, ''));
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_code = '' or char_length(v_code) > 200 then
    return;
  end if;

  return query
    select o.*
      from public.orders o
     where o.coupon_token = lower(v_code)
        or o.short_code = upper(v_code)
     limit 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- deliver_coupon: entrega ATÓMICA. Un único UPDATE condicionado:
-- si dos solicitudes llegan a la vez, la segunda espera el bloqueo de la fila,
-- vuelve a evaluar el WHERE, ya no coincide y recibe 'already_delivered'.
-- ---------------------------------------------------------------------------
create function public.deliver_coupon(p_token text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := lower(btrim(coalesce(p_token, '')));
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.orders
     set delivery_status = 'entregado',
         delivered_at    = now(),
         delivered_by    = auth.uid()
   where coupon_token    = v_token
     and payment_status  = 'pagado'
     and delivery_status = 'pendiente'
  returning * into v_order;

  if found then
    return v_order;
  end if;

  -- No se pudo entregar: explicar por qué.
  select * into v_order from public.orders where coupon_token = v_token;
  if not found then
    raise exception 'coupon_not_found' using errcode = 'P0002';
  end if;
  if v_order.delivery_status = 'entregado' then
    raise exception 'already_delivered' using errcode = 'P0001';
  end if;
  raise exception 'payment_not_confirmed' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- get_public_coupon: lo único que ve el comprador. Datos mínimos, solo del
-- cupón cuyo token coincide exactamente. Sin token válido: 0 filas.
-- ---------------------------------------------------------------------------
create function public.get_public_coupon(p_token text)
returns table (
  buyer_name      text,
  combo_name      text,
  quantity        integer,
  short_code      text,
  delivery_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.buyer_name, o.combo_name, o.quantity, o.short_code, o.delivery_status
    from public.orders o
   where o.coupon_token = lower(btrim(coalesce(p_token, '')))
     and o.payment_status = 'pagado'
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución (explícitos).
-- ---------------------------------------------------------------------------
revoke all on function public.create_order(text, text, uuid, integer, numeric, boolean) from public, anon, authenticated;
revoke all on function public.confirm_payment(uuid)    from public, anon, authenticated;
revoke all on function public.lookup_coupon(text)      from public, anon, authenticated;
revoke all on function public.deliver_coupon(text)     from public, anon, authenticated;
revoke all on function public.get_public_coupon(text)  from public, anon, authenticated;

grant execute on function public.create_order(text, text, uuid, integer, numeric, boolean) to authenticated;
grant execute on function public.confirm_payment(uuid) to authenticated;
grant execute on function public.lookup_coupon(text)   to authenticated;
grant execute on function public.deliver_coupon(text)  to authenticated;
-- La única función pública:
grant execute on function public.get_public_coupon(text) to anon, authenticated;
