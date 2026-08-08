import { requireApiUser } from "@/features/auth/services/auth.service";
import { createCsv } from "@/features/export/services/csv";
import { parsePaymentsExportFilters } from "@/features/export/services/export-filters";
import { listPaymentsForExport } from "@/features/export/services/export.repository";
import {
  csvDownload,
  exportErrorResponse,
  exportFilename,
} from "@/features/export/services/export-response";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { requireGymPermission } from "@/features/gyms/services/require-gym-permission";

const PAYMENT_COLUMNS = [
  { header: "ID de pago", key: "paymentId" },
  { header: "ID de miembro", key: "gymMemberId" },
  { header: "Monto", key: "amount" },
  { header: "Moneda", key: "currency" },
  { header: "Estado", key: "status" },
  { header: "Recibo", key: "receiptNumber" },
  { header: "Fecha de pago", key: "paidAt" },
  { header: "Tasa NIO por USD", key: "appliedNioPerUsd" },
] as const;

export async function GET(request: Request) {
  try {
    await requireApiUser();
    const activeGym = await getActiveGym();

    if (!activeGym) {
      return Response.json({ error: "No hay gimnasio activo." }, { status: 403 });
    }

    await requireGymPermission(activeGym.gymId, "payments.read");
    const filters = parsePaymentsExportFilters(new URL(request.url).searchParams);
    const rows = await listPaymentsForExport({ gymId: activeGym.gymId, ...filters });

    return csvDownload(
      createCsv(rows, PAYMENT_COLUMNS),
      exportFilename("pagos"),
    );
  } catch (error) {
    return exportErrorResponse(error);
  }
}
