-- Pruebas pgTAP: admin_stats (permisos y cálculo del total recaudado).
begin;
select no_plan();

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'otro@test.local');
insert into public.admin_profiles (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.combos (id, name, price) values ('cccccccc-0000-0000-0000-000000000001', 'Combo Stats', 5.00);

-- Datos conocidos: 1 pagado (2 x 5 = 10) entregado, 1 pagado (1 x 7 = 7) pendiente de entrega, 1 sin pagar (3 x 5 = 15).
insert into public.orders (short_code, coupon_token, buyer_name, combo_id, combo_name, quantity, unit_price,
                           payment_status, paid_at, delivery_status, delivered_at)
values
  ('STA234', 'a1b2c3d4e5f60718293a4b5c6d7e8f01', 'Uno', 'cccccccc-0000-0000-0000-000000000001', 'Combo Stats', 2, 5, 'pagado', now(), 'entregado', now()),
  ('STA235', 'a1b2c3d4e5f60718293a4b5c6d7e8f02', 'Dos', 'cccccccc-0000-0000-0000-000000000001', 'Combo Stats', 1, 7, 'pagado', now(), 'pendiente', null);
insert into public.orders (short_code, buyer_name, combo_id, combo_name, quantity, unit_price)
values ('STA236', 'Tres', 'cccccccc-0000-0000-0000-000000000001', 'Combo Stats', 3, 5);

set local role anon;
select throws_ok($$select * from public.admin_stats()$$, '42501', null, 'anon no puede ejecutar admin_stats');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select * from public.admin_stats()$$, '42501', 'not_authorized', 'un usuario no admin no obtiene estadísticas');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
select results_eq(
  $$select total_orders, paid_orders, pending_payment_orders, pending_delivery_orders, delivered_orders, total_collected
      from public.admin_stats()$$,
  $$values (3, 2, 1, 1, 1, 17.00::numeric)$$,
  'conteos correctos y total recaudado = solo pagos confirmados (10 + 7, sin los 15 pendientes)');
reset role;

select * from finish();
rollback;
