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

  it("dice que el codigo de miembro es opcional y se genera solo", () => {
    const source = readFileSync("src/app/(gym)/members/new/page.tsx", "utf8");
    // Solo la etiqueta <Field ... name="memberCode" ... />, sin arrastrar la de
    // al lado: lastName si lleva required y ensuciaba la asercion.
    const campo = source.match(/<Field[^>]*name="memberCode"[^>]*\/>/)?.[0] ?? "";
    expect(campo).not.toBe("");

    // El campo nunca fue obligatorio: la RPC genera el codigo cuando llega
    // vacio. Pero se veia igual que Nombre y Apellido, asi que nadie lo dejaba
    // vacio y en la base aparecieron 888 y UX-R1-20260821-1459.
    expect(campo).toContain("(opcional)");
    expect(campo).toContain("hint=");
    expect(campo).not.toContain("required");
  });
});
