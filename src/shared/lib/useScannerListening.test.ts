import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isScannerListening, useScannerListening } from "./useScannerListening";

const append = <T extends HTMLElement>(element: T, attributes: Record<string, string> = {}) => {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
};

describe("isScannerListening", () => {
  const field = () => document.querySelector<HTMLInputElement>("#scan");

  beforeEach(() => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    append(document.createElement("input"), { id: "scan" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("fokus skan maydonida yoki hech qayerda emas — tinglaydi", () => {
    expect(isScannerListening(field())).toBe(true);
    field()?.focus();
    expect(isScannerListening(field())).toBe(true);
  });

  it("fokus tugmada — tinglaydi; begona matn maydonida — yo'q", () => {
    const button = append(document.createElement("button"));
    button.focus();
    expect(isScannerListening(field())).toBe(true);

    append(document.createElement("textarea")).focus();
    expect(isScannerListening(field())).toBe(false);
  });

  it("`data-scanner-ignore` maydoni — tinglamaydi", () => {
    const form = append(document.createElement("form"), { "data-scanner-ignore": "" });
    const button = document.createElement("button");
    form.append(button);
    button.focus();
    expect(isScannerListening(field())).toBe(false);
  });

  it("modal oyna ochiq — yo'q; kamera oynasi to'smaydi", () => {
    const camera = append(document.createElement("div"), { "data-scanner-camera": "" });
    const cameraDialog = document.createElement("div");
    cameraDialog.setAttribute("aria-modal", "true");
    camera.append(cameraDialog);
    expect(isScannerListening(field())).toBe(true);

    append(document.createElement("div"), { role: "dialog", "aria-modal": "true" });
    expect(isScannerListening(field())).toBe(false);
  });

  it("brauzer oynasi faol emas — tinglamaydi", () => {
    vi.mocked(document.hasFocus).mockReturnValue(false);
    expect(isScannerListening(field())).toBe(false);
  });
});

describe("useScannerListening", () => {
  beforeEach(() => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("modal ochilsa-yopilsa, oyna fokusi o'zgarsa darhol yangilanadi", async () => {
    const { result } = renderHook(() => useScannerListening({ current: null }));
    expect(result.current).toBe(true);

    const modal = append(document.createElement("div"), { "aria-modal": "true" });
    await waitFor(() => expect(result.current).toBe(false));
    modal.remove();
    await waitFor(() => expect(result.current).toBe(true));

    vi.mocked(document.hasFocus).mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(result.current).toBe(false);
  });

  it("begona maydon fokusi olinsa — yo'q, chiqsa — ha", () => {
    const { result } = renderHook(() => useScannerListening({ current: null }));
    const input = append(document.createElement("input"));

    act(() => input.focus());
    expect(result.current).toBe(false);

    act(() => input.blur());
    expect(result.current).toBe(true);
  });
});
