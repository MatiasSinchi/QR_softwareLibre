import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CouponCard, { type CouponData } from "./CouponCard";

const base: CouponData = {
  buyerName: "Ana Pérez",
  comboName: "Combo Hamburguesa",
  quantity: 2,
  shortCode: "ABC234",
  deliveryStatus: "pendiente",
};
const url = "https://app.vercel.app/cupon/a1b2c3d4e5f60718293a4b5c6d7e8f90";

describe("CouponCard", () => {
  it("muestra solo la información necesaria y un QR", () => {
    const html = renderToStaticMarkup(<CouponCard coupon={base} url={url} />);
    expect(html).toContain("Ana Pérez");
    expect(html).toContain("Combo Hamburguesa");
    expect(html).toContain("ABC234");
    expect(html).toContain("Pendiente de entrega");
    expect(html).toContain("<svg");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
  });
  it("marca el cupón entregado y oculta las instrucciones", () => {
    const html = renderToStaticMarkup(<CouponCard coupon={{ ...base, deliveryStatus: "entregado" }} url={url} />);
    expect(html).toContain("ya fue entregado");
    expect(html).not.toContain("Cómo reclamar");
  });
  it("muestra el texto de entrega configurado", () => {
    const html = renderToStaticMarkup(<CouponCard coupon={base} url={url} pickupInfo="Viernes 15:00, puerta 2" />);
    expect(html).toContain("Viernes 15:00, puerta 2");
  });
});
