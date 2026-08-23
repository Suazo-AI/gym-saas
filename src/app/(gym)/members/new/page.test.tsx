import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("NewMemberPage mobile flow", () => {
  it("keeps the core membership fields before optional facial enrollment", () => {
    const source = readFileSync("src/app/(gym)/members/new/page.tsx", "utf8");
    const membershipPosition = source.indexOf("Membresia inicial");
    const facePosition = source.indexOf("<MemberFaceEnrollmentField />");

    expect(membershipPosition).toBeGreaterThan(-1);
    expect(facePosition).toBeGreaterThan(membershipPosition);
    expect(source).toContain("Agregar acceso facial (opcional)");
    expect(source).toContain("<details");
  });
});
