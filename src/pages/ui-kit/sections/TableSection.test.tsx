import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { TableSection } from "./TableSection";

/**
 * «Jadval va sahifalash» namunasi: ikki panel (kunduzgi + tungi), maketdagi ustunlar va sahifalar,
 * saralash va tanlov ikkala panelda bir xil holatda.
 */

const panels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-kit-theme]"));

describe("TableSection", () => {
  it("ikki panelda jadval: ustunlar, «Bekor — jo'natilgan» tanlab bo'lmaydi, pastda sahifalar", () => {
    renderWithProviders(<TableSection />, { route: "/ops/ui-kit?section=table" });
    expect(panels()).toHaveLength(2);

    for (const panel of panels()) {
      const scope = within(panel);
      const table = scope.getByRole("table", { name: "Buyurtmalar namunasi" });
      expect(within(table).getAllByRole("columnheader")).toHaveLength(7);
      expect(scope.getByRole("columnheader", { name: "Buyurtma" })).toHaveAttribute("aria-sort", "descending");
      expect(scope.getByRole("checkbox", { name: "№10231 allaqachon jo'natilgan, tanlab bo'lmaydi" })).toBeDisabled();
      expect(scope.getByText("1–10 / 1 248 ta buyurtma")).toBeInTheDocument();
      expect(
        within(scope.getByRole("navigation", { name: "Sahifalar" })).getAllByRole("button").map((button) => button.textContent),
      ).toEqual(["", "1", "2", "3", "125", ""]);
    }
  });

  it("saralash va tanlov ikkala panelda birga o'zgaradi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TableSection />, { route: "/ops/ui-kit?section=table" });
    const [light, dark] = panels();

    await user.click(within(light).getByRole("button", { name: "Summa" }));
    expect(within(dark).getByRole("columnheader", { name: "Summa" })).toHaveAttribute("aria-sort", "ascending");

    await user.click(within(light).getByRole("checkbox", { name: "№10242 ni tanlash" }));
    expect(within(dark).getByRole("checkbox", { name: "№10242 ni tanlash" })).toBeChecked();

    await user.click(within(light).getByRole("button", { name: "125" }));
    expect(within(dark).getByRole("button", { name: "125" })).toHaveAttribute("aria-current", "page");
  });

  it("ochiladigan qator namunasi: chevron, ochilgan panel, tafsiloti yo'q qatorda chevron yo'q; ikkala panelda birga", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TableSection />, { route: "/ops/ui-kit?section=table" });
    const [light, dark] = panels();

    const table = within(light).getByRole("table", { name: "Jurnal namunasi" });
    expect(within(table).getByRole("button", { name: "Buyurtma №10227 tafsilotini yopish" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(within(table).getByText("Maydon o'zgarishlari")).toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: /Foydalanuvchi #61/ })).toBeNull();

    await user.click(within(light).getByRole("button", { name: "Buyurtma №10244 tafsilotini ochish" }));
    expect(within(dark).getByRole("button", { name: "Buyurtma №10244 tafsilotini yopish" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
