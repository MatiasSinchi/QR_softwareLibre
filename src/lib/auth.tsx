import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthState {
  loading: boolean;
  session: Session | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ message: string } | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Solo sirve para decidir qué pantalla mostrar. La autorización real la imponen
// RLS y las funciones SQL: aunque esto devolviera true, la base de datos rechazaría a un no admin.
async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("admin_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !error && data !== null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function apply(next: Session | null) {
      const admin = next ? await checkIsAdmin(next.user.id) : false;
      if (cancelled) return;
      setSession(next);
      setIsAdmin(admin);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Se difiere para no hacer llamadas a Supabase dentro del propio callback.
      if (event === "INITIAL_SESSION") return;
      setTimeout(() => apply(next), 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { message: error.message } : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ loading, session, isAdmin, signIn, signOut }),
    [loading, session, isAdmin, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
