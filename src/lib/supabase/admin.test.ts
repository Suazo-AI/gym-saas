import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildAdminClient } from "./admin";

describe("buildAdminClient", () => {
  it("creates a non-persistent administrator client", () => {
    const factory = vi.fn(() => ({ auth: { admin: {} } }));

    const client = buildAdminClient(factory, {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "private-test-key",
    });

    expect(factory).toHaveBeenCalledWith(
      "http://127.0.0.1:54321",
      "private-test-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    expect(client).toEqual({ auth: { admin: {} } });
  });
});
