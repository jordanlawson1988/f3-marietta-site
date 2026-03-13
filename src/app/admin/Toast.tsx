"use client";

import { useEffect } from "react";
import { Check, X, AlertCircle } from "lucide-react";

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
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in duration-200">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
          isSuccess
            ? "bg-green-900/90 border-green-700 text-green-100"
            : "bg-red-900/90 border-red-700 text-red-100"
        }`}
      >
        {isSuccess ? (
          <Check className="h-5 w-5 text-green-400 shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
        )}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
