"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import type { MemberStatus } from "@/lib/constants/memberStatus";

interface AdminAuthContextValue {
  logout: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextValue>({
  logout: () => {},
});

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

// Admin routes that must render WITHOUT the admin gate (anyone can reach them).
const PUBLIC_ADMIN_ROUTES = ["/admin/signup"];

type MeState = MemberStatus | "unauthenticated" | "loading";

// ---------------------------------------------------------------------------
// AdminAuthProvider — gates the admin console.
// unauthenticated -> login form; pending/revoked -> status screen;
// admin -> render console. Public routes (signup) bypass the gate entirely.
// The authoritative security boundary is the API (requireAdmin); this is UX.
// ---------------------------------------------------------------------------

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ADMIN_ROUTES.includes(pathname);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { data: session, isPending } = authClient.useSession();
  const [memberState, setMemberState] = useState<MeState>("loading");

  useEffect(() => {
    if (!session) {
      setMemberState("unauthenticated");
      return;
    }
    let cancelled = false;
    setMemberState("loading");
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : { state: "unauthenticated" }))
      .then((data) => {
        if (!cancelled) setMemberState(data.state ?? "unauthenticated");
      })
      .catch(() => {
        if (!cancelled) setMemberState("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

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

  // Public routes (e.g. signup) always render, regardless of auth state.
  if (isPublicRoute) {
    return (
      <AdminAuthContext.Provider value={{ logout }}>
        {children}
      </AdminAuthContext.Provider>
    );
  }

  // --- Loading (session or member-state resolving) ---
  if (isPending || (session && memberState === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1A2F] text-white">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // --- Login Screen (unauthenticated) ---
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
            <p className="text-center text-sm text-gray-400">
              Need access?{" "}
              <Link href="/admin/signup" className="text-[#4A76A8] hover:underline">
                Request an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Authenticated but not an admin: status screen ---
  if (memberState !== "admin") {
    const revoked = memberState === "revoked";
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1A2F] text-white p-4">
        <div className="max-w-md w-full bg-[#112240] p-8 rounded-lg border border-[#23334A] shadow-xl text-center space-y-4">
          <h1 className="text-2xl font-bold">
            {revoked ? "Access revoked" : "Awaiting approval"}
          </h1>
          <p className="text-gray-300 text-sm">
            {revoked
              ? "Your admin access has been removed. Contact an F3 Marietta admin if you believe this is a mistake."
              : "Your account is pending approval. An existing admin needs to grant you access before you can use the console."}
          </p>
          <Button onClick={logout} className="w-full">
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  // --- Authenticated admin ---
  return (
    <AdminAuthContext.Provider value={{ logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
