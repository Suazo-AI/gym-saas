import { ApiError } from "@/lib/api/api-error";

export function memberNotFoundError() {
  return new ApiError("NOT_FOUND", "No encontramos el miembro solicitado.");
}

export function memberValidationError(message = "Revisa los datos del miembro.") {
  return new ApiError("VALIDATION_ERROR", message);
}
