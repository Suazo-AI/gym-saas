import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions/platform-gym.actions", () => ({ createPlatformGymAction: vi.fn() }));

import { CreatePlatformGymForm } from "./create-platform-gym-form";

describe("CreatePlatformGymForm", () => {
  it("renders the complete responsive tenant and owner contract", () => {
    const html = renderToStaticMarkup(createElement(CreatePlatformGymForm));

    expect(html).toContain("Crear gimnasio y dueño");
    expect(html).toContain('name="legalName"');
    expect(html).toContain('name="ownerEmail"');
    expect(html).toContain('value="NIO" selected=""');
    expect(html).toContain("md:grid-cols-2");
    expect(html).toContain("Crear e invitar dueño");
  });
});
