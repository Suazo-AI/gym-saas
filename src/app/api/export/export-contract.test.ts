// CRITERIO DE ACEPTACION CONGELADO - paquete S3, Exportar datos.
//
// Escrito ANTES de la implementacion, por alguien que no la va a implementar.
// Su sha256 esta registrado en verification/packages.json y el verificador
// rechaza el paquete si este archivo cambia. Si una asercion resulta imposible
// de satisfacer, se para y se discute: no se afloja la prueba.
//
// Lo que este contrato exige que exista:
//
//   src/app/api/export/members/route.ts    -> export async function GET(request: Request)
//   src/app/api/export/payments/route.ts   -> export async function GET(request: Request)
//   src/features/export/services/export.repository.ts
//        -> listMembersForExport({ gymId, ... }): Promise<Record<string, unknown>[]>
//        -> listPaymentsForExport({ gymId, ... }): Promise<Record<string, unknown>[]>
//   src/features/export/services/csv.ts
//        -> escapeCsvCell(value: unknown): string
//
// El riesgo que estas pruebas existen para impedir: que una exportacion
// entregue datos de otro gimnasio, o que un CSV se convierta en formula
// ejecutable al abrirlo en Excel.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/api-error";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getActiveGym: vi.fn(),
  requireGymPermission: vi.fn(),
  listMembersForExport: vi.fn(),
  listPaymentsForExport: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
  },
}));

vi.mock("@/features/auth/services/auth.service", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/features/gyms/services/get-active-gym", () => ({
  getActiveGym: mocks.getActiveGym,
}));

vi.mock("@/features/gyms/services/require-gym-permission", () => ({
  requireGymPermission: mocks.requireGymPermission,
}));

vi.mock("@/features/export/services/export.repository", () => ({
  listMembersForExport: mocks.listMembersForExport,
  listPaymentsForExport: mocks.listPaymentsForExport,
}));

import { GET as exportMembers } from "./members/route";
import { GET as exportPayments } from "./payments/route";
import { escapeCsvCell } from "@/features/export/services/csv";

const OWN_GYM = "20000000-0000-4000-8000-000000000001";
const OTHER_GYM = "20000000-0000-4000-8000-000000000002";

const request = (url: string) => new Request(url, { method: "GET" });

describe("exportacion de datos: autenticacion y permisos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000001" });
    mocks.getActiveGym.mockResolvedValue({ gymId: OWN_GYM });
    mocks.requireGymPermission.mockResolvedValue(undefined);
    mocks.listMembersForExport.mockResolvedValue([]);
    mocks.listPaymentsForExport.mockResolvedValue([]);
  });

  it("miembros: responde 401 sin sesion y no consulta datos", async () => {
    mocks.requireApiUser.mockRejectedValue(
      new ApiError("UNAUTHENTICATED", "Debes iniciar sesion."),
    );

    const response = await exportMembers(request("http://localhost/api/export/members"));

    expect(response.status).toBe(401);
    expect(mocks.listMembersForExport).not.toHaveBeenCalled();
  });

  it("miembros: responde 403 sin members.read y no consulta datos", async () => {
    mocks.requireGymPermission.mockRejectedValue(
      new ApiError("FORBIDDEN", "No tienes permiso."),
    );

    const response = await exportMembers(request("http://localhost/api/export/members"));

    expect(response.status).toBe(403);
    expect(mocks.listMembersForExport).not.toHaveBeenCalled();
  });

  it("miembros: exige exactamente el permiso members.read", async () => {
    await exportMembers(request("http://localhost/api/export/members"));

    expect(mocks.requireGymPermission).toHaveBeenCalledWith(OWN_GYM, "members.read");
  });

  it("pagos: responde 403 sin payments.read y no consulta datos", async () => {
    mocks.requireGymPermission.mockRejectedValue(
      new ApiError("FORBIDDEN", "No tienes permiso."),
    );

    const response = await exportPayments(request("http://localhost/api/export/payments"));

    expect(response.status).toBe(403);
    expect(mocks.listPaymentsForExport).not.toHaveBeenCalled();
  });

  it("pagos: exige exactamente el permiso payments.read", async () => {
    await exportPayments(request("http://localhost/api/export/payments"));

    expect(mocks.requireGymPermission).toHaveBeenCalledWith(OWN_GYM, "payments.read");
  });
});

describe("exportacion de datos: aislamiento entre gimnasios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000001" });
    mocks.getActiveGym.mockResolvedValue({ gymId: OWN_GYM });
    mocks.requireGymPermission.mockResolvedValue(undefined);
    mocks.listMembersForExport.mockResolvedValue([]);
    mocks.listPaymentsForExport.mockResolvedValue([]);
  });

  it("miembros: el gymId sale del gimnasio activo y NUNCA de la query string", async () => {
    await exportMembers(
      request(`http://localhost/api/export/members?gymId=${OTHER_GYM}&gym_id=${OTHER_GYM}`),
    );

    expect(mocks.listMembersForExport).toHaveBeenCalledTimes(1);
    const args = mocks.listMembersForExport.mock.calls[0][0] as { gymId: string };
    expect(args.gymId).toBe(OWN_GYM);
    expect(JSON.stringify(mocks.listMembersForExport.mock.calls[0])).not.toContain(OTHER_GYM);
  });

  it("pagos: el gymId sale del gimnasio activo y NUNCA de la query string", async () => {
    await exportPayments(
      request(`http://localhost/api/export/payments?gymId=${OTHER_GYM}&gym_id=${OTHER_GYM}`),
    );

    expect(mocks.listPaymentsForExport).toHaveBeenCalledTimes(1);
    const args = mocks.listPaymentsForExport.mock.calls[0][0] as { gymId: string };
    expect(args.gymId).toBe(OWN_GYM);
    expect(JSON.stringify(mocks.listPaymentsForExport.mock.calls[0])).not.toContain(OTHER_GYM);
  });
});

describe("exportacion de datos: forma de la respuesta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000001" });
    mocks.getActiveGym.mockResolvedValue({ gymId: OWN_GYM });
    mocks.requireGymPermission.mockResolvedValue(undefined);
    mocks.listMembersForExport.mockResolvedValue([
      { memberCode: "M-001", fullName: "Ana Lopez" },
    ]);
    mocks.listPaymentsForExport.mockResolvedValue([]);
  });

  it("miembros: responde como CSV descargable, no como JSON", async () => {
    const response = await exportMembers(request("http://localhost/api/export/members"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("attachment");
  });

  it("miembros: el cuerpo trae encabezado y la fila de datos", async () => {
    const response = await exportMembers(request("http://localhost/api/export/members"));
    const body = await response.text();

    expect(body).toContain("M-001");
    expect(body).toContain("Ana Lopez");
    expect(body.trim().split(/\r?\n/).length).toBeGreaterThanOrEqual(2);
  });
});

describe("exportacion de datos: inyeccion de formulas en CSV", () => {
  // Un miembro que se llame =cmd|... ejecuta codigo al abrir el archivo en Excel.
  // Toda celda que arranque con =, +, - o @ se neutraliza con una comilla simple.
  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "=cmd|'/c calc'!A1"])(
    "neutraliza la celda peligrosa %s",
    (peligrosa) => {
      expect(escapeCsvCell(peligrosa).startsWith("'")).toBe(true);
    },
  );

  it("no toca un valor normal", () => {
    expect(escapeCsvCell("Ana Lopez")).toBe("Ana Lopez");
  });

  it("entrecomilla lo que lleva coma, comillas o salto de linea", () => {
    expect(escapeCsvCell("Lopez, Ana")).toBe('"Lopez, Ana"');
    expect(escapeCsvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(escapeCsvCell("linea1\nlinea2")).toBe('"linea1\nlinea2"');
  });

  it("convierte null y undefined en celda vacia, no en el texto null", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });
});
