import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageSkeleton } from "./page-skeleton";

describe("PageSkeleton", () => {
  it("exposes an accessible loading status and stable animated surfaces", () => {
    const html = renderToStaticMarkup(createElement(PageSkeleton, { screen: "members" }));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Cargando"');
    expect(html).toContain("animate-pulse");
  });
});
