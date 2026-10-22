import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { ChartsSection } from "./ChartsSection";

/** «Grafiklar» namunasi (IN-1): `StackedBars` kunduzgi va tungi panelda, maket qiymatlari bilan. */
describe("ChartsSection", () => {
  it("langar, sarlavha va ikki panelda steklangan ustunlar + legenda", () => {
    renderWithProviders(<ChartsSection />, { route: "/ops/ui-kit?section=charts" });
    expect(document.querySelector('[data-kit-section="charts"]')).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Grafiklar" })).toBeInTheDocument();

    const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-kit-theme]"));
    expect(panels).toHaveLength(2);
    for (const panel of panels) {
      const scope = within(panel);
      expect(scope.getByRole("img", { name: /Oylik foyda, mart – oktabr 2026/ })).toBeInTheDocument();
      expect(scope.getByText("To'langan")).toBeInTheDocument();
      expect(scope.getByText("Kutilmoqda")).toBeInTheDocument();
      // 7 oy foydali, oktabr — joriy va bo'sh (ustun yo'q).
      expect(panel.querySelectorAll("[data-stack]")).toHaveLength(7);
      expect(panel.querySelector('[data-axis-label="m7"]')).toHaveTextContent("Okt");
    }
  });
});
