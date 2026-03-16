'use client';

import { useState, useEffect, type ReactNode } from 'react';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/drafts')
      .then((res) => {
        setAuthenticated(res.ok);
      })
      .catch(() => {
        setAuthenticated(false);
      });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        setAuthenticated(true);
      } else {
        setError('Invalid token');
      }
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  }

  if (authenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-foreground/50">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 p-6">
          <h1 className="text-xl font-semibold text-center">F3 Automation</h1>
          <p className="text-sm text-foreground/60 text-center">Enter admin token to continue</p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Admin token"
            className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full px-3 py-2 bg-primary text-white rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
