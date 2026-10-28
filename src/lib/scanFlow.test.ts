import { describe, expect, it } from "vitest";
import { classifyCode, couponStatus, isDuplicateScan } from "./scanFlow";

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

describe("classifyCode", () => {
  it("reconoce la URL del cupón leída del QR", () => {
    expect(classifyCode(`https://app.vercel.app/cupon/${TOKEN}`)).toEqual({ kind: "token", code: TOKEN });
  });
  it("reconoce un token suelto, en cualquier capitalización", () => {
    expect(classifyCode(TOKEN.toUpperCase())).toEqual({ kind: "token", code: TOKEN });
  });
  it("reconoce el código corto escrito a mano", () => {
    expect(classifyCode(" abc234 ")).toEqual({ kind: "short", code: "ABC234" });
  });
  it.each([
    "",
    "   ",
    "hola",
    "https://example.com/otra-cosa",
    "https://app.vercel.app/cupon/abc",
    "WIFI:S:red;T:WPA;P:clave;;",
    "a".repeat(500),
    "ABC 234",
  ])("trata %j como no válido (sin consultar al servidor)", (raw) => {
    expect(classifyCode(raw)).toEqual({ kind: "invalid" });
  });
});

describe("couponStatus", () => {
  it("distingue listo, entregado y sin pagar", () => {
    expect(couponStatus({ payment_status: "pagado", delivery_status: "pendiente" })).toBe("ready");
    expect(couponStatus({ payment_status: "pagado", delivery_status: "entregado" })).toBe("delivered");
    expect(couponStatus({ payment_status: "pendiente", delivery_status: "pendiente" })).toBe("unpaid");
  });
});

describe("isDuplicateScan", () => {
  it("ignora la misma lectura dentro de la ventana", () => {
    const last = { code: TOKEN, at: 1000 };
    expect(isDuplicateScan(last, TOKEN, 1500)).toBe(true);
    expect(isDuplicateScan(last, TOKEN, 3499)).toBe(true);
  });
  it("acepta la misma lectura pasada la ventana, o una distinta", () => {
    const last = { code: TOKEN, at: 1000 };
    expect(isDuplicateScan(last, TOKEN, 3500)).toBe(false);
    expect(isDuplicateScan(last, "otro", 1100)).toBe(false);
    expect(isDuplicateScan(null, TOKEN, 1100)).toBe(false);
  });
});
