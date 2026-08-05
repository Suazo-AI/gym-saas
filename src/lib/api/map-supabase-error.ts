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

  if (
    supabaseError.code === "22023" ||
    supabaseError.code === "23503" ||
    supabaseError.code === "23514"
  ) {
    return new ApiError(
      "BUSINESS_RULE_VIOLATION",
      userFacingMessage(supabaseError.message, supabaseError.code) ??
        "La operación no cumple las reglas del sistema.",
      { cause: error, internalMessage },
    );
  }

  if (
    supabaseError.status === 404 ||
    supabaseError.code === "PGRST116" ||
    supabaseError.code === "P0002"
  ) {
    // Sólo P0002 lo lanza una RPC nuestra a propósito. Un 404 de PostgREST habla
    // de la forma de la API, no del negocio.
    const message =
      supabaseError.code === "P0002"
        ? userFacingMessage(supabaseError.message, supabaseError.code)
        : null;

    return new ApiError("NOT_FOUND", message ?? "No encontramos el registro solicitado.", {
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

// Las RPC del dominio lanzan mensajes en español pensados para la recepcionista
// ("El miembro ya tiene una membresía vigente."). PostgreSQL usa los mismos
// códigos para sus propios diagnósticos, que son técnicos y en inglés. Sólo
// dejamos pasar el mensaje cuando no parece un diagnóstico del motor.
const DATABASE_DIAGNOSTIC =
  /violates|constraint|relation\s|column\s|duplicate key|invalid input syntax|out of range|null value in|schema cache|could not find|does not exist|permission denied for/i;

function userFacingMessage(message?: string, code?: string): string | null {
  const trimmed = message?.trim();
  if (!trimmed) {
    return null;
  }

  // PostgREST describe la forma de la API, no el negocio: sus mensajes nombran
  // funciones con toda su lista de parámetros, tablas y columnas. El caso normal
  // es justo después de desplegar una migración, cuando el caché de esquema
  // todavía no se recargó. Eso nunca se le muestra a la recepcionista.
  if (code?.startsWith("PGRST")) {
    return null;
  }

  if (DATABASE_DIAGNOSTIC.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function toSupabaseLikeError(error: unknown): SupabaseLikeError {
  if (error && typeof error === "object") {
    return error as SupabaseLikeError;
  }

  return { message: String(error) };
}
