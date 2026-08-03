import { describe, expect, it } from "vitest";

import { ApiError } from "./api-error";
import { mapSupabaseError } from "./map-supabase-error";

describe("mapSupabaseError", () => {
  it("devuelve el ApiError original sin tocarlo", () => {
    const original = new ApiError("CONFLICT", "Ya existe.");
    expect(mapSupabaseError(original)).toBe(original);
  });

  it("traduce 42501 a permiso denegado sin filtrar el mensaje interno", () => {
    const result = mapSupabaseError({
      code: "42501",
      message: "Insufficient permission: memberships.manage",
    });

    expect(result.code).toBe("FORBIDDEN");
    expect(result.message).toBe("No tienes permiso.");
    expect(result.internalMessage).toContain("memberships.manage");
  });

  it("muestra el mensaje en español que lanza una RPC del dominio (22023)", () => {
    const result = mapSupabaseError({
      code: "22023",
      message: "El miembro ya tiene una membresía vigente. Cancélala antes de asignar otra.",
    });

    expect(result.code).toBe("BUSINESS_RULE_VIOLATION");
    expect(result.message).toBe(
      "El miembro ya tiene una membresía vigente. Cancélala antes de asignar otra.",
    );
  });

  it("muestra el monto pendiente que devuelve el cobro (22023)", () => {
    const result = mapSupabaseError({
      code: "22023",
      message: "El monto excede lo pendiente. El miembro debe NIO 900.00.",
    });

    expect(result.message).toBe("El monto excede lo pendiente. El miembro debe NIO 900.00.");
  });

  it("muestra el mensaje en español de un P0002 del dominio", () => {
    const result = mapSupabaseError({
      code: "P0002",
      message: "No encontramos el miembro en este gimnasio.",
    });

    expect(result.code).toBe("NOT_FOUND");
    expect(result.message).toBe("No encontramos el miembro en este gimnasio.");
  });

  it("no filtra diagnósticos crudos de PostgreSQL aunque compartan código", () => {
    const result = mapSupabaseError({
      code: "23503",
      message:
        'insert or update on table "member_subscriptions" violates foreign key constraint "member_subscriptions_membership_plan_id_fkey"',
    });

    expect(result.code).toBe("BUSINESS_RULE_VIOLATION");
    expect(result.message).toBe("La operación no cumple las reglas del sistema.");
    expect(result.message).not.toContain("member_subscriptions");
    expect(result.internalMessage).toContain("member_subscriptions");
  });

  it("no filtra errores de sintaxis de entrada", () => {
    const result = mapSupabaseError({
      code: "22023",
      message: 'invalid input syntax for type uuid: "abc"',
    });

    expect(result.message).toBe("La operación no cumple las reglas del sistema.");
  });

  it("no filtra la firma de la RPC cuando el caché de esquema no está recargado", () => {
    const result = mapSupabaseError({
      code: "PGRST202",
      status: 404,
      message:
        "Could not find the function public.register_member_payment(p_allocations, p_amount, p_branch_id, p_currency, p_gym_id) in the schema cache",
    });

    expect(result.code).toBe("NOT_FOUND");
    expect(result.message).toBe("No encontramos el registro solicitado.");
    expect(result.message).not.toContain("register_member_payment");
    expect(result.internalMessage).toContain("register_member_payment");
  });

  it("no filtra diagnósticos que nombran objetos inexistentes", () => {
    const result = mapSupabaseError({
      code: "22023",
      message: 'relation "public.member_payments" does not exist',
    });

    expect(result.message).toBe("La operación no cumple las reglas del sistema.");
  });

  it("usa el mensaje genérico cuando la base no manda texto", () => {
    const result = mapSupabaseError({ code: "22023" });

    expect(result.message).toBe("La operación no cumple las reglas del sistema.");
  });

  it("mantiene el resto del mapeo intacto", () => {
    expect(mapSupabaseError({ code: "23505" }).code).toBe("CONFLICT");
    expect(mapSupabaseError({ status: 401 }).code).toBe("UNAUTHENTICATED");
    expect(mapSupabaseError({ status: 429 }).code).toBe("RATE_LIMITED");
    expect(mapSupabaseError({ code: "PGRST116" }).message).toBe(
      "No encontramos el registro solicitado.",
    );
    expect(mapSupabaseError({ message: "failed to fetch" }).code).toBe("EXTERNAL_SERVICE_ERROR");
    expect(mapSupabaseError("boom").code).toBe("INTERNAL_ERROR");
  });
});
