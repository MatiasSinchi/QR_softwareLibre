// Los tokens de cupón son 32 caracteres hexadecimales (ver migración 3).
const TOKEN_PATTERN = /^[0-9a-f]{32}$/i;

export function isValidCouponToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export function buildCouponUrl(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/cupon/${encodeURIComponent(token)}`;
}

/**
 * Obtiene el token a partir de lo que lee el escáner o escribe el administrador:
 * la URL completa del cupón, el token suelto o un código corto (se devuelve tal cual).
 */
export function extractCouponCode(raw: string): string {
  const text = raw.trim();
  const match = text.match(/\/cupon\/([0-9a-f]{32})(?:[/?#]|$)/i);
  return match ? match[1].toLowerCase() : text;
}
