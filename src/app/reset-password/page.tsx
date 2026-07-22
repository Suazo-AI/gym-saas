import { resetPasswordAction } from "@/features/auth/actions/auth.actions";
import { AuthForm } from "@/features/auth/components/auth-form-status";
import { AuthShell } from "@/features/auth/components/auth-shell";

const inputClass =
  "mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-[#083f88] focus:ring-2 focus:ring-blue-100";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Nueva contrasena" subtitle="Define una contrasena segura para tu cuenta.">
      <AuthForm action={resetPasswordAction} buttonLabel="Actualizar contrasena">
        <label className="block text-sm font-semibold text-slate-800">
          Nueva contrasena
          <input className={inputClass} autoComplete="new-password" name="password" required type="password" />
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          Confirmar contrasena
          <input
            className={inputClass}
            autoComplete="new-password"
            name="confirmPassword"
            required
            type="password"
          />
        </label>
      </AuthForm>
    </AuthShell>
  );
}
