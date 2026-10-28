import { useEffect, useState } from "react";
import { copyText } from "../lib/clipboard";
import { couponUrl, pickupInfo } from "../lib/config";
import { formatMoney } from "../lib/money";
import type { Order } from "../lib/types";
import CouponCard from "./CouponCard";
import { PaymentBadge } from "./StatusBadge";

interface Props {
  order: Order;
  onClose: () => void;
}

export default function CouponDialog({ order, onClose }: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  const token = order.coupon_token;
  const url = token ? couponUrl(token) : "";
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    const ok = await copyText(url);
    setNotice(ok ? "Enlace copiado." : "No se pudo copiar automáticamente: selecciona el enlace y cópialo.");
  }

  async function share() {
    try {
      await navigator.share({
        title: "Cupón de entrega",
        text: `Cupón para retirar tu pedido (${order.combo_name}):`,
        url,
      });
    } catch (e) {
      // Cancelar el menú de compartir no es un error.
      if (!(e instanceof DOMException && e.name === "AbortError")) await copy();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Cupón de ${order.buyer_name}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 print:static print:overflow-visible print:bg-white print:p-0"
    >
      <div className="mx-auto max-w-sm space-y-3">
        {!token ? (
          <div className="card text-center">
            <p className="text-sm">Este pedido no tiene cupón: el pago aún no está confirmado.</p>
            <button className="btn btn-secondary mt-3" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <CouponCard
              url={url}
              pickupInfo={pickupInfo}
              coupon={{
                buyerName: order.buyer_name,
                comboName: order.combo_name,
                quantity: order.quantity,
                shortCode: order.short_code,
                deliveryStatus: order.delivery_status,
              }}
            />

            <div className="card space-y-3 print:hidden">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Total: {formatMoney(order.total)}</span>
                <PaymentBadge status={order.payment_status} />
              </div>
              <input
                className="input font-mono text-xs"
                readOnly
                value={url}
                aria-label="Enlace del cupón"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-primary" onClick={() => void copy()}>
                  Copiar enlace
                </button>
                {canShare ? (
                  <button className="btn btn-primary" onClick={() => void share()}>
                    Compartir
                  </button>
                ) : (
                  <button className="btn btn-secondary" disabled title="Tu navegador no permite compartir; copia el enlace">
                    Compartir (no disponible)
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => window.print()}>
                  Imprimir / guardar PDF
                </button>
                <button className="btn btn-secondary" onClick={onClose}>
                  Cerrar
                </button>
              </div>
              {notice && (
                <p role="status" className="text-center text-sm text-slate-600">
                  {notice}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
