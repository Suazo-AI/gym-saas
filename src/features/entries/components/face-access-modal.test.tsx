import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  acquireMediaStream,
  clearVideoStream,
  FaceAccessModal,
  focusFirstDialogControl,
  handleDialogKeyDown,
  restoreDialogTriggerFocus,
  ResultPanel,
  stopMediaStream,
} from "./face-access-modal";

describe("FaceAccessModal", () => {
  it("renders an explicitly labelled modal dialog", () => {
    const html = renderToStaticMarkup(createElement(FaceAccessModal, { initiallyOpen: true }));

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="face-access-title"');
    expect(html).toContain('id="face-access-title"');
  });

  it("closes with Escape", () => {
    const close = vi.fn();
    const preventDefault = vi.fn();
    const event = {
      key: "Escape",
      shiftKey: false,
      preventDefault,
      currentTarget: {},
    } as unknown as Parameters<typeof handleDialogKeyDown>[0];

    handleDialogKeyDown(event, close);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("wraps focus inside the dialog", () => {
    const first = { focus: vi.fn(), getAttribute: () => null, hasAttribute: () => false };
    const last = { focus: vi.fn(), getAttribute: () => null, hasAttribute: () => false };
    const preventDefault = vi.fn();
    const event = {
      key: "Tab",
      shiftKey: false,
      preventDefault,
      currentTarget: {
        ownerDocument: { activeElement: last },
        querySelectorAll: () => [first, last],
      },
    } as unknown as Parameters<typeof handleDialogKeyDown>[0];

    handleDialogKeyDown(event, vi.fn());

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
  });

  it("stops every camera track during cleanup", () => {
    const firstTrack = { stop: vi.fn() };
    const secondTrack = { stop: vi.fn() };
    const stream = {
      getTracks: () => [firstTrack, secondTrack],
    } as unknown as MediaStream;

    stopMediaStream(stream);

    expect(firstTrack.stop).toHaveBeenCalledOnce();
    expect(secondTrack.stop).toHaveBeenCalledOnce();
  });

  it("moves initial focus to the first dialog control", () => {
    const first = { focus: vi.fn(), getAttribute: () => null, hasAttribute: () => false };
    const dialog = {
      querySelectorAll: () => [first],
    } as unknown as HTMLElement;

    focusFirstDialogControl(dialog);

    expect(first.focus).toHaveBeenCalledOnce();
  });

  it("returns focus to the control that opened the dialog", () => {
    const trigger = { focus: vi.fn() } as unknown as HTMLElement;

    restoreDialogTriggerFocus(trigger);

    expect(trigger.focus).toHaveBeenCalledOnce();
  });

  it("stops a camera stream that resolves after cancellation", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    let resolveStream: ((value: MediaStream) => void) | undefined;
    let cancelled = false;
    const pendingStream = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });

    const result = acquireMediaStream(() => pendingStream, () => cancelled);
    cancelled = true;
    resolveStream?.(stream);

    await expect(result).resolves.toBeNull();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("clears the video stream during cleanup", () => {
    const video = { srcObject: {} } as HTMLVideoElement;

    clearVideoStream(video);

    expect(video.srcObject).toBeNull();
  });

  it("shows the identity of the matched member", () => {
    const html = renderToStaticMarkup(
      createElement(ResultPanel, {
        message: null,
        status: "done",
        result: {
          decision: "allowed",
          decisionReason: "Active subscription verified.",
          accessAllowed: true,
          similarity: 0.93,
          member: {
            gymMemberId: "member-1",
            fullName: "Ana Martinez",
            memberCode: "M-001",
          },
        },
      }),
    );

    expect(html).toContain("Miembro identificado");
    expect(html).toContain("Ana Martinez");
    expect(html).toContain("M-001");
  });
});
