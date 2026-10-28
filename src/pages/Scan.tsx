import { Scanner, type IDetectedBarcode, type IScannerError } from "@yudiel/react-qr-scanner";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { DeliveryBadge, PaymentBadge } from "../components/StatusBadge";
import { errorMessage } from "../lib/errors";
import { classifyCode, couponStatus, isDuplicateScan, type LastScan } from "../lib/scanFlow";
import { supabase } from "../lib/supabase";
import type { Order } from "../lib/types";
import "../lib/zxing"; // aloja el módulo WASM del lector en nuestro propio sitio

type View =
  | { step: "scanning" }
  | { step: "looking" }
  | { step: "result"; order: Order; notice?: string }
  | { step: "notfound"; code: string }
  | { step: "error"; message: string }
  | { step: "delivered"; order: Order };

const dateFormat = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

// Todo "ideal", nada obligatorio: prefiere la cámara trasera y ~720p, pero funciona con cualquier cámara.
// (Los valores por defecto de la librería exigen mínimo 640×640 y dejan sin cámara a muchas webcams.)
const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

function cameraMessage(error: IScannerError): string {
  switch (error.kind) {
    case "permission-denied":
      return "No diste permiso para usar la cámara. Actívalo en los ajustes del navegador para este sitio, o usa el código manual.";
    case "no-camera":
      return "No se encontró ninguna cámara en este dispositivo. Usa el código manual.";
    case "in-use":
      return "La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.";
    case "insecure-context":
      return "La cámara solo funciona en páginas HTTPS (o localhost). Abre la versión desplegada de la app.";
    case "unsupported":
      return "Este navegador no permite usar la cámara. Prueba con Chrome o Safari actualizados, o usa el código manual.";
    default:
      return "No se pudo iniciar la cámara. Usa el código manual o recarga la página.";
  }
}

export default function Scan() {
  const [view, setView] = useState<View>({ step: "scanning" });
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Cerrojos síncronos: evitan que una misma lectura (o un doble toque) dispare varias acciones
  // antes de que React vuelva a renderizar.
  const busyRef = useRef(false);
  const deliveringRef = useRef(false);
  const lastScanRef = useRef<LastScan | null>(null);

  const lookup = useCallback(async (code: string): Promise<Order | null | "error"> => {
    const { data, error } = await supabase.rpc("lookup_coupon", { p_code: code });
    if (error) {
      setView({ step: "error", message: errorMessage(error) });
      return "error";
    }
    return (data as Order[])[0] ?? null;
  }, []);

  const handleCode = useCallback(
    async (raw: string) => {
      const now = Date.now();
      if (busyRef.current || isDuplicateScan(lastScanRef.current, raw, now)) return;
      busyRef.current = true;
      lastScanRef.current = { code: raw, at: now };
      setActionError(null);
      setConfirming(false);

      const classified = classifyCode(raw);
      if (classified.kind === "invalid") {
        setView({ step: "notfound", code: raw.trim().slice(0, 40) });
        return;
      }
      setView({ step: "looking" });
      const order = await lookup(classified.code);
      if (order === "error") return;
      setView(order ? { step: "result", order } : { step: "notfound", code: classified.code });
    },
    [lookup],
  );

  function onScan(codes: IDetectedBarcode[]) {
    const raw = codes[0]?.rawValue;
    if (raw) void handleCode(raw);
  }

  function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (manual.trim()) void handleCode(manual);
  }

  function scanNext() {
    busyRef.current = false;
    lastScanRef.current = { code: lastScanRef.current?.code ?? "", at: Date.now() };
    setManual("");
    setConfirming(false);
    setActionError(null);
    setView({ step: "scanning" });
  }

  async function deliver(order: Order) {
    if (deliveringRef.current || !order.coupon_token) return;
    deliveringRef.current = true;
    setDelivering(true);
    setActionError(null);

    const { data, error } = await supabase.rpc("deliver_coupon", { p_token: order.coupon_token }).single();
    if (!error) {
      setView({ step: "delivered", order: data as Order });
    } else if (error.message === "already_delivered") {
      // Otro dispositivo (o un doble toque) llegó primero: se muestra el estado real.
      const fresh = await lookup(order.coupon_token);
      if (fresh && fresh !== "error") {
        setView({
          step: "result",
          order: fresh,
          notice: "Este cupón ya había sido entregado. No se entregó de nuevo.",
        });
      }
    } else {
      setActionError(errorMessage(error));
    }
    setConfirming(false);
    setDelivering(false);
    deliveringRef.current = false;
  }

  const showCamera = view.step === "scanning" || view.step === "looking";

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-16">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Escanear cupón</h1>
        <Link to="/admin" className="btn btn-secondary">
          Panel
        </Link>
      </header>

      {/* La cámara sigue montada (pausada) mientras se muestra un resultado, para reanudar rápido. */}
      <div className={showCamera ? "space-y-3" : "hidden"}>
        {cameraOn ? (
          <div className="overflow-hidden rounded-2xl border border-slate-300 bg-black">
            <Scanner
              onScan={onScan}
              onError={(e) => {
                console.warn("Error de cámara/lector:", e.kind, e.message);
                setCameraError(cameraMessage(e));
                setCameraOn(false);
              }}
              paused={view.step !== "scanning"}
              formats={["qr_code"]}
              constraints={CAMERA_CONSTRAINTS}
              allowMultiple
              scanDelay={1500}
              components={{ finder: true, torch: true }}
              styles={{ container: { width: "100%", aspectRatio: "1 / 1" } }}
            />
          </div>
        ) : (
          <button
            className="btn btn-primary w-full py-5 text-lg"
            onClick={() => {
              setCameraError(null);
              setCameraOn(true);
            }}
          >
            Activar cámara
          </button>
        )}

        {cameraError && (
          <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {cameraError}
          </p>
        )}
        {view.step === "looking" && (
          <p role="status" className="text-center text-sm text-slate-600">
            Consultando cupón…
          </p>
        )}

        <form onSubmit={onManualSubmit} className="card space-y-2">
          <label className="label" htmlFor="manual">
            ¿No funciona la cámara? Escribe el código
          </label>
          <div className="flex gap-2">
            <input
              id="manual"
              className="input font-mono uppercase"
              placeholder="Código de 6 caracteres"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <button className="btn btn-primary px-5" disabled={view.step !== "scanning" || !manual.trim()}>
              Buscar
            </button>
          </div>
          <p className="text-xs text-slate-500">También puedes pegar el enlace completo del cupón.</p>
        </form>
      </div>

      {view.step === "notfound" && (
        <ResultBanner tone="red" title="Código inválido">
          <p className="text-sm">
            No existe ningún cupón con el código <span className="font-mono font-semibold">{view.code}</span>.
          </p>
          <button className="btn btn-secondary mt-4 w-full py-4 text-base" onClick={scanNext}>
            Escanear otro
          </button>
        </ResultBanner>
      )}

      {view.step === "error" && (
        <ResultBanner tone="amber" title="No se pudo consultar">
          <p className="text-sm">{view.message}</p>
          <button className="btn btn-secondary mt-4 w-full py-4 text-base" onClick={scanNext}>
            Volver a intentar
          </button>
        </ResultBanner>
      )}

      {view.step === "delivered" && (
        <ResultBanner tone="green" title="Entrega registrada ✓">
          <OrderSummary order={view.order} />
          <button className="btn btn-primary mt-4 w-full py-4 text-base" onClick={scanNext}>
            Escanear siguiente
          </button>
        </ResultBanner>
      )}

      {view.step === "result" &&
        (() => {
          const order = view.order;
          const status = couponStatus(order);
          return (
            <>
              {view.notice && (
                <p role="alert" className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">
                  {view.notice}
                </p>
              )}

              {status === "ready" && (
                <ResultBanner tone="green" title="Listo para entregar">
                  <OrderSummary order={order} />
                  {actionError && (
                    <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                      {actionError}
                    </p>
                  )}
                  {!confirming ? (
                    <button className="btn btn-primary mt-4 w-full py-5 text-lg" onClick={() => setConfirming(true)}>
                      Marcar como entregado
                    </button>
                  ) : (
                    <div className="mt-4 space-y-2">
                      <p className="text-center font-medium">
                        ¿Confirmas la entrega de {order.quantity} × {order.combo_name} a {order.buyer_name}?
                      </p>
                      <button
                        className="btn btn-primary w-full py-5 text-lg"
                        disabled={delivering}
                        onClick={() => void deliver(order)}
                      >
                        {delivering ? "Registrando…" : "Sí, entregar"}
                      </button>
                      <button
                        className="btn btn-secondary w-full py-4 text-base"
                        disabled={delivering}
                        onClick={() => setConfirming(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </ResultBanner>
              )}

              {status === "delivered" && (
                <ResultBanner tone="amber" title="⚠ YA FUE ENTREGADO">
                  <OrderSummary order={order} />
                  {order.delivered_at && (
                    <p className="mt-3 text-sm font-medium">
                      Entregado el {dateFormat.format(new Date(order.delivered_at))}. No se puede entregar de nuevo.
                    </p>
                  )}
                </ResultBanner>
              )}

              {status === "unpaid" && (
                <ResultBanner tone="red" title="Pago NO confirmado">
                  <OrderSummary order={order} />
                  <p className="mt-3 text-sm font-medium">
                    Este pedido no tiene el pago confirmado, así que no se puede entregar.
                  </p>
                </ResultBanner>
              )}

              {!(status === "ready" && confirming) && (
                <button className="btn btn-secondary w-full py-4 text-base" onClick={scanNext}>
                  Escanear otro
                </button>
              )}
            </>
          );
        })()}
    </div>
  );
}

const tones = {
  green: "border-green-300 bg-green-50 text-green-950",
  amber: "border-amber-400 bg-amber-50 text-amber-950",
  red: "border-red-300 bg-red-50 text-red-950",
};

function ResultBanner({
  tone,
  title,
  children,
}: {
  tone: keyof typeof tones;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section role="status" aria-live="polite" className={`rounded-2xl border-2 p-5 ${tones[tone]}`}>
      <h2 className="mb-3 text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="space-y-2">
      <p className="text-xl font-semibold">{order.buyer_name}</p>
      <p className="text-lg">
        {order.quantity} × {order.combo_name}
      </p>
      <p className="font-mono text-sm tracking-widest text-slate-600">{order.short_code}</p>
      <div className="flex flex-wrap gap-2">
        <PaymentBadge status={order.payment_status} />
        <DeliveryBadge status={order.delivery_status} />
      </div>
    </div>
  );
}
