"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";

export default function AdminSignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      setError("Name, email, and password are required.");
      return;
    }
    if (confirm && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authClient.signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.message || "Sign-up failed. Please try again.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1A2F] text-white p-4">
        <div className="max-w-md w-full bg-[#112240] p-8 rounded-lg border border-[#23334A] shadow-xl text-center space-y-5">
          <div className="text-[40px]" aria-hidden>
            <span className="font-mono text-[#4A76A8] text-3xl font-bold">F3</span>
          </div>
          <h1 className="text-xl font-bold text-white">Account created</h1>
          <p className="text-gray-300 text-sm leading-relaxed">
            Your account is awaiting approval. An existing admin will grant you
            access before you can use the console.
          </p>
          <Link
            href="/admin"
            className="block w-full mt-2 px-4 py-2 bg-[#4A76A8] hover:bg-[#5B87BA] text-white text-sm font-medium rounded transition-colors text-center"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A1A2F] text-white p-4">
      <div className="max-w-md w-full bg-[#112240] p-8 rounded-lg border border-[#23334A] shadow-xl">
        <div className="text-center mb-6">
          <span className="font-mono text-[#4A76A8] text-2xl font-bold tracking-widest">F3</span>
          <h1 className="text-2xl font-bold mt-1">Request Admin Access</h1>
          <p className="text-gray-400 text-xs mt-1 tracking-wide">
            F3 Marietta Operations Console
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="signup-name"
              className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1"
            >
              Name
            </label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          <div>
            <label
              htmlFor="signup-email"
              className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1"
            >
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor="signup-password"
              className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1"
            >
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label
              htmlFor="signup-confirm"
              className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1"
            >
              Confirm Password
            </label>
            <input
              id="signup-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-400">
          Already have an account?{" "}
          <Link href="/admin" className="text-[#4A76A8] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
