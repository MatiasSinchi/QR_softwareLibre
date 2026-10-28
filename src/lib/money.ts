// Los importes se calculan en centavos enteros para evitar errores de coma flotante.
// Es solo para mostrar: el total real lo calcula y guarda la base de datos.

export const MAX_PRICE = 9999.99;

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function orderTotal(quantity: number, unitPrice: number): number {
  return (quantity * toCents(unitPrice)) / 100;
}

export function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Acepta "5", "5.5", "5,50". Devuelve null si no es un número válido con hasta 2 decimales. */
export function parsePrice(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}
