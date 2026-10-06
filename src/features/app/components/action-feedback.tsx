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
    <p aria-live="polite" className={`rounded-xl bg-stop-tint px-4 py-3 text-sm font-semibold text-stop ${className}`} role="alert">
      {state.message}
    </p>
  );
}
