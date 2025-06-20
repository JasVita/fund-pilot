"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiGet, API_BASE } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface User {
  sub:    number;
  email:  string;
  name:   string;
  avatar: string | null;
}

interface AuthCtx {
  user:     User | null;
  loading:  boolean;
  /** force-refresh the user object (e.g. right after log-in/out) */
  refresh(): Promise<void>;
  logout():  Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Context setup                                                     */
/* ------------------------------------------------------------------ */

const AuthContext = createContext<AuthCtx | null>(null);

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /** shared fetcher so we can reuse it for `refresh()` */
  const fetchMe = async () => {
    const data = await apiGet<{ ok: boolean; user: User }>("/api/auth/me");
    if (data?.ok) setUser(data.user);
  };

  /* run once on first mount */
  useEffect(() => {
    (async () => {
      const not_login = !window.location.pathname.startsWith("/login");
      if (not_login) {
        await fetchMe();
        setLoading(false);
      }
    })();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Public helpers                                                  */
  /* ---------------------------------------------------------------- */

  const refresh = async () => {
    await fetchMe();
  };

  const logout = async () => {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method:      "POST",
      credentials: "include",
    });
    setUser(null);
    window.location.href = "/login";
  };

  /* ---------------------------------------------------------------- */

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
};