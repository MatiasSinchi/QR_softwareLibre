-- Migración 5: higiene de permisos.
-- La función del trigger orders_guard no debe ser ejecutable por los roles de la API.
-- (El trigger sigue funcionando: EXECUTE se comprueba al crear el trigger, no al dispararlo.)
revoke all on function public.orders_guard() from public, anon, authenticated;
