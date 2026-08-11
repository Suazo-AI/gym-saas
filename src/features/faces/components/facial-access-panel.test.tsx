import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/faces/capture/face-camera", () => ({
  FaceCamera: ({ frameCount }: { frameCount: number }) => (
    <div data-frame-count={frameCount}>Cámara facial</div>
  ),
}));

import {
  decisionLabel,
  FacialAccessPanel,
  requestFaceVerification,
} from "./facial-access-panel";

describe("FacialAccessPanel", () => {
  it("renders read-only mode without camera when faces.verify is missing", () => {
    const html = renderToStaticMarkup(<FacialAccessPanel canVerify={false} />);

    expect(html).toContain("Modo de consulta");
    expect(html).not.toContain("Cámara facial");
  });

  it("renders one-frame camera when faces.verify is granted", () => {
    const html = renderToStaticMarkup(<FacialAccessPanel canVerify />);

    expect(html).toContain("Cámara facial");
    expect(html).toContain('data-frame-count="1"');
  });

  it("sends only the captured image to the existing verification route", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        decision: "allowed",
        decisionReason: "Membresía activa.",
        accessAllowed: true,
        similarity: 0.91,
        member: null,
      }),
    });

    await expect(requestFaceVerification("data:image/jpeg;base64,face", request)).resolves.toMatchObject({
      decision: "allowed",
    });
    expect(request).toHaveBeenCalledWith("/api/face/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageBase64: "data:image/jpeg;base64,face" }),
    });
  });

  it("surfaces a controlled API error", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "Demasiados intentos." }),
    });

    await expect(requestFaceVerification("image", request)).rejects.toThrow("Demasiados intentos.");
  });

  it.each([
    ["allowed", "Acceso permitido"],
    ["denied", "Acceso denegado"],
    ["manual_review", "Revisión manual"],
    ["no_match", "Sin coincidencia"],
  ] as const)("labels %s decisions", (decision, label) => {
    expect(decisionLabel(decision)).toBe(label);
  });
});
