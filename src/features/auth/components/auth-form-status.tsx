"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { ActionFeedback } from "@/features/app/components/action-feedback";

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
      <ActionFeedback
        className="rounded-md bg-amber-50 px-4 py-3"
        state={{ message: state.message, ok: state.type === "success" }}
      />
      <SubmitButton label={buttonLabel} />
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="min-h-11 w-full rounded-md bg-brand-orange px-4 py-3 text-sm font-semibold text-ink transition hover:bg-brand-red hover:text-paper focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Procesando..." : label}
    </button>
  );
}
