import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
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
    <>
      <ModuleHeader
        eyebrow="Mostrador"
        title="Nuevo miembro"
        description="Registra sus datos, su plan y el primer pago en un solo paso. Al terminar lo verás en recepción."
      />
      {params.error ? (
        <div className="mt-6 max-w-3xl rounded-xl bg-stop-tint px-4 py-3 text-sm font-semibold text-stop" role="alert">
          {params.error}
        </div>
      ) : null}
      <form action={createMemberFormAction} className="mt-6 grid max-w-3xl gap-5">
        <input name="gymId" type="hidden" value={activeGym.gymId} />
        <Step number={1} title="Datos del miembro">
          <Field autoComplete="given-name" label="Nombre" name="firstName" required />
          <Field autoComplete="family-name" label="Apellido" name="lastName" required />
          {/* El campo parecia obligatorio y nadie lo dejaba vacio: en la base
              habia codigos tecleados a mano como 888 y UX-R1-20260821-1459.
              Dejarlo vacio genera el siguiente numero del gimnasio. */}
          <Field hint="Dejalo vacio y el sistema asigna el siguiente numero, por ejemplo M-000042." label="Codigo de miembro (opcional)" name="memberCode" placeholder="Se genera solo" />
          <Field autoComplete="tel" inputMode="tel" label="Telefono" name="phone" />
          <Field autoComplete="email" label="Correo" name="email" type="email" />
          <SelectField label="Sucursal" name="branchId">
            <option value="">Sin sucursal</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </SelectField>
        </Step>

        <Step number={2} title="Membresia inicial">
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
          <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-[10px] border border-line-strong px-3 text-sm font-semibold text-ink-2">
            <input className="size-[18px] accent-[var(--accent)]" defaultChecked name="createInitialCharge" type="checkbox" />
            Crear primer cargo automaticamente
          </label>
        </Step>

        <Step description="Si cobras hoy, registra el pago aquí y se aplica al primer cargo." number={3} title="Pago inicial opcional">
          <SelectField label="Metodo de pago" name="paymentMethodId">
            <option value="">Sin pago inicial</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
            <Field inputMode="decimal" label="Monto pagado" name="paymentAmount" placeholder="0.00" />
            <SelectField label="Moneda" name="paymentCurrency" defaultValue={activeGym.defaultCurrency}>
              <option value="NIO">NIO</option>
              <option value="USD">USD</option>
            </SelectField>
          </div>
          <label className="field-label md:col-span-2">
            Notas del pago
            <textarea className="field" name="paymentNotes" />
          </label>
        </Step>

        <details className="panel group p-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <StepNumber number={4} />
            <span className="type-heading flex-1">Agregar acceso facial (opcional)</span>
            <svg aria-hidden="true" className="size-5 text-muted transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <p className="mb-4 mt-2 text-sm text-muted">
            Puedes terminar el registro sin foto y agregarla después.
          </p>
          <MemberFaceEnrollmentField />
        </details>

        <div className="material sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border">
          <button className="btn btn-lg btn-primary" type="submit">
            Crear miembro
          </button>
          <Link className="btn btn-quiet" href="/members">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}

function StepNumber({ number }: { number: number }) {
  return (
    <span aria-hidden="true" className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-fill-strong text-sm font-bold text-ink-2">
      {number}
    </span>
  );
}

// Los pasos son una secuencia real: datos, plan, cobro y rostro, en ese orden.
function Step({ number, title, description, children }: { number: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5">
      <div className="flex items-center gap-3">
        <StepNumber number={number} />
        <h2 className="type-heading">{title}</h2>
      </div>
      {description ? <p className="mt-1 pl-10 text-sm text-muted">{description}</p> : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  autoComplete,
  hint,
  inputMode,
  label,
  name,
  placeholder,
  type = "text",
  required = false,
}: {
  autoComplete?: string;
  hint?: string;
  inputMode?: "decimal" | "tel";
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <label className="field-label">
      {label}
      <input
        aria-describedby={hintId}
        autoComplete={autoComplete}
        className="field"
        inputMode={inputMode}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
      {hint ? <span className="field-hint font-normal" id={hintId}>{hint}</span> : null}
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
    <label className="field-label">
      {label}
      <select
        className="field"
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

  // Al terminar el alta, recepcion cae en el veredicto del miembro nuevo:
  // desde ahi registra la entrada o cobra sin volver a buscarlo.
  const notice = encodeURIComponent(result.warning ?? "Miembro creado.");
  redirect(result.memberId ? `/entries?gymMemberId=${result.memberId}&notice=${notice}` : `/members?notice=${notice}`);
}
