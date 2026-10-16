import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { StatesSection } from "./StatesSection";

/** «Yuklanish, bo'sh va xato holatlari» (`?section=states`): `tizim-errors`, `tizim-loading`, `tizim-charts` namunalari. */

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const lightPanel = () => document.querySelector<HTMLElement>('[data-kit-theme="light"]')!;

describe("StatesSection", () => {
  it("langar, sarlavha, ikki panel; bo'sh, xato, grafik, sahifa va skelet namunalari", () => {
    renderWithProviders(<StatesSection />, { route: "/ops/ui-kit?section=states" });
    expect(document.querySelector('[data-kit-section="states"]')).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Yuklanish, bo'sh va xato holatlari" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-kit-theme]")).toHaveLength(2);

    const panel = within(lightPanel());
    expect(panel.getByText("Hali buyurtma yo'q")).toBeInTheDocument();
    expect(panel.getByText("Bu filtrlar bo'yicha buyurtma topilmadi")).toBeInTheDocument();
    expect(panel.getByText("Server xatosi (500). Birozdan keyin qayta urinib ko'ring.")).toBeInTheDocument();
    expect(panel.getAllByText("Internet aloqasi yo'q").length).toBeGreaterThan(0);
    expect(panel.getByText("Bu ma'lumotni ko'rishga ruxsatingiz yo'q")).toBeInTheDocument();
    expect(panel.getByText("Bu bo'limni ochishda xatolik yuz berdi")).toBeInTheDocument();
    expect(panel.getByText("Bu davrda buyurtma yo'q")).toBeInTheDocument();
    expect(panel.getByRole("heading", { level: 4, name: "Bu sahifa topilmadi" })).toBeInTheDocument();
    expect(lightPanel().querySelector("[data-skeleton-preset='table']")).toHaveTextContent("BuyurtmaMijoz");
    expect(lightPanel().querySelector("[data-skeleton-preset='chart']")).not.toBeNull();
  });

  it("jonli QueryBoundary: sekin javob — 400 ms dan keyin skelet, so'ng ro'yxat; xato — «Qayta urinish»", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<StatesSection />, { route: "/ops/ui-kit?section=states" });
    const panel = within(lightPanel());
    const boundary = () => lightPanel().querySelectorAll("[data-query-state]")[0];

    expect(boundary()).toHaveAttribute("data-query-state", "ready");
    await user.click(panel.getByRole("button", { name: "Sekin javob" }));
    expect(boundary()).toHaveAttribute("data-query-state", "loading");
    expect(boundary().querySelector("[data-skeleton-visible]")).toBeNull();
    act(() => vi.advanceTimersByTime(400));
    expect(boundary().querySelector("[data-skeleton-visible]")).not.toBeNull();
    act(() => vi.advanceTimersByTime(2500));
    expect(boundary()).toHaveAttribute("data-query-state", "ready");

    await user.click(panel.getByRole("button", { name: "Xato" }));
    act(() => vi.advanceTimersByTime(1200));
    expect(boundary()).toHaveAttribute("data-query-state", "error");
    expect(within(boundary() as HTMLElement).getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
  });
});
