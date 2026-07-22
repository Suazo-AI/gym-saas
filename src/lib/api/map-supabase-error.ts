import { ApiError } from "./api-error";

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
  name?: string;
};

export function mapSupabaseError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const supabaseError = toSupabaseLikeError(error);
  const internalMessage = [
    supabaseError.code,
    supabaseError.name,
    supabaseError.message,
    supabaseError.details,
    supabaseError.hint,
  ]
    .filter(Boolean)
    .join(" | ");

  if (supabaseError.status === 401 || supabaseError.message?.toLowerCase().includes("jwt")) {
    return new ApiError("UNAUTHENTICATED", "Tu sesión no es válida.", {
      cause: error,
      internalMessage,
    });
  }

  if (supabaseError.status === 403 || supabaseError.code === "42501") {
    return new ApiError("FORBIDDEN", "No tienes permiso.", {
      cause: error,
      internalMessage,
    });
  }

  if (supabaseError.code === "23505") {
    return new ApiError("CONFLICT", "El registro ya existe.", {
      cause: error,
      internalMessage,
    });
  }

  if (supabaseError.code === "23503" || supabaseError.code === "23514") {
    return new ApiError("BUSINESS_RULE_VIOLATION", "La operación no cumple las reglas del sistema.", {
      cause: error,
      internalMessage,
    });
  }

  if (supabaseError.status === 404 || supabaseError.code === "PGRST116") {
    return new ApiError("NOT_FOUND", "No encontramos el registro solicitado.", {
      cause: error,
      internalMessage,
    });
  }

  if (supabaseError.status === 429) {
    return new ApiError("RATE_LIMITED", "Demasiados intentos. Intenta de nuevo en unos minutos.", {
      cause: error,
      internalMessage,
    });
  }

  if (supabaseError.message?.toLowerCase().includes("fetch")) {
    return new ApiError("EXTERNAL_SERVICE_ERROR", "No pudimos conectar con el servicio.", {
      cause: error,
      internalMessage,
    });
  }

  return new ApiError("INTERNAL_ERROR", "Ocurrió un error inesperado.", {
    cause: error,
    internalMessage,
  });
}

function toSupabaseLikeError(error: unknown): SupabaseLikeError {
  if (error && typeof error === "object") {
    return error as SupabaseLikeError;
  }

  return { message: String(error) };
}
