import { useState } from "react";
import { Link } from "react-router-dom";
import ComboManager from "../components/ComboManager";
import OrderForm from "../components/OrderForm";
import OrderList from "../components/OrderList";
import StatsCards from "../components/StatsCards";
import { useAuth } from "../lib/auth";
import { useAdminData } from "../lib/useAdminData";
import type { Order } from "../lib/types";

export default function Admin() {
  const { session, signOut } = useAuth();
  const { combos, orders, stats, loading, error, reload } = useAdminData();
  const [lastCreated, setLastCreated] = useState<Order | null>(null);

  async function onCreated(order: Order) {
    setLastCreated(order);
    await reload();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Panel de cupones</h1>
          <p className="text-xs text-slate-500">{session?.user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/scan" className="btn btn-primary">
            Escanear
          </Link>
          <button className="btn btn-secondary" onClick={() => void signOut()}>
            Salir
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-slate-500">Cargando datos…</p>}

      {stats && <StatsCards stats={stats} />}

      {lastCreated && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
          Compra de <strong>{lastCreated.buyer_name}</strong> registrada. Código{" "}
          <span className="font-mono font-semibold">{lastCreated.short_code}</span>
          {lastCreated.payment_status === "pagado" ? " — cupón generado." : " — queda pendiente de pago."}
        </p>
      )}

      <OrderForm combos={combos} onCreated={onCreated} />
      <OrderList orders={orders} onChanged={reload} />
      <ComboManager combos={combos} onChanged={reload} />
    </div>
  );
}
