import { describe, expect, it } from "vitest";

import { createPlatformGymSchema } from "./platform-gym.schema";

const valid = {
  legalName: "Gimnasio Central, S.A.",
  tradeName: "Gimnasio Central",
  slug: "gimnasio-central",
  taxIdentifier: "J031000000001",
  defaultCurrency: "NIO",
  timezone: "America/Managua",
  ownerName: "Ana Lopez",
  ownerEmail: "ANA@EXAMPLE.COM",
};

describe("createPlatformGymSchema", () => {
  it("normalizes the owner email and optional tax identifier", () => {
    expect(createPlatformGymSchema.parse(valid)).toMatchObject({ ownerEmail: "ana@example.com", taxIdentifier: "J031000000001" });
    expect(createPlatformGymSchema.parse({ ...valid, taxIdentifier: "" }).taxIdentifier).toBeNull();
  });

  it("rejects an unsafe slug or unsupported currency", () => {
    expect(createPlatformGymSchema.safeParse({ ...valid, slug: "Gimnasio Central" }).success).toBe(false);
    expect(createPlatformGymSchema.safeParse({ ...valid, defaultCurrency: "EUR" }).success).toBe(false);
  });
});
