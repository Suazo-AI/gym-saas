import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { buildDateRangeHref, PersistedDateRangeForm } from "./persisted-date-range-form";

vi.mock("next/navigation", () => ({
  usePathname: () => "/entries",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("from=2026-08-01&to=2026-08-31"),
}));

describe("buildDateRangeHref", () => {
  it("agrega el rango sin perder otros filtros", () => {
    expect(buildDateRangeHref(
      "/entries",
      "search=ana",
      { from: "2026-08-01", to: "2026-08-31" },
    )).toBe("/entries?search=ana&from=2026-08-01&to=2026-08-31");
  });

  it("limpia solo el rango", () => {
    expect(buildDateRangeHref(
      "/entries",
      "search=ana&from=2026-08-01&to=2026-08-31",
      { from: "", to: "" },
    )).toBe("/entries?search=ana");
  });

  it("muestra el rango activo despues de navegar", () => {
    const html = renderToStaticMarkup(createElement(PersistedDateRangeForm, {
      from: "2026-08-01",
      to: "2026-08-31",
      storageKey: "test-date-range",
    }));

    expect(html).toContain('name="from"');
    expect(html).toContain('value="2026-08-01"');
    expect(html).toContain('name="to"');
    expect(html).toContain('value="2026-08-31"');
  });
});
