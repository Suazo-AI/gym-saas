import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApiError } from "@/lib/api/api-error";

export function csvDownload(body: string, filename: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function exportErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Los filtros no son validos." },
      { status: 400 },
    );
  }

  if (error instanceof ApiError) {
    const status = error.code === "UNAUTHENTICATED"
      ? 401
      : error.code === "FORBIDDEN"
        ? 403
        : error.code === "VALIDATION_ERROR"
          ? 400
          : error.code === "BUSINESS_RULE_VIOLATION"
            ? 422
            : 500;

    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }

  return NextResponse.json(
    { error: "No pudimos exportar los datos." },
    { status: 500 },
  );
}

export function exportFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}
