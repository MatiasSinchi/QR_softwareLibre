import { QRCodeSVG } from "qrcode.react";
import type { DeliveryStatus } from "../lib/types";
import { DeliveryBadge } from "./StatusBadge";

export interface CouponData {
  buyerName: string;
  comboName: string;
  quantity: number;
  shortCode: string;
  deliveryStatus: DeliveryStatus;
}

interface Props {
  coupon: CouponData;
  url: string;
  pickupInfo?: string | null;
}

// Tarjeta del cupón: la ve el comprador en su teléfono (y en su captura de pantalla)
// y el administrador al registrar la compra. Es solo de lectura.
export default function CouponCard({ coupon, url, pickupInfo }: Props) {
  const delivered = coupon.deliveryStatus === "entregado";

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className={delivered ? "bg-violet-700 px-5 py-4 text-white" : "bg-indigo-600 px-5 py-4 text-white"}>
        <p className="text-xs font-medium uppercase tracking-widest opacity-80">Cupón de entrega</p>
        <p className="mt-0.5 text-xl font-semibold">{coupon.comboName}</p>
      </header>

      <div className="space-y-4 p-5">
        <div className="flex justify-center">
          <div className={delivered ? "rounded-xl bg-white p-3 opacity-30" : "rounded-xl bg-white p-3"}>
            <QRCodeSVG value={url} size={220} level="M" marginSize={2} title={`Cupón ${coupon.shortCode}`} />
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">Código</p>
          <p className="font-mono text-3xl font-bold tracking-[0.25em] text-slate-900">{coupon.shortCode}</p>
        </div>

        <div className="flex justify-center">
          <DeliveryBadge status={coupon.deliveryStatus} />
        </div>
        {delivered && (
          <p role="status" className="rounded-lg bg-violet-50 px-3 py-2 text-center text-sm font-medium text-violet-900">
            Este cupón ya fue entregado y no puede usarse de nuevo.
          </p>
        )}

        <dl className="divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
          <div className="flex justify-between gap-4 px-3 py-2">
            <dt className="text-slate-500">A nombre de</dt>
            <dd className="text-right font-medium">{coupon.buyerName}</dd>
          </div>
          <div className="flex justify-between gap-4 px-3 py-2">
            <dt className="text-slate-500">Combo</dt>
            <dd className="text-right font-medium">{coupon.comboName}</dd>
          </div>
          <div className="flex justify-between gap-4 px-3 py-2">
            <dt className="text-slate-500">Cantidad</dt>
            <dd className="text-right font-medium">{coupon.quantity}</dd>
          </div>
        </dl>

        {!delivered && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p className="font-medium text-slate-700">Cómo reclamar tu pedido</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Guarda una captura de pantalla de este cupón.</li>
              <li>Muéstrala en el punto de entrega para que escaneen el QR.</li>
              <li>Cada cupón se entrega una sola vez.</li>
            </ol>
            {pickupInfo && <p className="mt-2 font-medium text-slate-700">{pickupInfo}</p>}
          </div>
        )}
      </div>
    </article>
  );
}
