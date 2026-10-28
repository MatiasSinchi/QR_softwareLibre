import { describe, expect, it } from "vitest";
import { buildCouponUrl, extractCouponCode, isValidCouponToken } from "./coupon";

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

describe("isValidCouponToken", () => {
  it("acepta 32 hex y rechaza todo lo demás", () => {
    expect(isValidCouponToken(TOKEN)).toBe(true);
    expect(isValidCouponToken(TOKEN.toUpperCase())).toBe(true);
    expect(isValidCouponToken(TOKEN.slice(1))).toBe(false);
    expect(isValidCouponToken(TOKEN + "0")).toBe(false);
    expect(isValidCouponToken("ABC234")).toBe(false);
    expect(isValidCouponToken("")).toBe(false);
    expect(isValidCouponToken(TOKEN.slice(1) + "g")).toBe(false);
    expect(isValidCouponToken("'; drop table orders;--")).toBe(false);
  });
});

describe("buildCouponUrl", () => {
  it("arma la URL sin barras duplicadas", () => {
    expect(buildCouponUrl("https://app.vercel.app", TOKEN)).toBe(`https://app.vercel.app/cupon/${TOKEN}`);
    expect(buildCouponUrl("https://app.vercel.app///", TOKEN)).toBe(`https://app.vercel.app/cupon/${TOKEN}`);
  });
});

describe("extractCouponCode", () => {
  it("extrae el token de la URL leída del QR", () => {
    expect(extractCouponCode(`https://app.vercel.app/cupon/${TOKEN}`)).toBe(TOKEN);
    expect(extractCouponCode(`  http://localhost:5173/cupon/${TOKEN}?x=1  `)).toBe(TOKEN);
    expect(extractCouponCode(`https://app.vercel.app/cupon/${TOKEN.toUpperCase()}`)).toBe(TOKEN);
  });
  it("devuelve tal cual un token o un código corto", () => {
    expect(extractCouponCode(TOKEN)).toBe(TOKEN);
    expect(extractCouponCode(" ABC234 ")).toBe("ABC234");
  });
  it("no extrae nada de URLs con un token incompleto", () => {
    expect(extractCouponCode("https://app.vercel.app/cupon/abc")).toBe("https://app.vercel.app/cupon/abc");
  });
});
