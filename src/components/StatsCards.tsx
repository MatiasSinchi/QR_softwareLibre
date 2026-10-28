import { formatMoney } from "../lib/money";
import type { AdminStats } from "../lib/types";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function StatsCards({ stats }: { stats: AdminStats }) {
  return (
    <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Stat label="Pedidos" value={stats.total_orders} hint={`${stats.pending_payment_orders} sin pagar`} />
      <Stat label="Pagados" value={stats.paid_orders} />
      <Stat label="Por entregar" value={stats.pending_delivery_orders} />
      <Stat label="Entregados" value={stats.delivered_orders} />
      <Stat label="Recaudado" value={formatMoney(stats.total_collected)} hint="Solo pagos confirmados" />
    </section>
  );
}
