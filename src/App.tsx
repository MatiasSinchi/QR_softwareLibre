import { Navigate, Route, Routes } from "react-router-dom";
import RequireAdmin from "./components/RequireAdmin";
import { AuthProvider } from "./lib/auth";
import { isSupabaseConfigured } from "./lib/supabase";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Placeholder from "./pages/Placeholder";

export default function App() {
  return (
    <AuthProvider>
      {!isSupabaseConfigured && (
        <div role="alert" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Falta configurar Supabase: copia <code>.env.example</code> a <code>.env.local</code> y completa las variables.
        </div>
      )}
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
              <Placeholder title="Escáner de cupones" phase={5} />
            </RequireAdmin>
          }
        />
        <Route path="/cupon/:token" element={<Placeholder title="Cupón" phase={4} />} />
        <Route path="*" element={<Placeholder title="Página no encontrada" />} />
      </Routes>
    </AuthProvider>
  );
}
