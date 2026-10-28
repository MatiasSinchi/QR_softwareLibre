// Traduce los errores de Supabase/Postgres (códigos estables de las funciones SQL) a mensajes claros.

const BY_MESSAGE: Record<string, string> = {
  not_authorized: "No tienes permiso para realizar esta acción.",
  invalid_name: "El nombre o el contacto no es válido.",
  invalid_quantity: "La cantidad debe ser un entero entre 1 y 100.",
  invalid_price: "El precio debe estar entre 0.01 y 9999.99.",
  combo_not_found: "El combo no existe.",
  combo_inactive: "El combo está inactivo.",
  order_not_found: "El pedido no existe.",
  already_paid: "Este pedido ya tenía el pago confirmado.",
  coupon_not_found: "Código inválido: no existe ningún cupón con ese código.",
  already_delivered: "Este cupón YA fue entregado. No se puede entregar de nuevo.",
  payment_not_confirmed: "El pago de este pedido no está confirmado.",
};

const BY_CODE: Record<string, string> = {
  "23505": "Ya existe un registro con ese valor (por ejemplo, un combo con el mismo nombre).",
  "23514": "Algún valor no cumple las reglas permitidas.",
  "42501": "No tienes permiso para realizar esta acción.",
};

export function errorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const { message, code } = error as { message?: string; code?: string };
    if (message && BY_MESSAGE[message]) return BY_MESSAGE[message];
    if (code && BY_CODE[code]) return BY_CODE[code];
    if (message === "Invalid login credentials") return "Correo o contraseña incorrectos.";
    if (message && /failed to fetch|networkerror|load failed/i.test(message)) {
      return "No se pudo conectar con el servidor. Revisa tu conexión.";
    }
  }
  return "Ocurrió un error inesperado. Inténtalo de nuevo.";
}
