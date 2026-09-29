import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import UzbekistanRegionMap from "./UzbekistanRegionMap";
import css from "../../../index.css?raw";

// Highcharts jsdom'da chizilmaydi — seriyaning birinchi nuqtasini tugma qilib, uning `click` hodisasini chaqiramiz.
vi.mock("highcharts-react-official", () => ({
  default: ({ options }: { options: { series?: Array<{ data?: Array<Record<string, unknown>>; point?: { events?: { click?: () => void } } }> } }) => {
    const series = options?.series?.find((item) => item.point?.events?.click);
    const point = series?.data?.[0];
    return point ? (
      <button type="button" onClick={() => series?.point?.events?.click?.call(point)}>
        map-point
      </button>
    ) : null;
  },
}));

const apiGet = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/api/api", () => ({ api: { get: (...args: unknown[]) => apiGet(...args) } }));

/** index.css dagi token qiymati: `.dark` blokida qayta aniqlangan bo'lsa o'shani, aks holda umumiy qiymatni oladi. */
const darkBlock = css.slice(css.indexOf("\n.dark {"), css.indexOf("\n}", css.indexOf("\n.dark {")));
const tokenValue = (name: string, dark: boolean) => {
  const re = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`);
  return (dark && darkBlock.match(re)?.[1]) || css.match(re)?.[1];
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const darkToken = (className: string, prefix: "bg" | "text") => className.match(new RegExp(`(?:^|\\s)dark:${prefix}-([a-z]+)(?:\\s|$)`))?.[1];

describe("UzbekistanRegionMap detail modal in dark mode", () => {
  beforeEach(() => {
    document.documentElement.classList.add("dark");
    apiGet.mockResolvedValue({
      data: { data: { summary: { totalOrders: 4321, deliveredOrders: 4000, cancelledOrders: 21, pendingOrders: 300, totalRevenue: 1000000, successRate: 92 } } },
    });
  });
  afterEach(() => document.documentElement.classList.remove("dark"));

  it("paints every metric value readable on its card (dark background token, ≥ 4.5:1)", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <UzbekistanRegionMap
        regions={[{ id: "3", name: "Andijon viloyati", stats: { districtCount: 14, activeCouriers: 3, orderCount: 4321 } }]}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "map-point" }));
    const value = await screen.findByText("4321");
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    const valueClass = value.className;
    const card = value.parentElement!;
    const bgToken = darkToken(card.className, "bg");
    const textToken = darkToken(valueClass, "text");
    // Ilgari karta `bg-primary` (dark'da ham #ffffff) + qiymat `dark:text-primary` (#ffffff) — 1.0:1.
    expect(bgToken).toBeDefined();
    expect(textToken).toBeDefined();
    const bg = tokenValue(bgToken!, true)!;
    const fg = tokenValue(textToken!, true)!;
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
