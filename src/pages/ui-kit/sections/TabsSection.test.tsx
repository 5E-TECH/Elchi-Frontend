import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import en from "../../../locales/en/ui.json";
import ru from "../../../locales/ru/ui.json";
import uz from "../../../locales/uz/ui.json";
import { TabsSection } from "./TabsSection";

/**
 * «Tablar va segmentlar» bo'limi: ikki panelda id takrorlanmaydi, panel tanlangan
 * tabga bog'langan, havola tablar `?kit-tab=` bo'yicha, uz matnlar maketdagidek,
 * uz/ru/en kalitlari bir xil.
 */

const keysOf = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key))
    : [prefix];

const panels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-kit-theme]"));

describe("TabsSection", () => {
  it("ikki panel; sahifada id lar takrorlanmaydi (tab/panel bog'lanishi buzilmasin)", () => {
    renderWithProviders(<TabsSection />, { route: "/ops/ui-kit?section=tabs" });
    expect(panels()).toHaveLength(2);
    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("holat tablari: maketdagi nomlar va sonlar, panel tanlangan tab nomi bilan", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TabsSection />, { route: "/ops/ui-kit?section=tabs" });
    const light = within(panels()[0]);
    const list = light.getByRole("tablist", { name: "Holat bo'yicha" });
    expect(within(list).getAllByRole("tab").map((el) => el.textContent)).toEqual([
      "Barchasi 1 248",
      "Yangi 32",
      "Qabul qilindi 120",
      "Yo'lda 86",
      "Kutilmoqda 14",
      "Sotilgan 734",
      "To'langan 168",
      "Bekor qilingan 94",
    ]);
    expect(light.getByRole("tabpanel", { name: "Barchasi 1 248" })).toHaveTextContent("Jami 1 248 ta buyurtma");

    await user.click(within(list).getByRole("tab", { name: "Yangi 32" }));
    const panel = light.getByRole("tabpanel", { name: "Yangi 32" });
    expect(panel).toHaveTextContent("Jami 32 ta buyurtma");
    expect(within(list).getByRole("tab", { name: "Yangi 32" })).toHaveAttribute("aria-controls", panel.id);
    // Ikki panel bitta holatni bo'lishadi.
    expect(within(panels()[1]).getByRole("tab", { name: "Yangi 32" })).toHaveAttribute("aria-selected", "true");
  });

  it("o'chirilgan tab (Marketplace) tanlanmaydi", () => {
    renderWithProviders(<TabsSection />, { route: "/ops/ui-kit?section=tabs&theme-pair=0" });
    expect(screen.getByRole("tab", { name: "Marketplace 2" })).toBeDisabled();
  });

  it("havola tablar: nav + aria-current, `?kit-tab=` bo'yicha; boshqa parametrlar saqlanadi", () => {
    renderWithProviders(<TabsSection />, { route: "/ops/ui-kit?section=tabs&theme-pair=0&kit-tab=analysis" });
    const nav = screen.getByRole("navigation", { name: "Balans bo'limlari" });
    expect(within(nav).getByRole("link", { name: "Tahlil" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Tarix" })).not.toHaveAttribute("aria-current");
    const href = within(nav).getByRole("link", { name: "Tarix" }).getAttribute("href") ?? "";
    const params = new URLSearchParams(href.slice(href.indexOf("?")));
    expect(Object.fromEntries(params)).toEqual({ section: "tabs", "theme-pair": "0", "kit-tab": "history" });
  });

  it("segmentlar: radiogroup, maketdagi matnlar (Davr, Kunni yakunlash)", () => {
    renderWithProviders(<TabsSection />, { route: "/ops/ui-kit?section=tabs&theme-pair=0" });
    const period = screen.getAllByRole("radiogroup", { name: "Davr" })[0];
    expect(within(period).getAllByRole("radio").map((el) => el.textContent)).toEqual([
      "Bugun",
      "Bu hafta",
      "Bu oy",
      "Barchasi",
    ]);
    const dayClose = screen.getByRole("radiogroup", { name: "№10238 natijasi" });
    expect(within(dayClose).getAllByRole("radio").map((el) => el.textContent)).toEqual(["Sotildi", "Bekor", "Ertaga"]);
    expect(within(dayClose).getByRole("radio", { name: "Bekor" })).toHaveAttribute("aria-checked", "true");
  });

  it("uz/ru/en: tabs.* kalitlari bir xil", () => {
    const uzKeys = keysOf(uz.tabs).sort();
    expect(keysOf(ru.tabs).sort()).toEqual(uzKeys);
    expect(keysOf(en.tabs).sort()).toEqual(uzKeys);
  });
});
