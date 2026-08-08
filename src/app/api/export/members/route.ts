import { requireApiUser } from "@/features/auth/services/auth.service";
import { createCsv } from "@/features/export/services/csv";
import { parseMembersExportFilters } from "@/features/export/services/export-filters";
import { listMembersForExport } from "@/features/export/services/export.repository";
import {
  csvDownload,
  exportErrorResponse,
  exportFilename,
} from "@/features/export/services/export-response";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { requireGymPermission } from "@/features/gyms/services/require-gym-permission";

const MEMBER_COLUMNS = [
  { header: "Codigo", key: "memberCode" },
  { header: "Nombre", key: "fullName" },
  { header: "Estado", key: "status" },
  { header: "Sucursal", key: "branchName" },
  { header: "Estado de membresia", key: "membershipStatus" },
  { header: "Plan", key: "membershipPlanName" },
  { header: "Proximo pago", key: "nextPaymentDate" },
  { header: "Monto vencido", key: "overdueAmount" },
  { header: "Tiene mora", key: "hasOverdueCharges" },
  { header: "Creado", key: "createdAt" },
] as const;

export async function GET(request: Request) {
  try {
    await requireApiUser();
    const activeGym = await getActiveGym();

    if (!activeGym) {
      return Response.json({ error: "No hay gimnasio activo." }, { status: 403 });
    }

    await requireGymPermission(activeGym.gymId, "members.read");
    const filters = parseMembersExportFilters(new URL(request.url).searchParams);
    const rows = await listMembersForExport({ gymId: activeGym.gymId, ...filters });

    return csvDownload(
      createCsv(rows, MEMBER_COLUMNS),
      exportFilename("miembros"),
    );
  } catch (error) {
    return exportErrorResponse(error);
  }
}
