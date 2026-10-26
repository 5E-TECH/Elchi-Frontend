import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatDocumentTitle, useDocumentTitle, usePageTitle } from "./documentTitle";

/**
 * WuVeVZqo — brauzer sarlavhasi sahifaga qarab: «Buyurtmalar — Elchi Pochta»; sahifa yopilsa — ilova sukuti;
 * joriy nom shell e'loni uchun (`usePageTitle`).
 */
describe("useDocumentTitle", () => {
  it("«<sahifa> — Elchi Pochta» formatida yozadi va nomni shell'ga beradi", () => {
    const page = renderHook(() => usePageTitle());
    const { rerender, unmount } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: "Buyurtmalar" as string | null },
    });

    expect(document.title).toBe("Buyurtmalar — Elchi Pochta");
    expect(page.result.current).toBe("Buyurtmalar");

    rerender({ title: "  To'lovlar  " });
    expect(document.title).toBe("To'lovlar — Elchi Pochta");
    expect(page.result.current).toBe("To'lovlar");

    act(() => unmount());
    expect(document.title).not.toContain("To'lovlar");
    expect(page.result.current).toBeNull();
  });

  it("bo'sh yoki matnsiz nom (yuklanish skeleti) — sarlavhaga tegmaydi", () => {
    document.title = "Elchi Pochta — Logistika va Kuryer Xizmati";
    renderHook(() => useDocumentTitle(null));
    renderHook(() => useDocumentTitle("   "));
    expect(document.title).toBe("Elchi Pochta — Logistika va Kuryer Xizmati");
  });

  it("formatDocumentTitle", () => {
    expect(formatDocumentTitle("№10305")).toBe("№10305 — Elchi Pochta");
  });
});
