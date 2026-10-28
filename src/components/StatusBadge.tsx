import type { DeliveryStatus, PaymentStatus } from "../lib/types";

const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return status === "pagado" ? (
    <span className={`${base} bg-green-100 text-green-800`}>Pagado</span>
  ) : (
    <span className={`${base} bg-amber-100 text-amber-800`}>Pago pendiente</span>
  );
}

export function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  return status === "entregado" ? (
    <span className={`${base} bg-violet-100 text-violet-800`}>Entregado</span>
  ) : (
    <span className={`${base} bg-sky-100 text-sky-800`}>Pendiente de entrega</span>
  );
}
