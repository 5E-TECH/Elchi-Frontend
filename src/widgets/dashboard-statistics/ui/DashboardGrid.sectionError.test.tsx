import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { CardRow, KpiRow } from "./DashboardGrid";

/**
 * QKCeGZ3N (2-band, taxta `tizim-errors` 02 «Bo'lim xatosi»): dashboard to'ridagi bitta karta yoki KPI yiqilsa —
 * faqat uning o'rnida «Bu bo'limni ochishda xatolik yuz berdi» + «Qayta urinish», qolganlari ishlayveradi.
 * Xatosiz holatda chegara DOM qo'shmaydi (to'r selektorlari `[&>*:last-child]` o'zgarmaydi).
 */
const crash = { current: true };
const BrokenChart = () => {
  if (crash.current) throw new TypeError("Cannot read properties of undefined (reading 'map')");
  return <article>Grafik tiklandi</article>;
};

describe("DashboardGrid — bo'lim xato chegarasi (QKCeGZ3N)", () => {
  beforeEach(() => {
    crash.current = true;
    window.sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("⭐ bitta karta yiqildi — qolganlari chiziladi, o'rnida «Bo'lim xatosi»; sahifa xato yozuvi saqlanmaydi", () => {
    renderWithProviders(
      <CardRow>
        <article>Reyting</article>
        <BrokenChart />
        <article>Kassa</article>
      </CardRow>,
    );

    expect(screen.getByText("Reyting")).toBeInTheDocument();
    expect(screen.getByText("Kassa")).toBeInTheDocument();
    expect(screen.getByText("Bu bo'limni ochishda xatolik yuz berdi")).toBeInTheDocument();
    expect(screen.getByText("Boshqa bo'limlar ishlashda davom etadi.")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("elchi_runtime_error")).toBeNull();
  });

  it("«Qayta urinish» — faqat shu karta qayta chiziladi", () => {
    renderWithProviders(
      <CardRow>
        <article>Reyting</article>
        <BrokenChart />
      </CardRow>,
    );

    crash.current = false;
    fireEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(screen.getByText("Grafik tiklandi")).toBeInTheDocument();
    expect(screen.queryByText("Bu bo'limni ochishda xatolik yuz berdi")).toBeNull();
  });

  it("xatosiz — bolalar to'rning to'g'ridan-to'g'ri bolasi (o'ram DOM yo'q), KPI qatori ham", () => {
    crash.current = false;
    const { container } = renderWithProviders(
      <KpiRow count={2} label="Ko'rsatkichlar">
        <article>KPI 1</article>
        <article>KPI 2</article>
      </KpiRow>,
    );
    const row = container.querySelector("section[aria-label=\"Ko'rsatkichlar\"]") as HTMLElement;
    expect(Array.from(row.children).map((node) => node.tagName)).toEqual(["ARTICLE", "ARTICLE"]);
  });
});
