import { useState, type FormEvent } from "react";
import { errorMessage } from "../lib/errors";
import { formatMoney, parsePrice } from "../lib/money";
import { supabase } from "../lib/supabase";
import type { Combo } from "../lib/types";
import { validateComboForm } from "../lib/validation";

interface Props {
  combos: Combo[];
  onChanged: () => Promise<void>;
}

export default function ComboManager({ combos, onChanged }: Props) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError(null);
    const { error: failure } = await action();
    if (failure) setError(errorMessage(failure));
    else await onChanged();
    setBusy(false);
    return !failure;
  }

  async function addCombo(e: FormEvent) {
    e.preventDefault();
    const found = validateComboForm({ name, price });
    if (found.name || found.price) return setError(found.name ?? found.price ?? null);
    const ok = await run(() => supabase.from("combos").insert({ name: name.trim(), price: parsePrice(price) }));
    if (ok) {
      setName("");
      setPrice("");
    }
  }

  function startEdit(c: Combo) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditPrice(c.price.toFixed(2));
    setError(null);
  }

  async function saveEdit(c: Combo) {
    const found = validateComboForm({ name: editName, price: editPrice });
    if (found.name || found.price) return setError(found.name ?? found.price ?? null);
    const ok = await run(() =>
      supabase.from("combos").update({ name: editName.trim(), price: parsePrice(editPrice) }).eq("id", c.id),
    );
    if (ok) setEditingId(null);
  }

  async function toggleActive(c: Combo) {
    const next = !c.active;
    if (!window.confirm(`${next ? "Activar" : "Desactivar"} el combo «${c.name}»?`)) return;
    await run(() => supabase.from("combos").update({ active: next }).eq("id", c.id));
  }

  return (
    <details className="card" open={combos.length === 0}>
      <summary className="cursor-pointer text-lg font-semibold">Combos</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-500">
          Cambiar el precio de un combo no modifica los pedidos ya registrados.
        </p>

        <ul className="divide-y divide-slate-100">
          {combos.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              {editingId === c.id ? (
                <>
                  <div className="flex flex-1 flex-wrap gap-2">
                    <input
                      className="input min-w-40 flex-1"
                      aria-label="Nombre del combo"
                      value={editName}
                      maxLength={80}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <input
                      className="input w-28"
                      aria-label="Precio del combo"
                      inputMode="decimal"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" disabled={busy} onClick={() => void saveEdit(c)}>
                      Guardar
                    </button>
                    <button className="btn btn-secondary" onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className={c.active ? "font-medium" : "font-medium text-slate-400 line-through"}>
                      {c.name}
                    </span>{" "}
                    <span className="text-sm text-slate-600">{formatMoney(c.price)}</span>
                    {!c.active && <span className="ml-2 text-xs text-slate-500">(inactivo)</span>}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-secondary" onClick={() => startEdit(c)}>
                      Editar
                    </button>
                    <button className="btn btn-secondary" disabled={busy} onClick={() => void toggleActive(c)}>
                      {c.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={addCombo} className="flex flex-wrap items-end gap-2" noValidate>
          <label className="block flex-1">
            <span className="label">Nuevo combo</span>
            <input
              className="input min-w-40"
              placeholder="Nombre"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block w-28">
            <span className="label">Precio</span>
            <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            Añadir
          </button>
        </form>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
