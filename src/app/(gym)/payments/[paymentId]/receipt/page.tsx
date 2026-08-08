import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { requireGymPermission } from "@/features/gyms/services/require-gym-permission";
import { PrintReceiptButton } from "@/features/payments/components/print-receipt-button";
import { getPaymentReceipt } from "@/features/payments/services/receipt.repository";

type ReceiptPageProps = {
  params: Promise<{ paymentId: string }>;
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  settled: "Pagado",
  failed: "Fallido",
  refunded: "Reembolsado",
  partially_refunded: "Reembolso parcial",
  void: "Anulado",
};

const negativeStamps: Record<string, string> = {
  failed: "FALLIDO",
  refunded: "REEMBOLSADO",
  partially_refunded: "REEMBOLSO PARCIAL",
  void: "ANULADO",
};

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const activeGym = await getActiveGym();
  if (!activeGym) redirect("/login");

  await requireGymPermission(activeGym.gymId, "payments.read");
  const { paymentId } = await params;
  const receipt = await getPaymentReceipt({
    gymId: activeGym.gymId,
    paymentId,
  });

  if (!receipt) notFound();

  const negativeStamp = negativeStamps[receipt.status];
  const paidAt = new Intl.DateTimeFormat("es-NI", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: activeGym.timezone,
  }).format(new Date(receipt.paidAt));

  return (
    <div className="receipt-page mx-auto max-w-3xl">
      <style>{`
        @media print {
          body > main > aside { display: none !important; }
          body > main { display: block !important; min-height: 0 !important; background: white !important; }
          body > main > section { padding: 0 !important; background: white !important; }
          .receipt-page { margin: 0 !important; max-width: none !important; }
          .receipt-sheet { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="print:hidden mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link className="print:hidden text-sm font-bold text-brand-green underline" href="/payments">
          Volver a pagos
        </Link>
        <PrintReceiptButton />
      </div>

      <article className="receipt-sheet relative overflow-hidden rounded-sm border border-slate-300 bg-white px-6 py-8 text-slate-900 shadow-sm sm:px-10">
        {negativeStamp ? (
          <div
            aria-label={`Estado: ${negativeStamp}`}
            className="absolute right-6 top-24 rotate-[-8deg] border-4 border-red-700 px-4 py-2 text-xl font-black tracking-[0.16em] text-red-700 sm:right-10 sm:text-2xl"
          >
            {negativeStamp}
          </div>
        ) : null}

        <header className="grid gap-6 border-b border-slate-300 pb-7 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Comprobante de pago</p>
            <h1 className="mt-2 text-2xl font-semibold">{activeGym.tradeName}</h1>
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Recibo</p>
            <p className="mt-1 font-mono text-lg">{receipt.receiptNumber ?? "Sin número"}</p>
          </div>
        </header>

        <dl className="grid gap-x-10 gap-y-6 py-8 sm:grid-cols-2">
          <ReceiptField label="Fecha" value={paidAt} />
          <ReceiptField label="Estado" value={statusLabels[receipt.status] ?? receipt.status} />
          <ReceiptField label="Socio" value={receipt.member.fullName ?? "Socio no disponible"} />
          <ReceiptField label="Código de socio" value={receipt.member.memberCode ?? "Sin código"} />
          <ReceiptField label="Método de pago" value={receipt.paymentMethod?.name ?? "No disponible"} />
          {receipt.currency !== activeGym.defaultCurrency ? (
            <ReceiptField label="Tasa aplicada" value={`C$${receipt.appliedNioPerUsd} por US$1`} />
          ) : null}
        </dl>

        <div className="border-t border-dashed border-slate-400 pt-8">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Monto recibido</p>
              <p className="mt-2 text-sm text-slate-500">Moneda {receipt.currency}</p>
            </div>
            <p className="font-mono text-3xl font-semibold tracking-tight">
              {receipt.currency} {receipt.amount}
            </p>
          </div>
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-500">
          Conserva este comprobante para tus registros.
        </footer>
      </article>
    </div>
  );
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
