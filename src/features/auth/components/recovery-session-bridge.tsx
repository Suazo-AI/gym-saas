"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { parseRecoverySessionHash } from "../services/auth-callback";

export function RecoverySessionBridge({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    async function prepareSession() {
      const supabase = createClient();
      const hashSession = parseRecoverySessionHash(window.location.hash);
      if (window.location.hash) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
      const result = hashSession
        ? await supabase.auth.setSession(hashSession)
        : await supabase.auth.getSession();
      const session = "session" in result.data ? result.data.session : null;

      if (!active) return;
      if (result.error || !session) {
        setStatus("error");
        return;
      }

      setStatus("ready");
    }

    void prepareSession();
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return <p className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800" role="status">Validando enlace seguro…</p>;
  }

  if (status === "error") {
    return <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">El enlace venció o ya fue utilizado. Solicita una nueva invitación.</p>;
  }

  return children;
}
