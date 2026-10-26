import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { RegionItem } from "../../../entities/region";
import { toRegionRows } from "../model/regionsModel";
import UzbekistanRegionMap from "./UzbekistanRegionMap";

type MockPoint = Record<string, unknown> & {
  rowId?: string;
  color?: string;
  name?: string;
  accessibility?: { description?: string };
};
type MockSeries = {
  data?: MockPoint[];
  nullColor?: string;
  point?: { events?: { click?: (this: MockPoint) => void } };
  dataLabels?: { formatter?: (this: MockPoint) => string };
};
type MockOptions = {
  series?: MockSeries[];
  tooltip?: { formatter?: (this: MockPoint) => string | false };
  accessibility?: { enabled?: boolean; description?: string; keyboardNavigation?: { enabled?: boolean } };
};

const A11Y = {
  title: "Viloyatlar xaritasi",
  locale: "uz",
  lang: {},
  pointDescription: (row: { name: string }) => `${row.name}: tavsif`,
};

const lastOptions = vi.hoisted(() => ({ current: null as MockOptions | null }));

// Highcharts jsdom'da chizilmaydi — har nuqtani tugma qilib, uning `click` hodisasini chaqiramiz.
vi.mock("highcharts-react-official", () => ({
  default: ({ options }: { options: MockOptions }) => {
    lastOptions.current = options;
    const series = options.series?.[0];
    return (
      <div>
        {(series?.data ?? []).map((point) => (
          <button
            key={String(point["hc-key"])}
            type="button"
            onClick={() => series?.point?.events?.click?.call(point)}
          >
            {`map-point-${String(point["hc-key"])}`}
          </button>
        ))}
      </div>
    );
  },
}));

const region = (
  id: string,
  name: string,
  ordersCount: number,
  deliveredOrders: number,
): RegionItem => ({
  id,
  name,
  districtCount: 10,
  activeCouriers: 3,
  ordersCount,
  deliveredOrders,
  cancelledOrders: 1,
  pendingOrders: 0,
  totalRevenue: 1_000_000,
  successRate: 0,
});

const rows = toRegionRows([
  region("1", "Toshkent shahri", 112, 91),
  region("6", "Samarqand viloyati", 31, 24),
  region("9", "Qoraqalpog'iston Respublikasi", 0, 0),
  region("99", "Noma'lum hudud", 4, 1),
]);

describe("UzbekistanRegionMap (v2: faqat xarita, ranglar region-map tokenlaridan)", () => {
  beforeEach(() => {
    const root = document.documentElement.style;
    root.setProperty("--color-sunken", "#eef1f8");
    root.setProperty("--color-region-map-low", "#cde2fb");
    root.setProperty("--color-region-map-medium", "#86b6ef");
    root.setProperty("--color-region-map-high", "#3987e5");
    root.setProperty("--color-region-map-xhigh", "#1c5cab");
  });

  it("colours each known region by its order step and skips names without a map key", () => {
    renderWithProviders(
      <UzbekistanRegionMap
        rows={rows}
        metric="orders"
        maxRevenue={1_000_000}
        valueLabels={new Map(rows.map((row) => [row.id, String(row.orders)]))}
        tooltipHtml={() => ""}
        onSelect={() => undefined}
        ariaLabel="Xarita"
        a11y={A11Y}
      />,
    );

    const data = lastOptions.current?.series?.[0]?.data ?? [];
    const byKey = Object.fromEntries(data.map((point) => [point["hc-key"], point.color]));
    expect(byKey).toEqual({
      "uz-tk": "#1c5cab", // 112 ta → 80+
      "uz-sa": "#3987e5", // 31 ta → 30–79
      "uz-qr": "#eef1f8", // buyurtma yo'q → sunken
    });
    expect(lastOptions.current?.series?.[0]?.nullColor).toBe("#eef1f8");
    // fYgDe3MW: tavsif — Highcharts `accessibility` da; `role="img"` viloyatlarni klaviaturadan yashirmaydi.
    expect(lastOptions.current?.accessibility).toMatchObject({
      enabled: true,
      description: "Xarita",
      keyboardNavigation: { enabled: true },
    });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // Har viloyatning o'z tavsifi (skrin-rider; maket: «Andijon viloyati: 21 ta buyurtma, …»).
    expect(data.find((point) => point.rowId === "6")?.accessibility?.description).toBe("Samarqand viloyati: tavsif");
  });

  it("opens the region on click and renders label + tooltip from the caller", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const tooltipHtml = vi.fn((row: (typeof rows)[number]) => `<b>${row.name}</b>`);
    renderWithProviders(
      <UzbekistanRegionMap
        rows={rows}
        metric="orders"
        maxRevenue={1_000_000}
        valueLabels={new Map([["6", "31"]])}
        tooltipHtml={tooltipHtml}
        onSelect={onSelect}
        ariaLabel="Xarita"
        a11y={A11Y}
      />,
    );

    await user.click(screen.getByRole("button", { name: "map-point-uz-sa" }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "6", name: "Samarqand viloyati" }),
    );

    const series = lastOptions.current?.series?.[0];
    const point = series?.data?.find((item) => item.rowId === "6") as MockPoint;
    expect(series?.dataLabels?.formatter?.call(point)).toBe("Samarqand<br/>31");
    expect(lastOptions.current?.tooltip?.formatter?.call(point)).toBe("<b>Samarqand viloyati</b>");
  });
});
