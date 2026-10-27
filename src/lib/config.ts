// Base pública para los enlaces de los cupones. En producción debe ser la URL de Vercel.
const base = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, "");

export function couponUrl(token: string): string {
  return `${base}/cupon/${encodeURIComponent(token)}`;
}
