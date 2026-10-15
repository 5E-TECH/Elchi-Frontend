import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import en from "../../../locales/en/ui.json";
import ru from "../../../locales/ru/ui.json";
import uz from "../../../locales/uz/ui.json";
import { ButtonsSection } from "./ButtonsSection";

/** «Tugmalar» bo'limi: ikkala panelda barcha turlar, matnlar locale'dan, uz/ru/en kalitlari bir xil. */

const keysOf = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key))
    : [prefix];

describe("ButtonsSection", () => {
  it("kunduzgi va tungi panelda har tur, o'lcham va ikonka tugma bor", () => {
    renderWithProviders(<ButtonsSection />, { route: "/ops/ui-kit?section=buttons" });
    const panels = document.querySelectorAll<HTMLElement>("[data-kit-theme]");
    expect(panels).toHaveLength(2);
    for (const panel of panels) {
      for (const variant of ["primary", "secondary", "ghost", "link", "success", "danger", "danger-soft"]) {
        for (const size of ["sm", "md", "lg"]) {
          expect(panel.querySelector(`button[data-variant="${variant}"][data-size="${size}"]`)).not.toBeNull();
        }
      }
      for (const variant of ["ghost", "secondary", "primary", "danger"]) {
        expect(panel.querySelector(`button[aria-label][data-variant="${variant}"]`)).not.toBeNull();
      }
      // yuklanish maketdagidek: aria-busy + aria-disabled, `disabled` emas (fokus saqlanadi)
      const busy = panel.querySelectorAll('button[aria-busy="true"]');
      expect(busy.length).toBeGreaterThan(0);
      for (const button of busy) {
        expect(button).toHaveAttribute("aria-disabled", "true");
        expect(button).toBeEnabled();
      }
      expect(panel.querySelectorAll("button:disabled:not([aria-busy])").length).toBeGreaterThan(0);
      expect(within(panel).getAllByRole("link").length).toBeGreaterThan(0);
      // tarjima topilmasa i18next kalitni qaytaradi
      expect(panel.textContent).not.toMatch(/button\.(samples|variants|groups|notes|states|sizes)\./);
    }
    expect(screen.getAllByRole("button", { name: "Yangilash" }).length).toBeGreaterThan(0);
    // ikonka tugmaning yuklanish nomi maketdan
    expect(screen.getAllByRole("button", { name: "Yangilanmoqda" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Chek tayyorlanmoqda" })).toHaveLength(2);
    // ixcham juftlik (maket `superadmin-orders-list`)
    const create = screen.getAllByRole("button", { name: "Buyurtma yaratish" });
    expect(create).toHaveLength(2);
    expect(create[0].className.split(" ")).toEqual(expect.arrayContaining(["px-3", "gap-1.5"]));
  });

  it("uz/ru/en da `button` kalitlari bir xil", () => {
    const uzKeys = keysOf(uz.button).sort();
    expect(uzKeys.length).toBeGreaterThan(20);
    expect(keysOf(ru.button).sort()).toEqual(uzKeys);
    expect(keysOf(en.button).sort()).toEqual(uzKeys);
  });
});
