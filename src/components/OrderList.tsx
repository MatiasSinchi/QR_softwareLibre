import { useMemo, useState } from "react";
import { errorMessage } from "../lib/errors";
import { formatMoney } from "../lib/money";
import { supabase } from "../lib/supabase";
import type { DeliveryStatus, Order, PaymentStatus } from "../lib/types";
import { DeliveryBadge, PaymentBadge } from "./StatusBadge";

interface Props {
  orders: Order[];
  onChanged: () => Promise<void>;
  onShowCoupon: (order: Order) => void;
}

const dateFormat = new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "short" });

export default function OrderList({ orders, onChanged, onShowCoupon }: Props) {
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<"" | PaymentStatus>("");
  const [delivery, setDelivery] = useState<"" | DeliveryStatus>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (!q || o.buyer_name.toLowerCase().includes(q) || o.short_code.toLowerCase().includes(q)) &&
        (!payment || o.payment_status === payment) &&
        (!delivery || o.delivery_status === delivery),
    );
  }, [orders, search, payment, delivery]);

  async function confirmPayment(order: Order) {
    const ok = window.confirm(
      `Confirmar el pago de ${order.buyer_name} (${formatMoney(order.total)})?\nSe generará su cupón y no se podrá deshacer.`,
    );
    if (!ok) return;
    setBusyId(order.id);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("confirm_payment", { p_order_id: order.id }).single();
    if (rpcError) setError(errorMessage(rpcError));
    await onChanged();
    setBusyId(null);
    if (data) onShowCoupon(data as Order);
  }

  return (
    <section className="space-y-3" aria-label="Pedidos">
      <h2 className="text-lg font-semibold">Pedidos</h2>

      <div className="grid gap-2 sm:grid-cols-3">
        <input
          className="input"
          type="search"
          placeholder="Buscar por nombre o código"
          aria-label="Buscar por nombre o código"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          aria-label="Filtrar por pago"
          value={payment}
          onChange={(e) => setPayment(e.target.value as "" | PaymentStatus)}
        >
          <option value="">Todos los pagos</option>
          <option value="pagado">Pagados</option>
          <option value="pendiente">Pago pendiente</option>
        </select>
        <select
          className="input"
          aria-label="Filtrar por entrega"
          value={delivery}
          onChange={(e) => setDelivery(e.target.value as "" | DeliveryStatus)}
        >
          <option value="">Todas las entregas</option>
          <option value="pendiente">Pendientes de entrega</option>
          <option value="entregado">Entregados</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="card text-center text-sm text-slate-500">
          {orders.length === 0 ? "Aún no hay pedidos." : "Ningún pedido coincide con la búsqueda."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((o) => (
            <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{o.buyer_name}</p>
                <p className="text-sm text-slate-600">
                  {o.quantity} × {o.combo_name} · {formatMoney(o.total)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  <span className="font-mono font-semibold tracking-wider text-slate-700">{o.short_code}</span> ·{" "}
                  {dateFormat.format(new Date(o.created_at))}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PaymentBadge status={o.payment_status} />
                {o.payment_status === "pagado" && <DeliveryBadge status={o.delivery_status} />}
                {o.payment_status === "pagado" && (
                  <button className="btn btn-secondary" onClick={() => onShowCoupon(o)}>
                    Ver cupón
                  </button>
                )}
                {o.payment_status === "pendiente" && (
                  <button className="btn btn-primary" disabled={busyId === o.id} onClick={() => void confirmPayment(o)}>
                    {busyId === o.id ? "Confirmando…" : "Confirmar pago"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {orders.length >= 1000 && (
        <p className="text-xs text-amber-700">Se muestran solo los 1000 pedidos más recientes.</p>
      )}
    </section>
  );
}
