import { Navigate, Route, Routes } from "react-router-dom";
import { isSupabaseConfigured } from "./lib/supabase";
import Placeholder from "./pages/Placeholder";

export default function App() {
  return (
    <>
      {!isSupabaseConfigured && (
        <div role="alert" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Falta configurar Supabase: copia <code>.env.example</code> a <code>.env.local</code> y completa las variables.
        </div>
      )}
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/login" element={<Placeholder title="Inicio de sesión" phase={3} />} />
        <Route path="/admin" element={<Placeholder title="Panel administrativo" phase={3} />} />
        <Route path="/admin/scan" element={<Placeholder title="Escáner de cupones" phase={5} />} />
        <Route path="/cupon/:token" element={<Placeholder title="Cupón" phase={4} />} />
        <Route path="*" element={<Placeholder title="Página no encontrada" />} />
      </Routes>
    </>
  );
}
