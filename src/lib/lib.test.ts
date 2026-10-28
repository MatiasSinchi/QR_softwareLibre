import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";
import { formatMoney, orderTotal, parsePrice } from "./money";
import { validateComboForm, validateOrderForm, type OrderFormInput } from "./validation";

const valid: OrderFormInput = {
  buyerName: "Ana",
  contact: "",
  comboId: "abc",
  quantity: "2",
  unitPrice: "5.50",
};

describe("money", () => {
  it("calcula el total sin errores de coma flotante", () => {
    expect(orderTotal(3, 0.1)).toBe(0.3);
    expect(orderTotal(7, 19.99)).toBe(139.93);
    expect(orderTotal(100, 9999.99)).toBe(999999);
  });
  it("formatea con dos decimales", () => {
    expect(formatMoney(5)).toBe("$5.00");
    expect(formatMoney(0.3)).toBe("$0.30");
  });
  it("interpreta precios válidos e inválidos", () => {
    expect(parsePrice("5")).toBe(5);
    expect(parsePrice(" 5,5 ")).toBe(5.5);
    expect(parsePrice("5.555")).toBeNull();
    expect(parsePrice("-3")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("1e3")).toBeNull();
  });
});

describe("validateOrderForm", () => {
  it("acepta un formulario correcto", () => {
    expect(validateOrderForm(valid)).toEqual({});
  });
  it.each(["0", "-1", "101", "1.5", "abc", "", " "])("rechaza la cantidad %j", (quantity) => {
    expect(validateOrderForm({ ...valid, quantity }).quantity).toBeDefined();
  });
  it.each(["0", "0.00", "-2", "10000", "x", "", "1.234"])("rechaza el precio %j", (unitPrice) => {
    expect(validateOrderForm({ ...valid, unitPrice }).unitPrice).toBeDefined();
  });
  it("acepta los límites", () => {
    expect(validateOrderForm({ ...valid, quantity: "1", unitPrice: "0.01" })).toEqual({});
    expect(validateOrderForm({ ...valid, quantity: "100", unitPrice: "9999.99" })).toEqual({});
  });
  it("exige nombre y combo", () => {
    const errors = validateOrderForm({ ...valid, buyerName: "   ", comboId: "" });
    expect(errors.buyerName).toBeDefined();
    expect(errors.comboId).toBeDefined();
  });
  it("limita la longitud del nombre y del contacto", () => {
    expect(validateOrderForm({ ...valid, buyerName: "a".repeat(121) }).buyerName).toBeDefined();
    expect(validateOrderForm({ ...valid, contact: "a".repeat(121) }).contact).toBeDefined();
  });
});

describe("validateComboForm", () => {
  it("valida nombre y precio", () => {
    expect(validateComboForm({ name: "Combo", price: "5" })).toEqual({});
    expect(validateComboForm({ name: " ", price: "0" })).toEqual({
      name: expect.any(String),
      price: expect.any(String),
    });
  });
});

describe("errorMessage", () => {
  it("traduce los códigos de las funciones SQL", () => {
    expect(errorMessage({ message: "already_delivered" })).toMatch(/YA fue entregado/);
    expect(errorMessage({ message: "coupon_not_found" })).toMatch(/inválido/i);
  });
  it("traduce códigos de Postgres", () => {
    expect(errorMessage({ message: "duplicate key ...", code: "23505" })).toMatch(/Ya existe/);
  });
  it("no filtra detalles internos desconocidos", () => {
    expect(errorMessage({ message: 'relation "x" does not exist' })).toBe(
      "Ocurrió un error inesperado. Inténtalo de nuevo.",
    );
    expect(errorMessage(null)).toBe("Ocurrió un error inesperado. Inténtalo de nuevo.");
  });
});
