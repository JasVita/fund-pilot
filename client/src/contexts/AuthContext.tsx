// src/contexts/AuthContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiGet, API_BASE } from "@/lib/api";

interface User {
  sub: number;
  email: string;
  name: string;
  avatar: string | null;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]   = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /** Always ask the backend once after hydration */
  useEffect(() => {
    (async () => {
      const data = await apiGet<{ ok: boolean; user: User }>("/api/auth/me");
      console.log("%c[Auth] /api/auth/me →", "color:orange", data);

      if (data?.ok) setUser(data.user);
      setLoading(false);
    })();
  }, []);

  const logout = async () => {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
};
