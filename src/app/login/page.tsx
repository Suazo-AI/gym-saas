import Link from "next/link";

import { loginAction } from "@/features/auth/actions/auth.actions";
import { AuthForm } from "@/features/auth/components/auth-form-status";
import { AuthShell } from "@/features/auth/components/auth-shell";

const inputClass =
  "mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-[#083f88] focus:ring-2 focus:ring-blue-100";

export default function LoginPage() {
  return (
    <AuthShell
      title="Inicia sesion"
      subtitle="Entra con tu correo de Supabase Auth para administrar tu gimnasio."
    >
      <AuthForm action={loginAction} buttonLabel="Entrar al panel">
        <label className="block text-sm font-semibold text-slate-800">
          Correo
          <input className={inputClass} autoComplete="email" name="email" required type="email" />
        </label>
        <label className="block text-sm font-semibold text-slate-800">
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
        className="mt-4 inline-block text-sm font-semibold text-[#083f88] hover:text-[#ff7a1a]"
        href="/forgot-password"
      >
        Olvide mi contrasena
      </Link>
    </AuthShell>
  );
}
