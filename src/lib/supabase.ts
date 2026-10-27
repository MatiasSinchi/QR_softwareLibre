import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Solo se usa la clave anon (pública). La seguridad real está en RLS y en las funciones RPC.
// Si falta la configuración, la app muestra un aviso en vez de fallar al arrancar.
export const supabase = createClient(
  url ?? "http://localhost:54321",
  anonKey ?? "sin-configurar",
);
