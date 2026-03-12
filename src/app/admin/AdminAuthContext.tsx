"use client";

import { createContext, useContext } from "react";

interface AdminAuthContextValue {
  token: string | null;
  logout: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextValue>({
  token: null,
  logout: () => {},
});

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
