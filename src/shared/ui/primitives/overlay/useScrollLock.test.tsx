import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useScrollLock } from "./useScrollLock";

/** Skroll qulfi: hisoblagichli, avvalgi inline uslub tiklanadi. */
describe("useScrollLock", () => {
  afterEach(() => {
    document.documentElement.style.overflow = "";
  });

  it("faol bo'lganda <html> overflow hidden; yechilganda avvalgisi qaytadi", () => {
    document.documentElement.style.overflow = "auto";
    const { rerender, unmount } = renderHook(({ active }) => useScrollLock(active), { initialProps: { active: true } });
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.documentElement).toHaveAttribute("data-scroll-locked");
    rerender({ active: false });
    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.documentElement).not.toHaveAttribute("data-scroll-locked");
    unmount();
  });

  it("ichma-ich: oxirgi qulf yechilgandagina ochiladi", () => {
    const first = renderHook(() => useScrollLock(true));
    const second = renderHook(() => useScrollLock(true));
    second.unmount();
    expect(document.documentElement.style.overflow).toBe("hidden");
    first.unmount();
    expect(document.documentElement.style.overflow).toBe("");
  });
});
