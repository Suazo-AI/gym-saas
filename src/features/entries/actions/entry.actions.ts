"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/api-error";

import { registerMemberEntry } from "../services/entry.repository";
import type { RegisteredEntryDto } from "../types/entry.dto";

export type EntryActionState = {
  ok: boolean;
  message?: string;
  result?: RegisteredEntryDto;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export async function registerEntryAction(
  _state: EntryActionState,
  formData: FormData,
): Promise<EntryActionState> {
  try {
    const result = await registerMemberEntry({
      gymId: text(formData, "gymId") ?? "",
      gymMemberId: text(formData, "gymMemberId") ?? "",
      branchId: text(formData, "branchId") ?? null,
      overrideReason: text(formData, "overrideReason") ?? null,
    });

    revalidatePath("/entries");
    revalidatePath("/dashboard");

    return {
      ok: true,
      message: result.decision === "denied"
        ? "La entrada quedó registrada, pero el acceso no fue permitido."
        : "Entrada registrada.",
      result,
    };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

function publicMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "No pudimos completar la operación.";
}
