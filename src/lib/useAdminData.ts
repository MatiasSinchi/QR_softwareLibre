import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "./errors";
import { supabase } from "./supabase";
import type { AdminStats, Combo, Order } from "./types";

// Con cientos de pedidos basta con cargar la lista y filtrar en el navegador.
// Las estadísticas vienen agregadas desde la base de datos, no de esta lista.
const ORDERS_LIMIT = 1000;

export function useAdminData() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [c, o, s] = await Promise.all([
      supabase.from("combos").select("*").order("created_at", { ascending: true }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(ORDERS_LIMIT),
      supabase.rpc("admin_stats").single(),
    ]);
    const failure = c.error ?? o.error ?? s.error;
    if (failure) {
      setError(errorMessage(failure));
    } else {
      setError(null);
      setCombos(c.data as Combo[]);
      setOrders(o.data as Order[]);
      setStats(s.data as AdminStats);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { combos, orders, stats, loading, error, reload };
}
