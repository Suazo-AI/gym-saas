const DEFAULT_AUTH_CALLBACK_PATH = "/dashboard";

export function resolveAuthCallbackPath(next: string | null): string {
  if (
    !next?.startsWith("/")
    || next.startsWith("//")
    || next.includes("\\")
    || /[\u0000-\u001F\u007F]/.test(next)
  ) {
    return DEFAULT_AUTH_CALLBACK_PATH;
  }

  return next;
}
