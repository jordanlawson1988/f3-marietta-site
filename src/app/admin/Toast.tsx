"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, type = "success", onDismiss, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  if (!message) return null;

  const isSuccess = type === "success";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 bg-ink text-bone clip-chamfer px-5 py-3 font-mono text-[12px] tracking-[.1em] uppercase shadow-[0_10px_30px_rgba(12,12,12,.35)] border ${
        isSuccess ? "border-steel" : "border-rust"
      }`}
    >
      {message}
    </div>
  );
}
