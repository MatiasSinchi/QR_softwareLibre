-- Migración 4: estadísticas del panel, calculadas en la base de datos.
-- El total recaudado suma únicamente pedidos con pago confirmado.

create function public.admin_stats()
returns table (
  total_orders            integer,
  paid_orders             integer,
  pending_payment_orders  integer,
  pending_delivery_orders integer,
  delivered_orders        integer,
  total_collected         numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
    select count(*)::integer,
           (count(*) filter (where o.payment_status = 'pagado'))::integer,
           (count(*) filter (where o.payment_status = 'pendiente'))::integer,
           (count(*) filter (where o.payment_status = 'pagado' and o.delivery_status = 'pendiente'))::integer,
           (count(*) filter (where o.delivery_status = 'entregado'))::integer,
           coalesce(sum(o.total) filter (where o.payment_status = 'pagado'), 0)::numeric
      from public.orders o;
end;
$$;

revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to authenticated;
