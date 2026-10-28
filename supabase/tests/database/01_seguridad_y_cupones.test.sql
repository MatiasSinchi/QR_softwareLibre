-- Pruebas pgTAP: permisos, validaciones y reglas del cupón.
-- Ejecutar con:  supabase test db
-- Todo corre dentro de una transacción que se revierte al final.
begin;
select no_plan();

-- ---------------------------------------------------------------------------
-- Datos de prueba (como postgres, sin RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'otro@test.local');
insert into public.admin_profiles (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');

insert into public.combos (id, name, price, active) values
  ('cccccccc-0000-0000-0000-000000000001', 'Combo Test', 5.00, true),
  ('cccccccc-0000-0000-0000-000000000002', 'Combo Inactivo', 4.00, false);

-- Un pedido pagado (con token conocido) y uno pendiente.
insert into public.orders (id, short_code, coupon_token, buyer_name, buyer_contact, combo_id, combo_name,
                           quantity, unit_price, payment_status, paid_at)
values ('dddddddd-0000-0000-0000-000000000001', 'ABC234', 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        'Ana Pagada', 'secreto-contacto', 'cccccccc-0000-0000-0000-000000000001', 'Combo Test',
        2, 5.00, 'pagado', now());
insert into public.orders (id, short_code, buyer_name, combo_id, combo_name, quantity, unit_price)
values ('dddddddd-0000-0000-0000-000000000002', 'PEN567', 'Pedro Pendiente',
        'cccccccc-0000-0000-0000-000000000001', 'Combo Test', 1, 5.00);

-- ---------------------------------------------------------------------------
-- 1. Restricciones de la tabla (como postgres)
-- ---------------------------------------------------------------------------
select is((select total from public.orders where short_code = 'ABC234'), 10.00::numeric,
  'total se calcula en la base de datos (cantidad x precio)');

select throws_ok(
  $$insert into public.orders (short_code, buyer_name, combo_id, combo_name, quantity, unit_price, total)
    values ('ZZZ222', 'X', 'cccccccc-0000-0000-0000-000000000001', 'Combo Test', 1, 5, 999)$$,
  '428C9', null, 'no se puede insertar un total manual');

select throws_ok(
  $$insert into public.orders (short_code, buyer_name, combo_id, combo_name, quantity, unit_price, coupon_token)
    values ('ZZZ223', 'X', 'cccccccc-0000-0000-0000-000000000001', 'Combo Test', 1, 5, 'a1b2c3d4e5f60718293a4b5c6d7e8f91')$$,
  '23514', null, 'un pedido NO pagado no puede tener token de cupón');

select throws_ok(
  $$insert into public.orders (short_code, buyer_name, combo_id, combo_name, quantity, unit_price, payment_status, paid_at)
    values ('ZZZ224', 'X', 'cccccccc-0000-0000-0000-000000000001', 'Combo Test', 1, 5, 'pagado', now())$$,
  '23514', null, 'un pedido pagado debe tener token de cupón');

select throws_ok(
  $$insert into public.orders (short_code, buyer_name, combo_id, combo_name, quantity, unit_price, delivery_status, delivered_at)
    values ('ZZZ225', 'X', 'cccccccc-0000-0000-0000-000000000001', 'Combo Test', 1, 5, 'entregado', now())$$,
  '23514', null, 'no se puede marcar entregado un pedido no pagado');

select throws_ok(
  $$insert into public.orders (short_code, buyer_name, combo_id, combo_name, quantity, unit_price)
    values ('ZZZ226', 'X', 'cccccccc-0000-0000-0000-000000000001', 'Combo Test', 0, 5)$$,
  '23514', null, 'cantidad 0 rechazada por la tabla');

select throws_ok(
  $$insert into public.orders (short_code, buyer_name, combo_id, combo_name, quantity, unit_price, payment_status)
    values ('ZZZ227', 'X', 'cccccccc-0000-0000-0000-000000000001', 'Combo Test', 1, 5, 'reembolsado')$$,
  '23514', null, 'estado de pago fuera de los valores permitidos');

-- Triggers de protección (también aplican a postgres / service_role)
select throws_ok(
  $$update public.orders set payment_status = 'pendiente', coupon_token = null, paid_at = null where short_code = 'ABC234'$$,
  '23000', 'paid_order_locked', 'un pedido pagado no puede volver a pendiente');

select throws_ok(
  $$update public.orders set quantity = 50 where short_code = 'ABC234'$$,
  '23000', 'order_immutable_field', 'la cantidad no se puede alterar tras crear el pedido');

-- ---------------------------------------------------------------------------
-- 2. anon (visitante / comprador)
-- ---------------------------------------------------------------------------
set local role anon;

select throws_ok($$select * from public.orders$$, '42501', null, 'anon no puede leer pedidos');
select throws_ok($$select * from public.combos$$, '42501', null, 'anon no puede leer combos');
select throws_ok($$select * from public.admin_profiles$$, '42501', null, 'anon no puede leer admin_profiles');
select throws_ok(
  $$insert into public.orders (short_code, buyer_name, combo_id, combo_name, quantity, unit_price)
    values ('HAK123', 'Hacker', 'cccccccc-0000-0000-0000-000000000001', 'Combo Test', 1, 5)$$,
  '42501', null, 'anon no puede insertar pedidos');
select throws_ok($$update public.orders set delivery_status = 'entregado'$$, '42501', null, 'anon no puede modificar pedidos');
select throws_ok($$select public.deliver_coupon('a1b2c3d4e5f60718293a4b5c6d7e8f90')$$, '42501', null, 'anon no puede ejecutar deliver_coupon');
select throws_ok($$select * from public.lookup_coupon('ABC234')$$, '42501', null, 'anon no puede ejecutar lookup_coupon');
select throws_ok($$select public.create_order('X', null, 'cccccccc-0000-0000-0000-000000000001', 1, null, true)$$, '42501', null, 'anon no puede ejecutar create_order');
select throws_ok($$select public.confirm_payment('dddddddd-0000-0000-0000-000000000002')$$, '42501', null, 'anon no puede ejecutar confirm_payment');
select throws_ok($$select public.is_admin()$$, '42501', null, 'anon no puede ejecutar is_admin');

select results_eq(
  $$select buyer_name, combo_name, quantity, short_code, delivery_status
      from public.get_public_coupon('a1b2c3d4e5f60718293a4b5c6d7e8f90')$$,
  $$values ('Ana Pagada'::text, 'Combo Test'::text, 2, 'ABC234'::text, 'pendiente'::text)$$,
  'anon obtiene solo los datos mínimos del cupón con token válido');

select is((select count(*)::int from public.get_public_coupon('a1b2c3d4e5f60718293a4b5c6d7e8f91')), 0,
  'token inexistente: 0 filas');
select is((select count(*)::int from public.get_public_coupon('ABC234')), 0,
  'el código corto NO da acceso a la página pública');
select is((select count(*)::int from public.get_public_coupon('dddddddd-0000-0000-0000-000000000001')), 0,
  'el id interno NO da acceso a la página pública');
select is((select count(*)::int from public.get_public_coupon('')), 0, 'token vacío: 0 filas');
select is((select count(*)::int from public.get_public_coupon(null)), 0, 'token nulo: 0 filas');
select is((select count(*)::int from public.get_public_coupon('%')), 0, 'comodines no coinciden (comparación exacta)');

select is(
  (select count(*)::int from jsonb_object_keys(
    (select to_jsonb(c) from public.get_public_coupon('a1b2c3d4e5f60718293a4b5c6d7e8f90') c))),
  5,
  'la respuesta pública tiene exactamente 5 campos (sin contacto, precio, ids ni fechas)');

reset role;

-- ---------------------------------------------------------------------------
-- 3. Usuario autenticado que NO es administrador
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is((select count(*)::int from public.orders), 0, 'no admin: RLS oculta todos los pedidos');
select is((select count(*)::int from public.combos), 0, 'no admin: RLS oculta los combos');
select throws_ok($$insert into public.combos (name, price) values ('Hack', 1)$$, '42501', null, 'no admin no puede crear combos');
select throws_ok(
  $$insert into public.orders (short_code, buyer_name, combo_id, combo_name, quantity, unit_price)
    values ('HAK124', 'Hacker', 'cccccccc-0000-0000-0000-000000000001', 'Combo Test', 1, 5)$$,
  '42501', null, 'no admin no puede insertar pedidos directamente');
select throws_ok($$update public.orders set delivery_status = 'entregado'$$, '42501', null, 'no admin no puede actualizar pedidos directamente');
select throws_ok($$insert into public.admin_profiles (user_id) values ('bbbbbbbb-0000-0000-0000-000000000002')$$, '42501', null, 'no admin no puede autopromoverse');
select throws_ok($$select public.create_order('X', null, 'cccccccc-0000-0000-0000-000000000001', 1, null, true)$$, '42501', 'not_authorized', 'no admin: create_order rechazado');
select throws_ok($$select public.deliver_coupon('a1b2c3d4e5f60718293a4b5c6d7e8f90')$$, '42501', 'not_authorized', 'no admin: deliver_coupon rechazado');
select throws_ok($$select public.confirm_payment('dddddddd-0000-0000-0000-000000000002')$$, '42501', 'not_authorized', 'no admin: confirm_payment rechazado');
select throws_ok($$select * from public.lookup_coupon('ABC234')$$, '42501', 'not_authorized', 'no admin: lookup_coupon rechazado');

reset role;
select is((select delivery_status from public.orders where short_code = 'ABC234'), 'pendiente',
  'el pedido sigue intacto tras los intentos de un no admin');

-- ---------------------------------------------------------------------------
-- 4. Administrador
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*)::int from public.orders), 2, 'admin ve los pedidos');

select throws_ok($$select public.create_order('Luis', null, 'cccccccc-0000-0000-0000-000000000001', 0, null, true)$$, '22023', 'invalid_quantity', 'cantidad 0 rechazada por la función');
select throws_ok($$select public.create_order('Luis', null, 'cccccccc-0000-0000-0000-000000000001', 101, null, true)$$, '22023', 'invalid_quantity', 'cantidad 101 rechazada');
select throws_ok($$select public.create_order('Luis', null, 'cccccccc-0000-0000-0000-000000000001', 1, 0, true)$$, '22023', 'invalid_price', 'precio 0 rechazado');
select throws_ok($$select public.create_order('Luis', null, 'cccccccc-0000-0000-0000-000000000001', 1, -3, true)$$, '22023', 'invalid_price', 'precio negativo rechazado');
select throws_ok($$select public.create_order('   ', null, 'cccccccc-0000-0000-0000-000000000001', 1, null, true)$$, '22023', 'invalid_name', 'nombre vacío rechazado');
select throws_ok($$select public.create_order('Luis', null, 'cccccccc-0000-0000-0000-000000000002', 1, null, true)$$, '22023', 'combo_inactive', 'combo inactivo rechazado');
select throws_ok($$select public.create_order('Luis', null, 'cccccccc-0000-0000-0000-0000000000ff', 1, null, true)$$, 'P0002', 'combo_not_found', 'combo inexistente rechazado');

-- Pedido pagado: usa el precio del combo y emite token de 32 hex.
select matches(
  (select (public.create_order('Marta Nueva', '  0999  ', 'cccccccc-0000-0000-0000-000000000001', 3, null, true)).coupon_token),
  '^[0-9a-f]{32}$', 'create_order pagado emite un token aleatorio de 32 hex');

-- Pedido pendiente: sin token, y el total lo calcula la base de datos.
select is((select (public.create_order('Nico Pendiente', null, 'cccccccc-0000-0000-0000-000000000001', 4, 2.50, false)).coupon_token),
  null, 'create_order pendiente NO emite token');

reset role;
select is((select total from public.orders where buyer_name = 'Marta Nueva'), 15.00::numeric,
  'total = 3 x 5.00 (precio tomado del combo)');
select is((select buyer_contact from public.orders where buyer_name = 'Marta Nueva'), '0999',
  'el contacto se guarda sin espacios sobrantes');
select is((select total from public.orders where buyer_name = 'Nico Pendiente'), 10.00::numeric,
  'total = 4 x 2.50 (precio personalizado validado)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- Confirmar pago.
select throws_ok($$select public.confirm_payment('dddddddd-0000-0000-0000-0000000000ff')$$, 'P0002', 'order_not_found', 'confirmar pedido inexistente');
select throws_ok($$select public.confirm_payment('dddddddd-0000-0000-0000-000000000001')$$, 'P0001', 'already_paid', 'no se confirma dos veces un pago');
select matches(
  (select (public.confirm_payment('dddddddd-0000-0000-0000-000000000002')).coupon_token),
  '^[0-9a-f]{32}$', 'confirmar pago emite el token del cupón');

-- Consulta del escáner.
select is((select count(*)::int from public.lookup_coupon('ABC234')), 1, 'lookup por código corto');
select is((select count(*)::int from public.lookup_coupon('A1B2C3D4E5F60718293A4B5C6D7E8F90')), 1, 'lookup por token (insensible a mayúsculas)');
select is((select count(*)::int from public.lookup_coupon('NOEXISTE')), 0, 'lookup de código inexistente devuelve 0 filas');

-- Entrega.
select throws_ok($$select public.deliver_coupon('ffffffffffffffffffffffffffffffff')$$, 'P0002', 'coupon_not_found', 'entregar código inexistente');
select is((select (public.deliver_coupon('a1b2c3d4e5f60718293a4b5c6d7e8f90')).delivery_status), 'entregado', 'primera entrega correcta');
select throws_ok($$select public.deliver_coupon('a1b2c3d4e5f60718293a4b5c6d7e8f90')$$, 'P0001', 'already_delivered', 'segunda entrega rechazada');

reset role;
select is((select delivered_by from public.orders where short_code = 'ABC234'), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'se registra el administrador que entregó');
select isnt((select delivered_at from public.orders where short_code = 'ABC234'), null, 'se registra la fecha de entrega');
select throws_ok(
  $$update public.orders set delivery_status = 'pendiente', delivered_at = null where short_code = 'ABC234'$$,
  '23000', 'delivered_order_locked', 'una entrega no se puede deshacer');

-- La página pública refleja el estado entregado.
set local role anon;
select is((select delivery_status from public.get_public_coupon('a1b2c3d4e5f60718293a4b5c6d7e8f90')), 'entregado',
  'la página pública muestra el cupón como entregado');
reset role;

select * from finish();
rollback;
