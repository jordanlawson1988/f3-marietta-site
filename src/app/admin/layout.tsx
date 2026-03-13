"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { AdminAuthContext } from "./AdminAuthContext";
import {
  BookOpen,
  Dumbbell,
  MapPin,
  LogOut,
} from "lucide-react";

// --- Nav Items ---

const NAV_ITEMS = [
  { href: "/admin/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/admin/regions", label: "Regions", icon: MapPin },
  { href: "/admin/kb", label: "Knowledge Base", icon: BookOpen },
];

// --- Layout Component ---

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Migrate old KB token key to new unified key
    const oldToken = localStorage.getItem("f3-kb-admin-token");
    const newToken = localStorage.getItem("f3-admin-token");
    if (oldToken && !newToken) {
      localStorage.setItem("f3-admin-token", oldToken);
      localStorage.removeItem("f3-kb-admin-token");
    }

    const saved = localStorage.getItem("f3-admin-token");
    if (saved) {
      setToken(saved);
    }
  }, []);

  const handleLogin = async () => {
    if (!password) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "x-admin-token": password },
      });
      if (res.ok) {
        setToken(password);
        localStorage.setItem("f3-admin-token", password);
      } else if (res.status === 401) {
        setError("Invalid password");
      } else {
        setError("Server error — please try again");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem("f3-admin-token");
  };

  // --- Login Screen ---
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1A2F] text-white p-4">
        <div className="max-w-md w-full bg-[#112240] p-8 rounded-lg border border-[#23334A] shadow-xl">
          <h1 className="text-2xl font-bold mb-6 text-center">
            F3 Marietta Admin
          </h1>
          <div className="space-y-4">
            <div>
              <label htmlFor="admin-password" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
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
            <Button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Unlocking..." : "Unlock"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Authenticated Layout ---
  return (
    <AdminAuthContext.Provider value={{ token, logout }}>
      <div className="min-h-screen bg-[#0A1A2F] text-white flex">
        {/* Sidebar */}
        <div className="w-56 bg-[#112240] border-r border-[#23334A] flex flex-col shrink-0 h-screen sticky top-0">
          <div className="p-4 border-b border-[#23334A]">
            <h2 className="font-bold text-sm tracking-wide text-gray-300">
              F3 Marietta Admin
            </h2>
          </div>

          <nav className="flex-1 p-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors",
                    isActive
                      ? "bg-[#4A76A8] text-white font-medium"
                      : "text-gray-400 hover:bg-[#23334A] hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-2 border-t border-[#23334A]">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2 rounded text-sm text-gray-400 hover:bg-[#23334A] hover:text-white transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </AdminAuthContext.Provider>
  );
}
