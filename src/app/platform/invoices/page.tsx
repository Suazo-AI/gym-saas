import { redirect } from "next/navigation";

import { ModuleHeader } from "@/features/app/components/module-header";
import { requireUser } from "@/features/auth/services/auth.service";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { getPlatformDashboard } from "@/features/platform/services/platform.repository";

export default async function PlatformInvoicesPage() {
  const user = await requireUser();
  if (user.app_metadata?.platform_role !== "admin") {
    redirect("/dashboard");
  }

  const dashboard = await getPlatformDashboard();

  return (
    <PlatformShell currentPath="/platform/invoices" userEmail={user.email}>
      <ModuleHeader
        eyebrow="Facturacion SaaS"
        title="Facturas"
        description="Control de facturas emitidas, saldos y vencimientos de clientes del SaaS."
      />
      <section className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr><th className="py-3">Factura</th><th>Gimnasio</th><th>Estado</th><th>Total</th><th>Pagado</th><th>Vence</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dashboard.invoices.map((invoice) => (
              <tr key={invoice.invoiceId}>
                <td className="py-4 font-black text-[#061f46]">{invoice.invoiceNumber}</td>
                <td>{invoice.gymName}</td>
                <td>{invoice.status}</td>
                <td>{invoice.currency} {invoice.totalAmount}</td>
                <td>{invoice.currency} {invoice.amountPaid}</td>
                <td>{formatNullableDate(invoice.dueAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PlatformShell>
  );
}

function formatNullableDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-NI", { dateStyle: "medium" }).format(new Date(value)) : "Sin fecha";
}
