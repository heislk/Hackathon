/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

const TOKEN_KEY = "cs_session_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [usage, setUsage] = useState({ weeklyScans: 0, monthlyEmails: 0 });
  const [limits, setLimits] = useState({ weeklyScans: 3, monthlyEmails: 5 });
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem(TOKEN_KEY);

  const apiFetch = useCallback(async (path, options = {}) => {
    const token = getToken();
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(path, { ...options, headers });
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }, []);

  const refreshMe = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    const { ok, data } = await apiFetch("/api/auth/me");
    if (ok) {
      setUser(data.user);
      setUsage(data.usage);
      setLimits(data.limits);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setUsage({ weeklyScans: 0, monthlyEmails: 0 });
      setLimits({ weeklyScans: 3, monthlyEmails: 5 });
    }
    setLoading(false);
  }, [apiFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshMe();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshMe]);

  const login = useCallback(async (email, password) => {
    const { ok, data } = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (ok) {
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      setUsage(data.usage);
      setLimits(data.limits);
      return { ok: true };
    }
    return { ok: false, error: data.error || "Login failed" };
  }, [apiFetch]);

  const register = useCallback(async (name, email, password) => {
    const { ok, data } = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    return { ok, error: ok ? null : (data.error || "Registration failed") };
  }, [apiFetch]);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setUsage({ weeklyScans: 0, monthlyEmails: 0 });
    setLimits({ weeklyScans: 3, monthlyEmails: 5 });
  }, [apiFetch]);

  const saveScan = useCallback(async (inputValue, inputKind, verdict, isMalicious, resultJson) => {
    if (!getToken()) return;
    const { ok } = await apiFetch("/api/auth/scan-history", {
      method: "POST",
      body: JSON.stringify({ inputValue, inputKind, verdict, isMalicious, resultJson }),
    });
    if (ok) {
      setUsage((prev) => ({ ...prev, weeklyScans: prev.weeklyScans + 1 }));
    }
  }, [apiFetch]);

  const recordEmailCheck = useCallback(async () => {
    if (!getToken()) return;
    const { ok } = await apiFetch("/api/auth/email-check", {
      method: "POST",
    });
    if (ok) {
      setUsage((prev) => ({ ...prev, monthlyEmails: prev.monthlyEmails + 1 }));
    }
  }, [apiFetch]);

  const getScanHistory = useCallback(async (page = 1, pageSize = 10) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    const { ok, data } = await apiFetch(`/api/auth/scan-history?${params.toString()}`);
    if (!ok) {
      return { history: [], pagination: { page, pageSize, total: 0, totalPages: 1 } };
    }
    return {
      history: data.history || [],
      pagination: data.pagination || { page, pageSize, total: 0, totalPages: 1 },
    };
  }, [apiFetch]);

  const changeTier = useCallback(async (tier) => {
    const { ok, data } = await apiFetch("/api/auth/tier", {
      method: "POST",
      body: JSON.stringify({ tier }),
    });
    if (ok) {
      setUser(data.user);
      setUsage(data.usage);
      setLimits(data.limits);
      return { ok: true };
    }
    return { ok: false, error: data.error || "Tier update failed" };
  }, [apiFetch]);

  const resetAccountData = useCallback(async () => {
    const { ok, data } = await apiFetch("/api/auth/reset-data", {
      method: "POST",
    });
    if (ok) {
      setUser(data.user);
      setUsage(data.usage);
      setLimits(data.limits);
      return { ok: true };
    }
    return { ok: false, error: data.error || "Reset failed" };
  }, [apiFetch]);

  return (
    <AuthContext.Provider value={{ user, usage, limits, loading, login, register, logout, saveScan, recordEmailCheck, getScanHistory, refreshMe, changeTier, resetAccountData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
