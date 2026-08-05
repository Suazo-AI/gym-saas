import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/branch.actions", () => ({ createBranchAction: vi.fn(), updateBranchAction: vi.fn(), retireBranchAction: vi.fn(), restoreBranchAction: vi.fn() }));
import { BranchManagement } from "./branch-management";

describe("BranchManagement", () => {
  it("muestra creacion, edicion, retiro y papelera con lenguaje de negocio", () => {
    const html = renderToStaticMarkup(createElement(BranchManagement, {
      branches: [{ id: "b1", code: "CEN", name: "Central", city: "Managua", status: "active" }],
      deletedBranches: [{ id: "b2", label: "NORTE - Norte", deletedAt: "2026-08-04T00:00:00Z", reason: "Cierre" }],
    }));
    expect(html).toContain("Crear sucursal"); expect(html).toContain("Guardar cambios"); expect(html).toContain("Retirar sucursal"); expect(html).toContain("Restaurar");
    expect(html).not.toMatch(/RPC|RLS|Supabase|CRUD|contrato|lectura directa/i);
  });
});
