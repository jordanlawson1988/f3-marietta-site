"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";

interface AdminAuthContextValue {
  logout: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextValue>({
  logout: () => {},
});

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

// ---------------------------------------------------------------------------
// AdminAuthProvider — encapsulates session check, login screen, and logout.
// Wraps the entire admin layout so chrome and pages share the auth boundary.
// ---------------------------------------------------------------------------

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { data: session, isPending } = authClient.useSession();

  const handleLogin = async () => {
    if (!email || !password) return;
    setIsLoading(true);
    setError("");
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message || "Invalid credentials");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authClient.signOut();
  };

  // --- Loading ---
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1A2F] text-white">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // --- Login Screen ---
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1A2F] text-white p-4">
        <div className="max-w-md w-full bg-[#112240] p-8 rounded-lg border border-[#23334A] shadow-xl">
          <h1 className="text-2xl font-bold mb-6 text-center">
            F3 Marietta Admin
          </h1>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
                placeholder="admin@f3marietta.com"
              />
            </div>
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button onClick={handleLogin} disabled={isLoading} className="w-full">
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Authenticated ---
  return (
    <AdminAuthContext.Provider value={{ logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
