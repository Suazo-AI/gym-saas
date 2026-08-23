"use client";

import { useEffect, useRef } from "react";
import { toast } from "react-toastify";

type ActionResult = { ok?: boolean; message?: string };

export function ActionFeedback({ state, className = "" }: { state: ActionResult; className?: string }) {
  const lastToast = useRef("");

  useEffect(() => {
    if (!state.ok || !state.message || lastToast.current === state.message) return;
    lastToast.current = state.message;
    toast.success(state.message);
  }, [state.message, state.ok]);

  if (!state.message || state.ok) return null;

  return (
    <p aria-live="polite" className={`text-sm font-bold text-amber-900 ${className}`} role="alert">
      {state.message}
    </p>
  );
}
