import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  boxId: string | null;
  boxSlug: string | null;
  loading: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [box, setBox] = useState<{ id: string; slug: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadExtras(userId: string) {
    const [p, r, b] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("boxes").select("id, slug").eq("owner_id", userId).maybeSingle(),
    ]);
    setProfile(p.data ?? null);
    setRoles((r.data ?? []).map((x) => x.role));
    setBox(b.data ?? null);
  }

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      if (s?.user) {
        // defer para evitar deadlock do cliente de auth
        setTimeout(() => {
          if (active) loadExtras(s.user.id).finally(() => active && setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setBox(null);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        loadExtras(data.session.user.id).finally(() => active && setLoading(false));
      } else {
        setLoading(false);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      roles,
      boxId: box?.id ?? null,
      boxSlug: box?.slug ?? null,
      loading,
      isSeller: roles.includes("seller") || !!box,
      isAdmin: roles.includes("admin"),
      refresh: async () => {
        if (session?.user) await loadExtras(session.user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, roles, box, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
