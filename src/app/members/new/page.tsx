import { redirect } from "next/navigation";

import { AppShell } from "@/features/app/components/app-shell";
import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { createMemberAction } from "@/features/members/actions/member.actions";
import { MemberFaceEnrollmentField } from "@/features/members/components/member-face-enrollment-field";
import { listMembershipPlans } from "@/features/memberships/services/membership.repository";
import { listPaymentMethods } from "@/features/payments/services/payment.repository";
import { listBranches } from "@/features/settings/services/branch.repository";

type NewMemberPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewMemberPage({ searchParams }: NewMemberPageProps) {
  const user = await requireUser();
  const activeGym = await getActiveGym();
  const params = await searchParams;

  if (!activeGym) {
    redirect("/login");
  }

  const [branches, plans, paymentMethods] = await Promise.all([
    listBranches(activeGym.gymId),
    listMembershipPlans(activeGym.gymId),
    listPaymentMethods(),
  ]);

  return (
    <AppShell activeGym={activeGym} currentPath="/members" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Registro"
        title="Nuevo miembro"
        description="Alta con sucursal, plan, cargo y pago inicial mediante RPC transaccional."
      />
      {params.error ? (
        <div className="mt-6 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-900">
          {params.error}
        </div>
      ) : null}
      <form action={createMemberFormAction} className="mt-6 grid max-w-5xl gap-6">
        <input name="gymId" type="hidden" value={activeGym.gymId} />
        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <h2 className="md:col-span-2 text-xl font-black text-[#061f46]">Datos del miembro</h2>
          <Field label="Nombre" name="firstName" required />
          <Field label="Apellido" name="lastName" required />
          <Field label="Codigo de miembro" name="memberCode" />
          <Field label="Telefono" name="phone" />
          <Field label="Correo" name="email" type="email" />
          <SelectField label="Sucursal" name="branchId">
            <option value="">Sin sucursal</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </SelectField>
        </section>

        <MemberFaceEnrollmentField />

        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <h2 className="md:col-span-2 text-xl font-black text-[#061f46]">
            Membresia inicial
          </h2>
          <SelectField label="Plan" name="membershipPlanId">
            <option value="">Sin plan inicial</option>
            {plans
              .filter((plan) => plan.isActive)
              .map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {plan.currency} {plan.price}
                </option>
              ))}
          </SelectField>
          <label className="flex min-h-11 items-center gap-3 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-800">
            <input className="h-4 w-4 accent-[#ff7a1a]" defaultChecked name="createInitialCharge" type="checkbox" />
            Crear primer cargo automaticamente
          </label>
        </section>

        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <h2 className="md:col-span-2 text-xl font-black text-[#061f46]">Pago inicial opcional</h2>
          <SelectField label="Metodo de pago" name="paymentMethodId">
            <option value="">Sin pago inicial</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </SelectField>
          <Field label="Monto pagado" name="paymentAmount" placeholder="0.00" />
          <SelectField label="Moneda" name="paymentCurrency" defaultValue={activeGym.defaultCurrency}>
            <option value="NIO">NIO</option>
            <option value="USD">USD</option>
          </SelectField>
          <label className="block text-sm font-bold text-slate-800 md:col-span-2">
            Notas del pago
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-[#083f88] focus:ring-2 focus:ring-blue-100"
              name="paymentNotes"
            />
          </label>
        </section>

        <div className="flex flex-wrap gap-3">
          <button className="min-h-11 rounded-md bg-[#ff7a1a] px-5 py-3 text-sm font-black text-white hover:bg-[#e86305]" type="submit">
            Crear miembro
          </button>
          <a className="min-h-11 rounded-md border border-slate-300 px-5 py-3 text-sm font-black text-[#061f46] hover:bg-white" href="/members">
            Cancelar
          </a>
        </div>
      </form>
    </AppShell>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-bold text-slate-800">
      {label}
      <input
        className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-[#083f88] focus:ring-2 focus:ring-blue-100"
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

function SelectField({
  children,
  defaultValue,
  label,
  name,
}: {
  children: React.ReactNode;
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="block text-sm font-bold text-slate-800">
      {label}
      <select
        className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-[#083f88] focus:ring-2 focus:ring-blue-100"
        defaultValue={defaultValue}
        name={name}
      >
        {children}
      </select>
    </label>
  );
}

async function createMemberFormAction(formData: FormData) {
  "use server";

  const result = await createMemberAction({ ok: false }, formData);

  if (!result.ok) {
    redirect(`/members/new?error=${encodeURIComponent(result.message ?? "No pudimos crear el miembro.")}`);
  }

  const warning = result.warning ? `?notice=${encodeURIComponent(result.warning)}` : "";
  redirect(`/members${warning}`);
}
