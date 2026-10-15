import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setSessionExpiredHandler, tokenStore } from "@/api/client";
import { authApi, type DonorRegisterBody, type VolunteerRegisterBody } from "@/api/services";
import type { AuthResponse, Role, UserOut } from "@/api/types";

interface AuthValue {
  user: UserOut | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserOut>;
  registerVolunteer: (b: VolunteerRegisterBody) => Promise<UserOut>;
  registerDonor: (b: DonorRegisterBody) => Promise<UserOut>;
  logout: () => void;
  /** re-read /auth/me (e.g. after an admin approves the volunteer) */
  refreshUser: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

export const homeFor = (role: Role | undefined): string =>
  role === "admin" ? "/admin" : role === "volunteer" ? "/volunteer" : role === "donor" ? "/donor" : "/";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!tokenStore.get());
  const qc = useQueryClient();

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    if (!tokenStore.get()) return;
    let alive = true;
    authApi
      .me()
      .then((u) => alive && setUser(u))
      .catch(() => tokenStore.clear())
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const accept = useCallback((res: AuthResponse) => {
    qc.clear(); // never show the previous user's cached data
    tokenStore.set(res.access_token);
    setUser(res.user);
    return res.user;
  }, [qc]);

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    login: async (email, password) => accept(await authApi.login(email, password)),
    registerVolunteer: async (b) => accept(await authApi.registerVolunteer(b)),
    registerDonor: async (b) => accept(await authApi.registerDonor(b)),
    logout: () => { tokenStore.clear(); setUser(null); qc.clear(); },
    refreshUser: async () => { setUser(await authApi.me()); },
  }), [user, loading, accept, qc]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
