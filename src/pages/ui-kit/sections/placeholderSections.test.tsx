import { screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { DateSection } from "./DateSection";

/**
 * 3-bosqich bo'limlari (select, date, feedback, states; dialog — `DialogSection.test.tsx`): bo'lim, sarlavha va ikki panel bor.
 * Quruvchilar namunalarni qo'shganda shu test o'z bo'lim testi bilan almashtiriladi.
 */
describe.each<[string, ComponentType, string]>([
  ["date", DateSection, "Sana oralig'i"],
])("%s bo'limi", (id, Section, title) => {
  it("langar, sarlavha va kunduzgi/tungi panel", () => {
    renderWithProviders(<Section />, { route: `/ops/ui-kit?section=${id}` });
    expect(document.querySelector(`[data-kit-section="${id}"]`)).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-kit-theme]")).toHaveLength(2);
  });
});
