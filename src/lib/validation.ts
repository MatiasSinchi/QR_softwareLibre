import { MAX_PRICE, parsePrice } from "./money";

// Mismos límites que las restricciones de la base de datos. La base de datos
// es la que manda; esto solo da mensajes rápidos antes de enviar.
export const MAX_QUANTITY = 100;
const MAX_TEXT = 120;

export interface OrderFormInput {
  buyerName: string;
  contact: string;
  comboId: string;
  quantity: string;
  unitPrice: string;
}

export type OrderFormErrors = Partial<Record<keyof OrderFormInput, string>>;

export function validateOrderForm(input: OrderFormInput): OrderFormErrors {
  const errors: OrderFormErrors = {};

  const name = input.buyerName.trim();
  if (name.length === 0) errors.buyerName = "Escribe el nombre del comprador.";
  else if (name.length > MAX_TEXT) errors.buyerName = `Máximo ${MAX_TEXT} caracteres.`;

  if (input.contact.trim().length > MAX_TEXT) errors.contact = `Máximo ${MAX_TEXT} caracteres.`;

  if (!input.comboId) errors.comboId = "Elige un combo.";

  const qty = Number(input.quantity);
  if (!/^\d+$/.test(input.quantity.trim()) || qty < 1 || qty > MAX_QUANTITY) {
    errors.quantity = `La cantidad debe ser un entero entre 1 y ${MAX_QUANTITY}.`;
  }

  const price = parsePrice(input.unitPrice);
  if (price === null) errors.unitPrice = "Precio inválido (máximo 2 decimales).";
  else if (price <= 0 || price > MAX_PRICE) errors.unitPrice = `El precio debe estar entre 0.01 y ${MAX_PRICE}.`;

  return errors;
}

export interface ComboFormInput {
  name: string;
  price: string;
}

export function validateComboForm(input: ComboFormInput): Partial<Record<keyof ComboFormInput, string>> {
  const errors: Partial<Record<keyof ComboFormInput, string>> = {};
  const name = input.name.trim();
  if (name.length === 0) errors.name = "Escribe el nombre del combo.";
  else if (name.length > 80) errors.name = "Máximo 80 caracteres.";

  const price = parsePrice(input.price);
  if (price === null) errors.price = "Precio inválido (máximo 2 decimales).";
  else if (price <= 0 || price > MAX_PRICE) errors.price = `El precio debe estar entre 0.01 y ${MAX_PRICE}.`;
  return errors;
}
