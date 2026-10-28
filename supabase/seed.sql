-- Datos de ejemplo SOLO para desarrollo local (se aplican con `supabase db reset`).
-- En producción los combos se crean desde el panel administrativo.
insert into public.combos (name, price, active) values
  ('Combo Hamburguesa', 5.00, true),
  ('Combo Pollo', 6.50, true),
  ('Combo Antiguo', 4.00, false);
