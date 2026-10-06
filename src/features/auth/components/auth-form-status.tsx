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
      className="btn btn-lg btn-primary w-full"
      disabled={pending}
      type="submit"
    >
      {pending ? "Procesando..." : label}
    </button>
  );
}
