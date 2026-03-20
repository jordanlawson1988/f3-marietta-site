"use client";

import { createContext, useContext } from "react";

interface AdminAuthContextValue {
  logout: () => void;
}

export const AdminAuthContext = createContext<AdminAuthContextValue>({
  logout: () => {},
});

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
