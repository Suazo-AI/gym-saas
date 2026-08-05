import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/member.actions", () => ({ restoreMemberAction: vi.fn() }));
import { DeletedMembers } from "./deleted-members";

describe("DeletedMembers", () => {
  it("muestra fecha, motivo y restauración", () => {
    const html = renderToStaticMarkup(createElement(DeletedMembers, { members: [{ id: "m1", label: "M-001 - Ana Martínez", deletedAt: "2026-08-04T00:00:00Z", reason: "Retiro" }] }));
    expect(html).toContain("M-001 - Ana Martínez");
    expect(html).toContain("Retiro");
    expect(html).toContain("Restaurar");
  });

  it("explica el estado vacío", () => {
    expect(renderToStaticMarkup(createElement(DeletedMembers, { members: [] }))).toContain("No hay miembros retirados");
  });
});
