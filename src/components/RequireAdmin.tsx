import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { loading, session, isAdmin, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="p-6 text-center text-slate-500">Cargando…</p>;
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">Sin autorización</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tu cuenta no está autorizada como administradora de esta aplicación.
        </p>
        <button className="btn btn-secondary mt-4" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </main>
    );
  }
  return <>{children}</>;
}
