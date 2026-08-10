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

export function parseRecoverySessionHash(hash: string): { access_token: string; refresh_token: string } | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");
  if (!accessToken || !refreshToken || (type !== "invite" && type !== "recovery")) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}
