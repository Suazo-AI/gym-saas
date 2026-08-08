import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseFaceServiceEnv, parseServerEnv } from "./env.server";

describe("parseServerEnv", () => {
  it("requires a private Supabase service role key", () => {
    expect(() =>
      parseServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toThrow();
  });

  it("does not accept a public service role variable", () => {
    expect(() =>
      parseServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "unsafe-public-key",
      }),
    ).toThrow();
  });

  it("accepts the server-only configuration", () => {
    expect(
      parseServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "private-test-key",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "private-test-key",
    });
  });
});

describe("parseFaceServiceEnv", () => {
  it("requires the service URL and a strong shared token", () => {
    expect(() => parseFaceServiceEnv({})).toThrow();
    expect(() => parseFaceServiceEnv({
      FACE_RECOGNITION_SERVICE_URL: "http://127.0.0.1:8010",
      FACE_RECOGNITION_SERVICE_TOKEN: "short",
    })).toThrow();
  });

  it("accepts server-only face service configuration", () => {
    const input = {
      FACE_RECOGNITION_SERVICE_URL: "http://127.0.0.1:8010",
      FACE_RECOGNITION_SERVICE_TOKEN: "face-service-test-token-1234567890",
    };

    expect(parseFaceServiceEnv(input)).toEqual(input);
  });
});
