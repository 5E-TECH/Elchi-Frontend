import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OrderStatusDonut from "./OrderStatusDonut";
import SuccessGauge from "./SuccessGauge";

/**
 * NIFAnCvf — donut va gauge recharts'siz, oddiy SVG.
 * Bu kartalar dashboardning birinchi ekranida: recharts ularga qaytsa,
 * birinchi yuklash 450 KB gzip byudjetidan oshadi.
 */

const legend = { sold: "Sotilgan", inProgress: "Jarayonda", cancelled: "Bekor" };

const dashLength = (el: Element) => Number(el.getAttribute("stroke-dasharray")?.split(" ")[0]);

describe("OrderStatusDonut (SVG)", () => {
  it("draws one arc per non-zero status, proportional to the values", () => {
    const { container } = render(
      <OrderStatusDonut
        accepted={100}
        sold={60}
        inProgress={30}
        cancelled={10}
        title="Holat"
        centerLabel="Qabul qilingan"
        legend={legend}
      />,
    );

    const sold = container.querySelector('[data-segment="sold"]')!;
    const inProgress = container.querySelector('[data-segment="inProgress"]')!;
    const cancelled = container.querySelector('[data-segment="cancelled"]')!;

    expect(dashLength(sold) / dashLength(cancelled)).toBeCloseTo(6, 5);
    expect(dashLength(inProgress) / dashLength(cancelled)).toBeCloseTo(3, 5);
    expect(sold.querySelector("title")).toHaveTextContent("Sotilgan: 60");
    expect(container.querySelector('svg[role="img"]')).toHaveAttribute("aria-label", "Qabul qilingan: 100");
  });

  it("skips zero segments and shows a plain track when everything is zero", () => {
    const { container, rerender } = render(
      <OrderStatusDonut
        accepted={5}
        sold={5}
        inProgress={0}
        cancelled={0}
        title="Holat"
        centerLabel="Qabul qilingan"
        legend={legend}
      />,
    );
    expect(container.querySelectorAll("[data-segment]")).toHaveLength(1);

    rerender(
      <OrderStatusDonut
        accepted={0}
        sold={0}
        inProgress={0}
        cancelled={0}
        title="Holat"
        centerLabel="Qabul qilingan"
        legend={legend}
      />,
    );
    expect(container.querySelectorAll("[data-segment]")).toHaveLength(0);
    expect(container.querySelector('svg[role="img"] circle')).toHaveAttribute("stroke", "var(--color-border-soft)");
  });
});

describe("SuccessGauge (SVG)", () => {
  it("fills the arc to the success rate, clamped to 0..100", () => {
    const { getByTestId, rerender, queryByTestId } = render(
      <SuccessGauge successRate={72.5} sold={10} cancelled={2} title="Muvaffaqiyat" soldLabel="Sotilgan" cancelledLabel="Bekor" />,
    );
    expect(getByTestId("success-gauge-value")).toHaveAttribute("stroke-dasharray", "72.5 100");

    rerender(
      <SuccessGauge successRate={140} sold={10} cancelled={2} title="Muvaffaqiyat" soldLabel="Sotilgan" cancelledLabel="Bekor" />,
    );
    expect(getByTestId("success-gauge-value")).toHaveAttribute("stroke-dasharray", "100 100");

    rerender(
      <SuccessGauge successRate={0} sold={0} cancelled={2} title="Muvaffaqiyat" soldLabel="Sotilgan" cancelledLabel="Bekor" />,
    );
    expect(queryByTestId("success-gauge-value")).not.toBeInTheDocument();
  });
});

describe("dashboard-statistics — recharts'ga bog'liq emas", () => {
  it("does not import recharts", () => {
    const sources = import.meta.glob("./*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.endsWith(".test.tsx"))
      .filter(([, source]) => /from\s+["']recharts["']/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
