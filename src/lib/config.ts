import { buildCouponUrl } from "./coupon";

// Base pública para los enlaces de los cupones. En producción debe ser la URL de Vercel.
const base = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;

export function couponUrl(token: string): string {
  return buildCouponUrl(base, token);
}

// Texto opcional con lugar y fecha de entrega, que se muestra en el cupón.
export const pickupInfo = import.meta.env.VITE_PICKUP_INFO?.trim() || null;
