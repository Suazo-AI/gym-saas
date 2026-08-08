// CRITERIO DE ACEPTACION CONGELADO - paquete S4, Reportes esenciales.
//
// Escrito ANTES de la implementacion, por alguien que no la va a implementar.
// Su sha256 esta registrado en verification/packages.json y el verificador
// rechaza el paquete si este archivo cambia. Si una asercion resulta imposible
// de satisfacer, se para y se discute: no se afloja la prueba.
//
// Lo que este contrato exige:
//
//   src/features/payments/services/payment.repository.ts
//     -> listRecentPayments(input: {
//          gymId: string;
//          from?: string | null;
//          to?: string | null;
//          limit?: number;
//        }): Promise<PaymentSummaryDto[]>
//
// El objeto reemplaza a la firma posicional (gymId, limit) por la misma razon
// por la que ya lo hace listMembersForExport: cuatro parametros posicionales de
// los cuales tres son opcionales se confunden en el punto de llamada.
// Los llamadores viven en src/app/(gym)/, que esta dentro del alcance.
//
// El riesgo que estas pruebas existen para impedir: que un reporte "por
// periodo" ignore silenciosamente el periodo y devuelva las ultimas N filas,
// que es exactamente lo que hace hoy la funcion.

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { listRecentPayments } from "./payment.repository";

const OWN_GYM = "20000000-0000-4000-8000-000000000001";

type RecordedCall = { method: string; args: unknown[] };

// Cliente que no consulta nada: solo anota que le pidieron. Un mock que
// devuelve filas probaria el mapeo, y el mapeo no es lo que esta en juego aca.
function recordingClient(rows: unknown[] = []) {
  const calls: RecordedCall[] = [];
  const builder: Record<string, unknown> = {};

  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };

  for (const method of [
    "select", "eq", "neq", "gt", "gte", "lt", "lte",
    "in", "is", "not", "filter", "order", "limit", "range",
  ]) {
    builder[method] = record(method);
  }

  // El builder es awaitable en cualquier punto de la cadena, para no imponer
  // cual llamada la termina.
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve(resolve({ data: rows, error: null }));

  const client = {
    from: (relation: string) => {
      calls.push({ method: "from", args: [relation] });
      return builder;
    },
  };

  mocks.createClient.mockResolvedValue(client);
  return calls;
}

const argsFor = (calls: RecordedCall[], method: string) =>
  calls.filter((call) => call.method === method).map((call) => call.args);

const boundOn = (calls: RecordedCall[], method: string, column: string) =>
  argsFor(calls, method).filter((args) => args[0] === column);

describe("S4: pagos por periodo", () => {
  it("filtra por el gimnasio recibido en el objeto de entrada", async () => {
    const calls = recordingClient();

    await listRecentPayments({ gymId: OWN_GYM });

    expect(argsFor(calls, "eq")).toContainEqual(["gym_id", OWN_GYM]);
  });

  it("aplica el rango sobre paid_at cuando recibe from y to", async () => {
    const calls = recordingClient();

    await listRecentPayments({ gymId: OWN_GYM, from: "2026-08-01", to: "2026-08-31" });

    const lower = boundOn(calls, "gte", "paid_at");
    const upper = boundOn(calls, "lte", "paid_at");

    expect(lower).toHaveLength(1);
    expect(upper).toHaveLength(1);
    // Se permite normalizar la fecha a un instante; no se permite perderla.
    expect(String(lower[0][1])).toMatch(/^2026-08-01/);
    expect(String(upper[0][1])).toMatch(/^2026-08-31/);
  });

  it("acepta un solo extremo del rango", async () => {
    const calls = recordingClient();

    await listRecentPayments({ gymId: OWN_GYM, from: "2026-08-01" });

    expect(boundOn(calls, "gte", "paid_at")).toHaveLength(1);
    expect(boundOn(calls, "lte", "paid_at")).toHaveLength(0);
  });

  it("sin rango no filtra por fecha", async () => {
    const calls = recordingClient();

    await listRecentPayments({ gymId: OWN_GYM });

    expect(boundOn(calls, "gte", "paid_at")).toHaveLength(0);
    expect(boundOn(calls, "lte", "paid_at")).toHaveLength(0);
  });

  it("rechaza un rango invertido en vez de devolver una lista vacia", async () => {
    recordingClient();

    await expect(
      listRecentPayments({ gymId: OWN_GYM, from: "2026-08-31", to: "2026-08-01" }),
    ).rejects.toThrow();
  });

  it("no deja que el limite pedido supere 100", async () => {
    const calls = recordingClient();

    await listRecentPayments({ gymId: OWN_GYM, limit: 5000 });

    const limits = argsFor(calls, "limit").map((args) => Number(args[0]));
    expect(limits.length).toBeGreaterThan(0);
    expect(Math.max(...limits)).toBeLessThanOrEqual(100);
  });
});
