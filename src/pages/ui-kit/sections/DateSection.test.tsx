import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { DateSection } from "./DateSection";

/**
 * «Sana oralig'i» bo'limi: ikki panel (kunduzgi/tungi), id lar takrorlanmaydi, maketdagi uz matnlar
 * (`tizim-states-forms` 04), maydon holatlari, ochiq panel va bitta sana ishlaydi.
 */

const panels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-kit-theme]"));

describe("DateSection", () => {
  it("ikki panel; sarlavha; sahifada id lar takrorlanmaydi", () => {
    renderWithProviders(<DateSection />, { route: "/ops/ui-kit?section=date" });
    expect(document.querySelector('[data-kit-section="date"]')).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Sana oralig'i" })).toBeInTheDocument();
    expect(panels()).toHaveLength(2);
    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("maydon holatlari: bo'sh, tanlangan (×), dashboard, xato, o'chirilgan, bitta sana", () => {
    renderWithProviders(<DateSection />, { route: "/ops/ui-kit?section=date" });
    const light = within(panels()[0]);

    // Bo'sh va xato holatlar — ikkalasi bo'sh («Sana» + namuna matni).
    const empties = light.getAllByRole("button", { name: "Sana Sana oralig'ini tanlang" });
    expect(empties).toHaveLength(2);
    expect(empties[0]).toHaveTextContent("Sana oralig'ini tanlang");
    expect(empties[0]).not.toHaveAttribute("aria-invalid");
    const selected = light.getAllByRole("button", { name: "Sana 01.10.2026 dan 08.10.2026 gacha" });
    expect(selected[0]).toHaveTextContent("01.10 – 08.10.2026");
    expect(selected[0]).toBeEnabled();
    expect(selected[1]).toBeDisabled();
    expect(selected[1]).toHaveAccessibleDescription("Yopilgan kassada davr o'zgarmaydi");
    expect(light.getAllByRole("button", { name: "Sanalar oralig'ini tozalash" })).toHaveLength(1);

    expect(light.getByRole("button", { name: "Sana oralig'ini tanlash: Boshlanish → Tugash" })).toBeInTheDocument();

    const invalid = empties[1];
    expect(invalid).toHaveAttribute("aria-invalid", "true");
    // Tavsif: xato matni + «majburiy» (`button` rolida `aria-required` yo'q).
    expect(invalid).toHaveAccessibleDescription("Sana oralig'ini tanlang majburiy");
    expect(invalid).not.toHaveAttribute("aria-required");

    expect(light.getByRole("button", { name: "Oxirgi buyurtma — dan 01.07.2026" })).toBeInTheDocument();
  });

  it("ochiq panel: «Bu oy» bosilgan, pastda «01.10.2026 – 08.10.2026 · 8 kun», belgilar; tanlov ikki panelda", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DateSection />, { route: "/ops/ui-kit?section=date" });
    const panel = within(panels()[0]).getByRole("group", { name: "Sana oralig'ini tanlash" });

    expect(within(panel).getByRole("button", { name: "Bu oy" })).toHaveAttribute("aria-pressed", "true");
    expect(panel).toHaveTextContent("01.10.2026 – 08.10.2026 · 8 kun");
    expect(within(panel).getByRole("gridcell", { name: "8-oktabr, bugun, tugash" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(panels()[0]).getByText("bugun — ko'k chiziqli")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Bugun" }));
    for (const theme of panels()) {
      expect(within(theme).getByRole("group", { name: "Sana oralig'ini tanlash" })).toHaveTextContent(
        "08.10.2026 · 1 kun",
      );
    }
  });

  it("bitta sana kalendari: kun bosilsa tanlanadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DateSection />, { route: "/ops/ui-kit?section=date" });
    const single = within(within(panels()[0]).getByRole("group", { name: "Sanani tanlash" }));
    await user.click(single.getByRole("gridcell", { name: "15-oktabr" }));
    expect(single.getByRole("gridcell", { name: "15-oktabr" })).toHaveAttribute("aria-selected", "true");
  });
});
