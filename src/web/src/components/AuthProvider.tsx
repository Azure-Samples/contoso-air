"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";

interface AuthUser {
  username: string;
  provider: "local" | "google" | "entra"; // placeholder for expansion
  createdAt: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "authSession";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      if (!raw) return null;
      const parsed: AuthUser | null = JSON.parse(raw);
      return parsed && parsed.username ? parsed : null;
    } catch {
      return null;
    }
  });
  const loading = false;

  const login = useCallback(async (username: string, _password: string) => {
    // Mark _password as intentionally unused (auth is mocked)
    void _password;
    await new Promise((r) => setTimeout(r, 200));
    const session: AuthUser = {
      username: username.trim() || "Traveler",
      provider: "local",
      createdAt: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {}
    setUser(session);
    return session;
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
