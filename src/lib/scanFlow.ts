import { extractCouponCode, isValidCouponToken } from "./coupon";
import type { Order } from "./types";

export type ClassifiedCode =
  | { kind: "token"; code: string }
  | { kind: "short"; code: string }
  | { kind: "invalid" };

// El código corto son 6 letras/números (ver generate_short_code).
const SHORT_CODE = /^[A-Za-z0-9]{6}$/;

/**
 * Decide qué es lo que leyó la cámara o escribió el administrador:
 * URL de cupón / token (32 hex), código corto (6 caracteres) o algo que no es un cupón.
 * Así un QR ajeno no genera ninguna consulta al servidor.
 */
export function classifyCode(raw: string): ClassifiedCode {
  const code = extractCouponCode(raw);
  if (isValidCouponToken(code)) return { kind: "token", code: code.toLowerCase() };
  if (SHORT_CODE.test(code)) return { kind: "short", code: code.toUpperCase() };
  return { kind: "invalid" };
}

export type CouponStatus = "ready" | "delivered" | "unpaid";

export function couponStatus(order: Pick<Order, "payment_status" | "delivery_status">): CouponStatus {
  if (order.payment_status !== "pagado") return "unpaid";
  return order.delivery_status === "entregado" ? "delivered" : "ready";
}

export interface LastScan {
  code: string;
  at: number;
}

/** True si es la misma lectura que la anterior dentro de la ventana de tiempo (rebote de la cámara). */
export function isDuplicateScan(last: LastScan | null, code: string, now: number, windowMs = 2500): boolean {
  return last !== null && last.code === code && now - last.at < windowMs;
}
