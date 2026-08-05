import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import MemberDetailError from "./error";
import MemberDetailLoading from "./loading";
import MemberDetailNotFound from "./not-found";

describe("member detail route states", () => {
  it("renders explicit loading and recoverable error states", () => {
    const loadingHtml = renderToStaticMarkup(createElement(MemberDetailLoading));
    const errorHtml = renderToStaticMarkup(createElement(MemberDetailError, {
      error: new Error("boom"),
      reset: vi.fn(),
    }));
    const notFoundHtml = renderToStaticMarkup(createElement(MemberDetailNotFound));

    expect(loadingHtml).toContain('role="status"');
    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain("Intentar de nuevo");
    expect(notFoundHtml).toContain("Miembro no encontrado");
  });
});
