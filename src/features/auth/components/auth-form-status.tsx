"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AuthFormState } from "../types/auth-form-state";

type AuthFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  buttonLabel: string;
  children: React.ReactNode;
};

export function AuthForm({ action, buttonLabel, children }: AuthFormProps) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {children}
      {state.message ? (
        <p
          className={`rounded-md border px-4 py-3 text-sm ${
            state.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role={state.type === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton label={buttonLabel} />
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="min-h-11 w-full rounded-md bg-[#ff7a1a] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e86305] focus:outline-none focus:ring-2 focus:ring-[#ff7a1a] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Procesando..." : label}
    </button>
  );
}
