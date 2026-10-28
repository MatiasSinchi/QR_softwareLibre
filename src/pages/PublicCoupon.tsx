import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CouponCard, { type CouponData } from "../components/CouponCard";
import { couponUrl, pickupInfo } from "../lib/config";
import { isValidCouponToken } from "../lib/coupon";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";
import type { DeliveryStatus } from "../lib/types";

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "error"; message: string }
  | { kind: "ready"; coupon: CouponData };

interface PublicRow {
  buyer_name: string;
  combo_name: string;
  quantity: number;
  short_code: string;
  delivery_status: DeliveryStatus;
}

export default function PublicCoupon() {
  const { token = "" } = useParams();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    // Un token con formato incorrecto no puede existir: no hace falta consultar.
    if (!isValidCouponToken(token)) {
      setState({ kind: "invalid" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    supabase.rpc("get_public_coupon", { p_token: token }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) return setState({ kind: "error", message: errorMessage(error) });
      const row = (data as PublicRow[] | null)?.[0];
      if (!row) return setState({ kind: "invalid" });
      setState({
        kind: "ready",
        coupon: {
          buyerName: row.buyer_name,
          comboName: row.combo_name,
          quantity: row.quantity,
          shortCode: row.short_code,
          deliveryStatus: row.delivery_status,
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="mx-auto min-h-screen max-w-sm p-4">
      {state.kind === "loading" && <p className="p-8 text-center text-slate-500">Cargando cupón…</p>}

      {state.kind === "invalid" && (
        <div role="alert" className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-900">Cupón no válido</h1>
          <p className="mt-2 text-sm text-red-800">
            No encontramos un cupón con este enlace. Verifica que lo hayas copiado completo o consulta a la directiva.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div role="alert" className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-amber-900">No se pudo cargar el cupón</h1>
          <p className="mt-2 text-sm text-amber-800">{state.message}</p>
        </div>
      )}

      {state.kind === "ready" && (
        <CouponCard coupon={state.coupon} url={couponUrl(token)} pickupInfo={pickupInfo} />
      )}
    </main>
  );
}
