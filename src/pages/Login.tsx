import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/errors";

export default function Login() {
  const { loading, session, isAdmin, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session && isAdmin) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from.startsWith("/admin") ? from : "/admin"} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    if (result) setError(errorMessage(result));
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">Administración</h1>
      <p className="mt-1 text-sm text-slate-500">Acceso solo para administradores autorizados.</p>

      <form onSubmit={onSubmit} className="card mt-6 space-y-4">
        <label className="block">
          <span className="label">Correo</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Contraseña</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
      {session && !isAdmin && !loading && (
        <p className="mt-4 text-center text-sm text-amber-700">
          Esta cuenta no está autorizada como administradora.
        </p>
      )}
    </main>
  );
}
