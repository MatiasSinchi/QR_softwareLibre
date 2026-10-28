import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import RequireAdmin from "./components/RequireAdmin";
import { AuthProvider } from "./lib/auth";
import { isSupabaseConfigured } from "./lib/supabase";
import Placeholder from "./pages/Placeholder";
import PublicCoupon from "./pages/PublicCoupon";

// El comprador solo abre /cupon/...: el panel de administración no se descarga en su teléfono.
const Admin = lazy(() => import("./pages/Admin"));
const Login = lazy(() => import("./pages/Login"));
const Scan = lazy(() => import("./pages/Scan"));

export default function App() {
  return (
    <AuthProvider>
      {!isSupabaseConfigured && (
        <div role="alert" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Falta configurar Supabase: copia <code>.env.example</code> a <code>.env.local</code> y completa las variables.
        </div>
      )}
      <Suspense fallback={<p className="p-6 text-center text-slate-500">Cargando…</p>}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/scan"
          element={
            <RequireAdmin>
              <Scan />
            </RequireAdmin>
          }
        />
        <Route path="/cupon/:token" element={<PublicCoupon />} />
        <Route path="*" element={<Placeholder title="Página no encontrada" />} />
      </Routes>
      </Suspense>
    </AuthProvider>
  );
}
