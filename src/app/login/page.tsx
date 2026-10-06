import Link from "next/link";

import { loginAction } from "@/features/auth/actions/auth.actions";
import { AuthForm } from "@/features/auth/components/auth-form-status";
import { AuthShell } from "@/features/auth/components/auth-shell";

const inputClass = "field";

export default function LoginPage() {
  return (
    <AuthShell
      title="Inicia sesion"
      subtitle="Entra con tu correo para administrar tu gimnasio."
    >
      <AuthForm action={loginAction} buttonLabel="Entrar al panel">
        <label className="field-label">
          Correo
          <input className={inputClass} autoComplete="email" name="email" required type="email" />
        </label>
        <label className="field-label">
          Contrasena
          <input
            className={inputClass}
            autoComplete="current-password"
            name="password"
            required
            type="password"
          />
        </label>
      </AuthForm>
      <Link
        className="mt-4 inline-block text-sm font-semibold text-accent hover:underline"
        href="/forgot-password"
      >
        Olvide mi contrasena
      </Link>
    </AuthShell>
  );
}
