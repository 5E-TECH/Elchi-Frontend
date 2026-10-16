import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import { SelectSection } from "./SelectSection";

/** «Tanlash ro'yxatlari» (`?section=select`): maket `tizim-states-forms` 03 holatlari, ikkala mavzuda. */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const renderSection = () => renderWithProviders(<SelectSection />, { route: "/ops/ui-kit?section=select" });

describe("SelectSection", () => {
  it("langar, sarlavha va kunduzgi/tungi panel", () => {
    renderSection();
    expect(document.querySelector('[data-kit-section="select"]')).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Tanlash ro'yxatlari" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-kit-theme]")).toHaveLength(2);
  });

  it("maketdagi holatlar: yopiq, ochiq, qidiruv, topilmadi, yuklanmoqda, ko'p tanlov", () => {
    renderSection();
    const light = document.querySelector<HTMLElement>('[data-kit-theme="light"]')!;
    const panel = within(light);
    // Yopiq holat
    expect(panel.getAllByRole("combobox", { name: "Viloyat" })[0]).toHaveTextContent("Viloyat tanlang");
    expect(panel.getByText("Tumanni tanlang")).toBeInTheDocument();
    expect(panel.getAllByRole("combobox", { name: "Tuman" })[1]).toBeDisabled();
    expect(panel.getByText("Viloyat tanlangach ochiladi")).toBeInTheDocument();
    // Ochiq holat: tanlangan variant, qidiruv (mos qism qalin), topilmadi, yuklanmoqda
    expect(panel.getByRole("option", { name: "Toshkent sh.", selected: true })).toBeInTheDocument();
    expect(panel.getByRole("listbox", { name: "Marketlar" })).toBeInTheDocument();
    const searchList = panel.getByRole("listbox", { name: "Marketlar" });
    const found = within(searchList).getAllByRole("option");
    expect(found.map((option) => option.textContent)).toEqual(["Baraka Shop", "Barhayot Market", "Anbar Savdo"]);
    expect(found[2].querySelector("strong")).toHaveTextContent("bar");
    expect(panel.getByText("«Zarafshon» bo'yicha market yo'q")).toBeInTheDocument();
    expect(panel.getAllByText("Yuklanmoqda...").length).toBeGreaterThan(0);
    // Ko'p tanlov
    expect(panel.getAllByText("+1").length).toBeGreaterThan(0);
    expect(panel.getAllByRole("button", { name: "Yangi holatini olib tashlash" }).length).toBeGreaterThan(0);
    expect(panel.getByRole("listbox", { name: "Holat" })).toHaveAttribute("aria-multiselectable", "true");
    expect(panel.getByText("2 ta tanlangan")).toBeInTheDocument();
    // Yopiq + yuklanmoqda (`tizim-loading` 9): chevron o'rnida spinner, maydon bosiladi
    const loadingTrigger = panel
      .getAllByRole("combobox", { name: "Tuman", expanded: false })
      .find((combobox) => combobox.getAttribute("aria-busy") === "true")!;
    expect(loadingTrigger).toBeEnabled();
    expect(loadingTrigger).toHaveTextContent("Tumanlar yuklanmoqda…");
    expect(loadingTrigger.closest("[data-select]")!.querySelector("[data-select-loading]")).not.toBeNull();
    // Qidiruvli maydon namunasi bo'sh emas
    expect(panel.getAllByPlaceholderText("Marketni tanlang").length).toBeGreaterThan(0);
  });

  it("namunalar ishlaydi: oddiy ro'yxatni ochib tanlash", async () => {
    const user = userEvent.setup();
    renderSection();
    const light = within(document.querySelector<HTMLElement>('[data-kit-theme="light"]')!);
    const region = light.getAllByRole("combobox", { name: "Viloyat" })[0];
    await user.click(region);
    await user.click(within(region.closest<HTMLElement>("[data-select-root]")!).getByRole("option", { name: "Samarqand" }));
    expect(region).toHaveTextContent("Samarqand");
  });
});
