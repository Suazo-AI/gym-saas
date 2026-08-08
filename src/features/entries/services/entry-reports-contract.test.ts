// CRITERIO DE ACEPTACION CONGELADO - paquete S4, Reportes esenciales.
//
// Escrito ANTES de la implementacion, por alguien que no la va a implementar.
// Su sha256 esta registrado en verification/packages.json y el verificador
// rechaza el paquete si este archivo cambia. Si una asercion resulta imposible
// de satisfacer, se para y se discute: no se afloja la prueba.
//
// Lo que este contrato exige:
//
//   src/features/entries/services/entry.repository.ts
//     -> listGymEntries(input: {
//          gymId: string;
//          from?: string | null;
//          to?: string | null;
//          limit?: number;
//        }): Promise<MemberEntryDto[]>
//
// Y que siga leyendo de v_gym_entries, que es la vista que une entradas
// manuales y faciales. El reporte de entradas por periodo no puede repetir el
// defecto del dashboard, que cuenta solo rostros.

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { listGymEntries } from "./entry.repository";

const OWN_GYM = "20000000-0000-4000-8000-000000000001";

type RecordedCall = { method: string; args: unknown[] };

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

describe("S4: entradas por periodo", () => {
  it("sigue leyendo la vista unificada, no solo los eventos faciales", async () => {
    const calls = recordingClient();

    await listGymEntries({ gymId: OWN_GYM });

    expect(argsFor(calls, "from")).toContainEqual(["v_gym_entries"]);
  });

  it("filtra por el gimnasio recibido en el objeto de entrada", async () => {
    const calls = recordingClient();

    await listGymEntries({ gymId: OWN_GYM });

    expect(argsFor(calls, "eq")).toContainEqual(["gym_id", OWN_GYM]);
  });

  it("aplica el rango sobre occurred_at cuando recibe from y to", async () => {
    const calls = recordingClient();

    await listGymEntries({ gymId: OWN_GYM, from: "2026-08-01", to: "2026-08-31" });

    const lower = boundOn(calls, "gte", "occurred_at");
    const upper = boundOn(calls, "lte", "occurred_at");

    expect(lower).toHaveLength(1);
    expect(upper).toHaveLength(1);
    expect(String(lower[0][1])).toMatch(/^2026-08-01/);
    expect(String(upper[0][1])).toMatch(/^2026-08-31/);
  });

  it("sin rango no filtra por fecha", async () => {
    const calls = recordingClient();

    await listGymEntries({ gymId: OWN_GYM });

    expect(boundOn(calls, "gte", "occurred_at")).toHaveLength(0);
    expect(boundOn(calls, "lte", "occurred_at")).toHaveLength(0);
  });

  it("rechaza un rango invertido en vez de devolver una lista vacia", async () => {
    recordingClient();

    await expect(
      listGymEntries({ gymId: OWN_GYM, from: "2026-08-31", to: "2026-08-01" }),
    ).rejects.toThrow();
  });

  it("no deja que el limite pedido supere 100", async () => {
    const calls = recordingClient();

    await listGymEntries({ gymId: OWN_GYM, limit: 5000 });

    const limits = argsFor(calls, "limit").map((args) => Number(args[0]));
    expect(limits.length).toBeGreaterThan(0);
    expect(Math.max(...limits)).toBeLessThanOrEqual(100);
  });
});
