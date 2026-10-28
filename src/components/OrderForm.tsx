import { useMemo, useState, type FormEvent } from "react";
import { errorMessage } from "../lib/errors";
import { formatMoney, orderTotal, parsePrice, toCents } from "../lib/money";
import { supabase } from "../lib/supabase";
import type { Combo, Order } from "../lib/types";
import { validateOrderForm, type OrderFormErrors } from "../lib/validation";

interface Props {
  combos: Combo[];
  onCreated: (order: Order) => void;
}

export default function OrderForm({ combos, onCreated }: Props) {
  const activeCombos = useMemo(() => combos.filter((c) => c.active), [combos]);

  const [buyerName, setBuyerName] = useState("");
  const [contact, setContact] = useState("");
  const [comboId, setComboId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [paid, setPaid] = useState(true);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const combo = activeCombos.find((c) => c.id === comboId);
  const price = parsePrice(unitPrice);
  const qty = /^\d+$/.test(quantity.trim()) ? Number(quantity) : null;
  const total = price !== null && qty !== null ? orderTotal(qty, price) : null;

  function onComboChange(id: string) {
    setComboId(id);
    const selected = activeCombos.find((c) => c.id === id);
    setUnitPrice(selected ? selected.price.toFixed(2) : "");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateOrderForm({ buyerName, contact, comboId, quantity, unitPrice });
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0 || !combo || price === null) return;

    const summary = `${buyerName.trim()} — ${quantity} × ${combo.name}\nTotal: ${formatMoney(total ?? 0)}\nPago: ${
      paid ? "CONFIRMADO" : "pendiente"
    }\n\n¿Registrar esta compra?`;
    if (!window.confirm(summary)) return;

    setBusy(true);
    // Si el precio no se tocó, no se envía: el servidor usa el precio vigente del combo.
    const customPrice = toCents(price) === toCents(combo.price) ? null : price;
    const { data, error } = await supabase
      .rpc("create_order", {
        p_buyer_name: buyerName,
        p_buyer_contact: contact || null,
        p_combo_id: combo.id,
        p_quantity: Number(quantity),
        p_unit_price: customPrice,
        p_paid: paid,
      })
      .single();
    setBusy(false);

    if (error) {
      setServerError(errorMessage(error));
      return;
    }
    setBuyerName("");
    setContact("");
    setQuantity("1");
    onCreated(data as Order);
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      <h2 className="text-lg font-semibold">Registrar compra</h2>

      {activeCombos.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Primero crea al menos un combo activo (sección «Combos» más abajo).
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Nombre del comprador</span>
          <input className="input" value={buyerName} maxLength={120} onChange={(e) => setBuyerName(e.target.value)} />
          {errors.buyerName && <p className="field-error">{errors.buyerName}</p>}
        </label>
        <label className="block">
          <span className="label">Contacto (opcional)</span>
          <input className="input" value={contact} maxLength={120} onChange={(e) => setContact(e.target.value)} />
          {errors.contact && <p className="field-error">{errors.contact}</p>}
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Combo</span>
          <select className="input" value={comboId} onChange={(e) => onComboChange(e.target.value)}>
            <option value="">Elige un combo…</option>
            {activeCombos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {formatMoney(c.price)}
              </option>
            ))}
          </select>
          {errors.comboId && <p className="field-error">{errors.comboId}</p>}
        </label>
        <label className="block">
          <span className="label">Cantidad</span>
          <input
            className="input"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {errors.quantity && <p className="field-error">{errors.quantity}</p>}
        </label>
        <label className="block">
          <span className="label">Precio unitario</span>
          <input
            className="input"
            inputMode="decimal"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          {errors.unitPrice && <p className="field-error">{errors.unitPrice}</p>}
        </label>
      </div>

      <fieldset className="flex flex-wrap gap-4">
        <legend className="label">Estado del pago</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="paid" checked={paid} onChange={() => setPaid(true)} />
          Pagado (verifiqué la transferencia)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="paid" checked={!paid} onChange={() => setPaid(false)} />
          Pendiente de pago
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold tabular-nums">Total: {total !== null ? formatMoney(total) : "—"}</p>
        <button className="btn btn-primary" disabled={busy || activeCombos.length === 0}>
          {busy ? "Guardando…" : paid ? "Registrar y generar cupón" : "Registrar (sin cupón)"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        El cupón solo se genera cuando el pago está confirmado. El total final lo calcula el servidor.
      </p>

      {serverError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {serverError}
        </p>
      )}
    </form>
  );
}
