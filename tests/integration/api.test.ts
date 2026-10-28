import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Pruebas de integración con el MISMO cliente que usa la app, contra Supabase LOCAL.
// Usan la clave service_role solo para crear/borrar usuarios de prueba, por eso se niegan
// a ejecutarse contra cualquier URL que no sea local.

const URL = process.env.SUPABASE_URL ?? "";
const ANON = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL)) {
  throw new Error(`Estas pruebas solo corren contra Supabase local. URL recibida: "${URL}". Usa scripts/test-integration.sh`);
}
if (!ANON || !SERVICE) throw new Error("Faltan SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");

const run = Math.random().toString(36).slice(2, 8);
const PASSWORD = `Prueba-${run}-123!`;
const mk = (key = ANON): SupabaseClient => createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });

const service = mk(SERVICE);
const anon = mk();
let admin: SupabaseClient;
let other: SupabaseClient;
let adminId = "";
let otherId = "";
let comboId = "";
let inactiveComboId = "";
const COMBO_PRICE = 5;

const TOKEN = /^[0-9a-f]{32}$/;

async function newOrder(client: SupabaseClient, over: Record<string, unknown> = {}) {
  return client
    .rpc("create_order", {
      p_buyer_name: `IT-${run} Comprador`,
      p_buyer_contact: null,
      p_combo_id: comboId,
      p_quantity: 1,
      p_unit_price: null,
      p_paid: true,
      ...over,
    })
    .single<Record<string, any>>();
}

beforeAll(async () => {
  const mkUser = async (label: string) => {
    const email = `it-${run}-${label}@integration.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    return { id: data.user.id, email };
  };
  const a = await mkUser("admin");
  const o = await mkUser("otro");
  adminId = a.id;
  otherId = o.id;
  await service.from("admin_profiles").insert({ user_id: adminId });

  admin = mk();
  other = mk();
  const l1 = await admin.auth.signInWithPassword({ email: a.email, password: PASSWORD });
  const l2 = await other.auth.signInWithPassword({ email: o.email, password: PASSWORD });
  if (l1.error || l2.error) throw l1.error ?? l2.error;

  const c1 = await service.from("combos").insert({ name: `IT-${run} Combo`, price: COMBO_PRICE }).select().single();
  const c2 = await service.from("combos").insert({ name: `IT-${run} Inactivo`, price: 4, active: false }).select().single();
  comboId = c1.data!.id;
  inactiveComboId = c2.data!.id;
});

afterAll(async () => {
  await service.from("orders").delete().in("combo_id", [comboId, inactiveComboId]);
  await service.from("combos").delete().in("id", [comboId, inactiveComboId]);
  await service.from("admin_profiles").delete().eq("user_id", adminId);
  await service.auth.admin.deleteUser(adminId);
  await service.auth.admin.deleteUser(otherId);
});

describe("autenticación", () => {
  it("rechaza una contraseña incorrecta", async () => {
    const c = mk();
    const { error } = await c.auth.signInWithPassword({ email: `it-${run}-admin@integration.test`, password: "incorrecta" });
    expect(error).not.toBeNull();
  });
  it("no permite el registro público", async () => {
    const { error } = await mk().auth.signUp({ email: `intruso-${run}@x.test`, password: "abcdef123456" });
    expect(error).not.toBeNull();
  });
  it("el administrador se reconoce por admin_profiles; un usuario normal no", async () => {
    expect((await admin.from("admin_profiles").select("user_id").maybeSingle()).data?.user_id).toBe(adminId);
    expect((await other.from("admin_profiles").select("user_id").maybeSingle()).data).toBeNull();
  });
});

describe("registrar compras (administrador)", () => {
  it("compra pagada: emite token y calcula el total en el servidor", async () => {
    const { data, error } = await newOrder(admin, { p_quantity: 3 });
    expect(error).toBeNull();
    expect(data!.coupon_token).toMatch(TOKEN);
    expect(data!.total).toBe(15);
    expect(data!.unit_price).toBe(COMBO_PRICE);
    expect(data!.payment_status).toBe("pagado");
    expect(data!.delivery_status).toBe("pendiente");
  });
  it("compra pendiente: NO tiene token ni cupón", async () => {
    const { data } = await newOrder(admin, { p_paid: false, p_unit_price: 2.5, p_quantity: 4 });
    expect(data!.coupon_token).toBeNull();
    expect(data!.total).toBe(10);
    expect(data!.payment_status).toBe("pendiente");
  });
  it.each([
    ["cantidad 0", { p_quantity: 0 }, "invalid_quantity"],
    ["cantidad 101", { p_quantity: 101 }, "invalid_quantity"],
    ["cantidad negativa", { p_quantity: -2 }, "invalid_quantity"],
    ["precio 0", { p_unit_price: 0 }, "invalid_price"],
    ["precio negativo", { p_unit_price: -5 }, "invalid_price"],
    ["precio excesivo", { p_unit_price: 10000 }, "invalid_price"],
    ["nombre vacío", { p_buyer_name: "   " }, "invalid_name"],
    ["nombre larguísimo", { p_buyer_name: "x".repeat(121) }, "invalid_name"],
    ["combo inexistente", { p_combo_id: "00000000-0000-0000-0000-000000000000" }, "combo_not_found"],
  ])("rechaza %s", async (_label, over, code) => {
    const { error } = await newOrder(admin, over);
    expect(error?.message).toBe(code);
  });
  it("rechaza un combo inactivo", async () => {
    const { error } = await newOrder(admin, { p_combo_id: inactiveComboId });
    expect(error?.message).toBe("combo_inactive");
  });
  it("ni el administrador puede escribir directamente en orders (solo vía funciones)", async () => {
    const ins = await admin.from("orders").insert({ short_code: "HAK234", buyer_name: "x", combo_id: comboId, combo_name: "x", quantity: 1, unit_price: 1 });
    expect(ins.error?.code).toBe("42501");
    const { data } = await newOrder(admin);
    const upd = await admin.from("orders").update({ delivery_status: "entregado" }).eq("id", data!.id);
    expect(upd.error?.code).toBe("42501");
    const del = await admin.from("orders").delete().eq("id", data!.id);
    expect(del.error?.code).toBe("42501");
  });
});

describe("confirmar pago", () => {
  it("emite el cupón una sola vez", async () => {
    const { data: pending } = await newOrder(admin, { p_paid: false });
    const ok = await admin.rpc("confirm_payment", { p_order_id: pending!.id }).single<Record<string, any>>();
    expect(ok.data!.coupon_token).toMatch(TOKEN);
    const again = await admin.rpc("confirm_payment", { p_order_id: pending!.id }).single();
    expect(again.error?.message).toBe("already_paid");
    const missing = await admin.rpc("confirm_payment", { p_order_id: "00000000-0000-0000-0000-000000000000" }).single();
    expect(missing.error?.message).toBe("order_not_found");
  });
  it("con solicitudes simultáneas solo una confirma el pago", async () => {
    const { data: pending } = await newOrder(admin, { p_paid: false });
    const results = await Promise.all(Array.from({ length: 10 }, () => admin.rpc("confirm_payment", { p_order_id: pending!.id }).single()));
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(results.filter((r) => r.error?.message === "already_paid")).toHaveLength(9);
  });
});

describe("entrega", () => {
  it("entrega una vez, registra quién y cuándo, y rechaza la segunda", async () => {
    const { data: order } = await newOrder(admin);
    const first = await admin.rpc("deliver_coupon", { p_token: order!.coupon_token }).single<Record<string, any>>();
    expect(first.error).toBeNull();
    expect(first.data!.delivery_status).toBe("entregado");
    expect(first.data!.delivered_by).toBe(adminId);
    expect(first.data!.delivered_at).toBeTruthy();

    const second = await admin.rpc("deliver_coupon", { p_token: order!.coupon_token }).single();
    expect(second.error?.message).toBe("already_delivered");

    const pub = await anon.rpc("get_public_coupon", { p_token: order!.coupon_token });
    expect((pub.data as any[])[0].delivery_status).toBe("entregado");
  });
  it("un pedido NO pagado no se puede entregar (ni con su id ni con su código corto)", async () => {
    const { data: pending } = await newOrder(admin, { p_paid: false });
    for (const code of [pending!.id, pending!.short_code, "", "x"]) {
      const r = await admin.rpc("deliver_coupon", { p_token: code }).single();
      expect(r.error?.message).toBe("coupon_not_found");
    }
    const found = await admin.rpc("lookup_coupon", { p_code: pending!.short_code });
    expect((found.data as any[])[0].delivery_status).toBe("pendiente");
  });
  it("código inexistente → coupon_not_found y lookup vacío", async () => {
    expect((await admin.rpc("deliver_coupon", { p_token: "f".repeat(32) }).single()).error?.message).toBe("coupon_not_found");
    expect((await admin.rpc("lookup_coupon", { p_code: "ZZZZZ9" })).data).toEqual([]);
  });
  it("lookup encuentra por código corto y por token", async () => {
    const { data: order } = await newOrder(admin);
    expect(((await admin.rpc("lookup_coupon", { p_code: order!.short_code.toLowerCase() })).data as any[])[0].id).toBe(order!.id);
    expect(((await admin.rpc("lookup_coupon", { p_code: order!.coupon_token })).data as any[])[0].id).toBe(order!.id);
  });
  it("20 solicitudes SIMULTÁNEAS para el mismo cupón: solo una tiene éxito", async () => {
    const { data: order } = await newOrder(admin);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => admin.rpc("deliver_coupon", { p_token: order!.coupon_token }).single()),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(results.filter((r) => r.error?.message === "already_delivered")).toHaveLength(19);
    const { data } = await service.from("orders").select("delivery_status, delivered_by").eq("id", order!.id).single();
    expect(data).toEqual({ delivery_status: "entregado", delivered_by: adminId });
  });
});

describe("visitante anónimo (comprador)", () => {
  it("no puede leer ni escribir tablas", async () => {
    for (const t of ["orders", "combos", "admin_profiles"]) {
      expect((await anon.from(t).select("*")).error?.code).toBe("42501");
    }
    expect((await anon.from("orders").update({ delivery_status: "entregado" }).eq("short_code", "ABC234")).error?.code).toBe("42501");
  });
  it("no puede ejecutar ninguna función administrativa ni auxiliar", async () => {
    const calls = [
      anon.rpc("create_order", { p_buyer_name: "x", p_buyer_contact: null, p_combo_id: comboId, p_quantity: 1, p_unit_price: null, p_paid: true }),
      anon.rpc("confirm_payment", { p_order_id: comboId }),
      anon.rpc("lookup_coupon", { p_code: "ABC234" }),
      anon.rpc("deliver_coupon", { p_token: "x" }),
      anon.rpc("admin_stats"),
      anon.rpc("is_admin"),
      anon.rpc("generate_coupon_token"),
      anon.rpc("generate_short_code"),
    ];
    for (const r of await Promise.all(calls)) expect(r.error?.code).toBe("42501");
  });
  it("con un token válido ve SOLO los 5 campos mínimos de su cupón", async () => {
    const { data: a } = await newOrder(admin, { p_buyer_name: `IT-${run} Ana`, p_buyer_contact: "0991111111", p_quantity: 2 });
    const { data: b } = await newOrder(admin, { p_buyer_name: `IT-${run} Beto`, p_buyer_contact: "0992222222" });
    const pub = await anon.rpc("get_public_coupon", { p_token: a!.coupon_token });
    const rows = pub.data as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["buyer_name", "combo_name", "delivery_status", "quantity", "short_code"]);
    expect(rows[0].buyer_name).toBe(`IT-${run} Ana`);
    // No se filtra nada del otro comprador ni datos sensibles.
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain("Beto");
    expect(dump).not.toContain("0991111111");
    expect(dump).not.toContain(b!.coupon_token);
  });
  it.each([
    ["token inexistente", "0".repeat(32)],
    ["token con otra capitalización inexistente", "A".repeat(32)],
    ["vacío", ""],
    ["comodín %", "%"],
    ["inyección SQL", "' OR '1'='1"],
  ])("%s → ninguna fila", async (_l, token) => {
    const { data, error } = await anon.rpc("get_public_coupon", { p_token: token });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
  it("ni el id interno ni el código corto abren la página pública", async () => {
    const { data: o } = await newOrder(admin);
    expect(((await anon.rpc("get_public_coupon", { p_token: o!.id })).data as unknown[]).length).toBe(0);
    expect(((await anon.rpc("get_public_coupon", { p_token: o!.short_code })).data as unknown[]).length).toBe(0);
  });
  it("un pedido pendiente no tiene página pública", async () => {
    const { data: o } = await newOrder(admin, { p_paid: false });
    expect(((await anon.rpc("get_public_coupon", { p_token: o!.id })).data as unknown[]).length).toBe(0);
  });
});

describe("usuario autenticado que NO es administrador", () => {
  it("no ve pedidos ni combos, y no puede escribir", async () => {
    await newOrder(admin);
    expect(((await other.from("orders").select("*")).data as unknown[]).length).toBe(0);
    expect(((await other.from("combos").select("*")).data as unknown[]).length).toBe(0);
    expect((await other.from("combos").insert({ name: "Hack", price: 1 })).error?.code).toBe("42501");
    expect((await other.from("admin_profiles").insert({ user_id: otherId })).error?.code).toBe("42501");
  });
  it("las funciones administrativas devuelven not_authorized", async () => {
    const { data: o } = await newOrder(admin);
    expect((await newOrder(other)).error?.message).toBe("not_authorized");
    expect((await other.rpc("deliver_coupon", { p_token: o!.coupon_token }).single()).error?.message).toBe("not_authorized");
    expect((await other.rpc("confirm_payment", { p_order_id: o!.id }).single()).error?.message).toBe("not_authorized");
    expect((await other.rpc("lookup_coupon", { p_code: o!.short_code })).error?.message).toBe("not_authorized");
    expect((await other.rpc("admin_stats").single()).error?.message).toBe("not_authorized");
    const { data } = await service.from("orders").select("delivery_status").eq("id", o!.id).single();
    expect(data!.delivery_status).toBe("pendiente");
  });
});

describe("estadísticas", () => {
  it("el total recaudado suma solo pagos confirmados", async () => {
    const before = (await admin.rpc("admin_stats").single<Record<string, any>>()).data!;
    await newOrder(admin, { p_quantity: 2, p_unit_price: 10 }); // pagado: +20
    await newOrder(admin, { p_quantity: 5, p_unit_price: 10, p_paid: false }); // pendiente: +0
    const after = (await admin.rpc("admin_stats").single<Record<string, any>>()).data!;
    expect(after.total_orders - before.total_orders).toBe(2);
    expect(after.paid_orders - before.paid_orders).toBe(1);
    expect(after.pending_payment_orders - before.pending_payment_orders).toBe(1);
    expect(after.total_collected - before.total_collected).toBe(20);
  });
});
