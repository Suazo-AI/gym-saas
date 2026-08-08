import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { getPaymentReceipt } from "./receipt.repository";

describe("getPaymentReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no devuelve un pago de otro gimnasio", async () => {
    const rows = [
      {
        gym_id: "gym-other",
        id: "payment-1",
        gym_member_id: "member-other",
        payment_method_id: "cash",
        amount: "900.00",
        currency: "NIO",
        status: "settled",
        receipt_number: "R-OTHER",
        paid_at: "2026-08-08T15:00:00.000Z",
        applied_nio_per_usd: "36.600000",
      },
    ];
    const filters: Array<[string, unknown]> = [];
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockImplementation((column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    });
    query.maybeSingle.mockImplementation(async () => ({
      data: rows.find((row) =>
        filters.every(([column, value]) => row[column as keyof typeof row] === value),
      ) ?? null,
      error: null,
    }));
    const from = vi.fn().mockReturnValue(query);
    mocks.createClient.mockResolvedValue({ from });

    const result = await getPaymentReceipt({
      gymId: "gym-active",
      paymentId: "payment-1",
    });

    expect(result).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("filtra por el gimnasio activo y por el id de la URL", async () => {
    const eq = vi.fn();
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const query = {
      select: vi.fn(),
      eq,
      maybeSingle,
    };
    query.select.mockReturnValue(query);
    eq.mockReturnValue(query);
    const from = vi.fn().mockReturnValue(query);
    mocks.createClient.mockResolvedValue({ from });

    const result = await getPaymentReceipt({
      gymId: "gym-active",
      paymentId: "payment-from-url",
    });

    expect(result).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("member_payments");
    expect(eq).toHaveBeenCalledWith("gym_id", "gym-active");
    expect(eq).toHaveBeenCalledWith("id", "payment-from-url");
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});
