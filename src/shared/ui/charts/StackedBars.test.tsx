import { createEvent, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { StackedBars, type StackedBarsColumn, type StackedBarsSeries } from ".";
import { niceCeiling } from "./StackedBars";

/**
 * IN-1: `StackedBars` — steklangan ustunlar (maket `investor-dashboard-home`, «Oylik foyda»).
 * Balandlik yaxlit shiftga (1 · 2 · 5 × 10ⁿ) nisbatan, nol ustun chizilmaydi, seriya tartibi pastdan tepaga,
 * yig'indilar va siyrak telefon yorliqlari, ko'rsatkich tooltip'i.
 */

const SERIES: StackedBarsSeries[] = [
  { key: "paid", label: "To'langan", tone: "success" },
  { key: "unpaid", label: "Kutilmoqda", tone: "warning" },
];

const month = (key: string, paid: number, unpaid: number, extra: Partial<StackedBarsColumn> = {}): StackedBarsColumn => ({
  key,
  label: key,
  values: { paid, unpaid },
  ...extra,
});

const COLUMNS = [
  month("Iyl", 4_900_000, 0),
  month("Avg", 5_600_000, 0),
  month("Sen", 0, 6_200_000, { title: "Sentabr 2026" }),
  month("Okt", 0, 0, { current: true }),
];

const stack = (key: string) => document.querySelector<HTMLElement>(`[data-stack="${key}"]`);

describe("StackedBars", () => {
  it("role=img + aria-label; balandlik yaxlit shiftga nisbatan (6,2 mln → 10 mln, maket); nol ustun chizilmaydi", () => {
    renderWithProviders(<StackedBars series={SERIES} columns={COLUMNS} ariaLabel="Oylik foyda" />);
    expect(screen.getByRole("img", { name: "Oylik foyda" })).toBeInTheDocument();
    expect(Number.parseFloat(stack("Sen")?.style.height ?? "")).toBeCloseTo(62, 3);
    expect(Number.parseFloat(stack("Avg")?.style.height ?? "")).toBeCloseTo(56, 3);
    expect(Number.parseFloat(stack("Iyl")?.style.height ?? "")).toBeCloseTo(49, 3);
    expect(stack("Okt")).toBeNull();
  });

  it("niceCeiling: 1 · 2 · 5 × 10ⁿ, aniq qiymat o'zi qoladi; 0 / NaN — 0", () => {
    expect(niceCeiling(6_200_000)).toBe(10_000_000);
    expect(niceCeiling(1_200_000)).toBe(2_000_000);
    expect(niceCeiling(3)).toBe(5);
    expect(niceCeiling(5)).toBe(5);
    expect(niceCeiling(100)).toBe(100);
    expect(niceCeiling(0.3)).toBeCloseTo(0.5, 9);
    expect(niceCeiling(0)).toBe(0);
    expect(niceCeiling(Number.NaN)).toBe(0);
  });

  it("faqat qiymati bor seriya bo'lagi chiziladi, tartib pastdan tepaga, tonlar tokenlardan", () => {
    renderWithProviders(
      <StackedBars series={SERIES} columns={[month("Mix", 3, 1), ...COLUMNS]} ariaLabel="Oylik foyda" />,
    );
    const parts = Array.from(stack("Mix")!.querySelectorAll("[data-stack-part]"));
    expect(parts.map((part) => part.getAttribute("data-stack-part"))).toEqual(["paid", "unpaid"]);
    expect(parts[0]).toHaveClass("bg-success");
    expect(parts[1]).toHaveClass("bg-warning", "rounded-t-[4px]");
    expect((parts[0] as HTMLElement).style.flex).toMatch(/^3 1 0/);
    expect(stack("Sen")!.querySelectorAll("[data-stack-part]")).toHaveLength(1);
  });

  it("yig'indi ustun ustida — ixcham, valyutasiz; nol oy «0»", () => {
    renderWithProviders(<StackedBars series={SERIES} columns={COLUMNS} ariaLabel="Oylik foyda" />);
    const totals = Array.from(document.querySelectorAll("[data-stack-total]")).map((el) => el.textContent);
    expect(totals).toEqual(["4,9 mln", "5,6 mln", "6,2 mln", "0"]);
  });

  it("formatTotal / showTotals: o'z formati, 24 ustunda sukut bo'yicha yig'indilar yo'q", () => {
    const { unmount } = renderWithProviders(
      <StackedBars series={SERIES} columns={COLUMNS} ariaLabel="a" formatTotal={(total) => `${total / 1_000_000}`} />,
    );
    expect(document.querySelector("[data-stack-total]")).toHaveTextContent("4.9");
    unmount();

    const many = Array.from({ length: 24 }, (_, index) => month(`m${index}`, index, 0));
    renderWithProviders(<StackedBars series={SERIES} columns={many} ariaLabel="b" />);
    expect(document.querySelector("[data-stack-total]")).toBeNull();
  });

  it("o'q yorliqlari: joriy qalin; telefonda oxirgisidan orqaga har 3-si (12 ustun)", () => {
    const twelve = Array.from({ length: 12 }, (_, index) => month(`m${index}`, 1, 0, { current: index === 11 }));
    renderWithProviders(<StackedBars series={SERIES} columns={twelve} ariaLabel="a" />);
    const labels = Array.from(document.querySelectorAll("[data-axis-label]"));
    expect(labels[11]).toHaveClass("font-semibold", "text-text");
    const phoneVisible = labels.filter((label) => !label.classList.contains("max-md:invisible"));
    expect(phoneVisible.map((label) => label.textContent)).toEqual(["m2", "m5", "m8", "m11"]);
    expect(labels.some((label) => label.classList.contains("md:invisible"))).toBe(false);
  });

  it("sichqoncha ustunga kelganda tooltip: sarlavha va har seriya to'liq summasi; chiqqanda yopiladi", () => {
    renderWithProviders(<StackedBars series={SERIES} columns={COLUMNS} ariaLabel="Oylik foyda" />);
    const column = document.querySelector('[data-stack-col="Sen"]')!;
    fireEvent.pointerEnter(column);
    const tip = document.querySelector("[data-stacked-tip]");
    expect(tip).toHaveTextContent("Sentabr 2026");
    expect(tip).toHaveTextContent("0 so'mTo'langan");
    expect(tip).toHaveTextContent("6 200 000 so'mKutilmoqda");
    expect(column).toHaveAttribute("data-hover");

    fireEvent.pointerLeave(screen.getByRole("img", { name: "Oylik foyda" }));
    expect(document.querySelector("[data-stacked-tip]")).toBeNull();
  });

  it("teginish (planshet): bosish tooltip'ni ochadi, barmoq ko'tarilganda yopilmaydi; qayta bosish yopadi", () => {
    renderWithProviders(<StackedBars series={SERIES} columns={COLUMNS} ariaLabel="Oylik foyda" />);
    const plot = screen.getByRole("img", { name: "Oylik foyda" });
    const column = document.querySelector('[data-stack-col="Sen"]')!;
    const avg = document.querySelector('[data-stack-col="Avg"]')!;
    // jsdom'da `PointerEvent` yo'q — `pointerType` qo'lda.
    const touch = (event: Event) => {
      Object.defineProperty(event, "pointerType", { value: "touch" });
      return event;
    };
    fireEvent(column, touch(createEvent.pointerOver(column)));
    fireEvent(column, touch(createEvent.pointerDown(column)));
    fireEvent(column, touch(createEvent.pointerUp(column)));
    fireEvent(column, touch(createEvent.pointerOut(column, { relatedTarget: document.body })));
    expect(document.querySelector("[data-stacked-tip]")).toHaveTextContent("Sentabr 2026");

    fireEvent(avg, touch(createEvent.pointerDown(avg)));
    expect(document.querySelector("[data-stacked-tip]")).toHaveTextContent("5 600 000 so'm");
    fireEvent(avg, touch(createEvent.pointerDown(avg)));
    expect(document.querySelector("[data-stacked-tip]")).toBeNull();
    expect(plot).toBeInTheDocument();
  });

  it("hammasi nol — ustunlar yo'q, yiqilmaydi", () => {
    renderWithProviders(<StackedBars series={SERIES} columns={[month("a", 0, 0), month("b", -5, Number.NaN)]} ariaLabel="a" />);
    expect(document.querySelectorAll("[data-stack]")).toHaveLength(0);
  });
});
