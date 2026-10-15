import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { CardsSection } from "./CardsSection";

/**
 * «Kartalar» namunasi: ikkala panelda bir xil tarkib, ko'rsatkich qiymati maketdagidek
 * (`48,6` + `mln so'm`), ichki karta ogohlantirishsiz, bosiladigan karta — havola.
 */

const panels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-kit-theme]"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CardsSection", () => {
  it("ikki panel (kunduzgi + tungi), har birida karta sarlavhalari h4 va maket matni", () => {
    renderWithProviders(<CardsSection />, { route: "/ops/ui-kit?section=cards" });
    expect(panels()).toHaveLength(2);
    for (const panel of panels()) {
      const scope = within(panel);
      for (const name of ["Manzil", "To'lov", "Hududlar bo'yicha", "Buyurtmalar holati"]) {
        expect(scope.getByRole("heading", { level: 4, name })).toBeInTheDocument();
      }
      expect(scope.getByText("Viloyatlar kesimida buyurtma va sotuv · bugun")).toBeInTheDocument();
    }
  });

  it("ko'rsatkich: katta raqam va kichik birlik alohida (maket `.el-kpi-value` / `.el-kpi-unit`)", () => {
    renderWithProviders(<CardsSection />, { route: "/ops/ui-kit?section=cards" });
    const [light] = panels();
    const values = Array.from(light.querySelectorAll("[data-stat-value]"));
    const revenue = values.find((el) => el.textContent?.startsWith("48,6"));
    expect(revenue?.firstChild?.textContent).toBe("48,6");
    expect(revenue?.lastElementChild).toHaveTextContent(/^mln so'm$/);
    // «mln» katta raqamga yopishmagan.
    expect(values.some((el) => el.firstChild?.textContent?.includes("mln"))).toBe(false);
  });

  it("goodWhen=down ikkala yo'nalishda: kamayish — yaxshi, o'sish — yomon", () => {
    renderWithProviders(<CardsSection />, { route: "/ops/ui-kit?section=cards" });
    const [light] = panels();
    const qualities = Array.from(light.querySelectorAll("[data-stat-delta]")).map((el) => [
      el.textContent,
      el.getAttribute("data-quality"),
    ]);
    expect(qualities).toEqual([
      ["+6,4%", "good"],
      ["−10,7%", "good"],
      ["+12,5%", "bad"],
    ]);
  });

  it("yuklanayotgan karta aria-busy, bosiladigan karta — havola; ichki karta ogohlantirishsiz", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderWithProviders(<CardsSection />, { route: "/ops/ui-kit?section=cards" });
    const [light] = panels();
    expect(light.querySelectorAll("[aria-busy=true]")).toHaveLength(1);
    expect(within(light).getByRole("link", { name: /Bekor qilingan/ })).toHaveAttribute(
      "href",
      "/ops/ui-kit?section=cards",
    );
    expect(light.querySelector("[data-card-variant=inset]")).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Manzilni tahrirlash" })).toHaveLength(2);
  });
});
