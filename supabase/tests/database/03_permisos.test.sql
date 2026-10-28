-- Pruebas pgTAP: invariantes de permisos del esquema public.
-- Si alguien añade una función o tabla sin cerrar sus permisos, estas pruebas fallan.
begin;
select no_plan();

-- 1. La ÚNICA función ejecutable por anon es get_public_coupon.
select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  array['get_public_coupon'],
  'anon solo puede ejecutar get_public_coupon');

-- 2. Las funciones auxiliares e internas no son ejecutables por ningún rol de la API.
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('generate_coupon_token', 'generate_short_code', 'orders_guard')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  0, 'funciones auxiliares y del trigger no son ejecutables por anon ni authenticated');

-- 3. Toda función SECURITY DEFINER fija su search_path (evita suplantación de objetos).
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not coalesce(p.proconfig::text ilike '%search_path%', false)),
  0, 'todas las funciones SECURITY DEFINER fijan search_path');

-- 4. Toda tabla de public tiene RLS activado.
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'todas las tablas de public tienen RLS activado');

-- 5. anon no tiene ningún permiso directo sobre tablas.
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')),
  0, 'anon no tiene permisos directos sobre ninguna tabla');

-- 6. authenticated no puede escribir directamente en orders ni admin_profiles, ni borrar nada.
select is(
  (select count(*)::int from (values ('orders'), ('admin_profiles')) t(n)
    where has_table_privilege('authenticated', ('public.' || n)::regclass, 'insert')
       or has_table_privilege('authenticated', ('public.' || n)::regclass, 'update')
       or has_table_privilege('authenticated', ('public.' || n)::regclass, 'delete')),
  0, 'authenticated no puede escribir directamente en orders ni admin_profiles');
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and has_table_privilege('authenticated', c.oid, 'delete')),
  0, 'authenticated no puede borrar filas de ninguna tabla');

-- 7. No hay vistas en public que pudieran saltarse RLS.
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')),
  0, 'no hay vistas ni vistas materializadas expuestas en public');

select * from finish();
rollback;
