import Link from "next/link";

import { forgotPasswordAction } from "@/features/auth/actions/auth.actions";
import { AuthForm } from "@/features/auth/components/auth-form-status";
import { AuthShell } from "@/features/auth/components/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recuperar acceso"
      subtitle="Te enviaremos instrucciones si el correo pertenece a una cuenta activa."
    >
      <AuthForm action={forgotPasswordAction} buttonLabel="Enviar instrucciones">
        <label className="block text-sm font-semibold text-slate-800">
          Correo
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-[#083f88] focus:ring-2 focus:ring-blue-100"
            autoComplete="email"
            name="email"
            required
            type="email"
          />
        </label>
      </AuthForm>
      <Link
        className="mt-4 inline-block text-sm font-semibold text-[#083f88] hover:text-[#ff7a1a]"
        href="/login"
      >
        Volver al inicio de sesion
      </Link>
    </AuthShell>
  );
}
