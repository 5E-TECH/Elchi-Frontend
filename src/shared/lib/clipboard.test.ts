import { afterEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./clipboard";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

const setClipboard = (value: unknown) =>
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });

describe("copyToClipboard", () => {
  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  });

  it("reports success only after the browser accepted the text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await expect(copyToClipboard("1251175")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("1251175");
  });

  it("reports failure when the browser rejects the write (permission denied, page not focused)", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) });

    await expect(copyToClipboard("1251175")).resolves.toBe(false);
  });

  it("reports failure when the Clipboard API is missing (http, in-app webviews)", async () => {
    setClipboard(undefined);

    await expect(copyToClipboard("1251175")).resolves.toBe(false);
  });
});
