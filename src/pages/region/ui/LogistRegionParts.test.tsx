import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DistrictStatsItem } from "../../../entities/region";
import { renderWithProviders } from "../../../test/test-utils";
import type { LogistCourierRow } from "../model/logistRegionModel";
import { toDistrictRows } from "../model/scopedModel";
import { LogistRegionCouriers } from "./LogistRegionCouriers";
import { DistrictTable, SelectedDistrictPanel } from "./ScopedDistricts";

/** LG-3 review: pul qo'riqlovi tuzilmaviy (prop'ga emas, ma'lumotga tayanadi) va ikonka reestri. */

const district = (id: string, name: string, totalOrders: number, deliveredOrders: number): DistrictStatsItem =>
  ({
    id,
    name,
    totalOrders,
    deliveredOrders,
    cancelledOrders: 1,
    revenue: 987_654_321,
    activeCouriers: 2,
  }) as DistrictStatsItem;

const DISTRICTS = [district("d1", "Urgut tumani", 12, 9), district("d2", "Kattaqo'rg'on tumani", 5, 2)];

describe("toDistrictRows — withRevenue", () => {
  it("sukut — tushum bor (menejer/kuryer o'zgarmagan); logist — qatorda tushum maydoni umuman yo'q", () => {
    expect(toDistrictRows(DISTRICTS)[0].revenue).toBe(987_654_321);
    const rows = toDistrictRows(DISTRICTS, { withRevenue: false });
    expect(rows.every((row) => !("revenue" in row))).toBe(true);
    expect(rows.map((row) => row.couriers)).toEqual([2, 2]);
  });
});

describe("ScopedDistricts — tushumsiz qatorlar (prop unutilgan bo'lsa ham pul chiqmaydi)", () => {
  it("DistrictTable: «Tushum» ustuni va summa yo'q (showRevenue sukutda)", () => {
    renderWithProviders(<DistrictTable rows={toDistrictRows(DISTRICTS, { withRevenue: false })} />);
    expect(screen.queryByRole("columnheader", { name: "Tushum" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/so'm|987/);
  });

  it("DistrictTable: tushumli qatorlarda ustun bor (menejer o'zgarmagan)", () => {
    renderWithProviders(<DistrictTable rows={toDistrictRows(DISTRICTS)} />);
    expect(screen.getByRole("columnheader", { name: "Tushum" })).toBeInTheDocument();
  });

  it("SelectedDistrictPanel: metric sukutda (revenue), lekin qatorda tushum yo'q — «Kuryerlar»", () => {
    const [row] = toDistrictRows(DISTRICTS, { withRevenue: false });
    renderWithProviders(<SelectedDistrictPanel row={row} regionRate={60} />);
    const panel = screen.getByRole("region", { name: "Tanlangan tuman: Urgut tumani" });
    expect(within(panel).queryByText("Tushum")).not.toBeInTheDocument();
    expect(within(panel).getByText("Kuryerlar")).toBeInTheDocument();
  });
});

describe("LogistRegionCouriers — ikonka reestri", () => {
  const row = (id: string, rate: number): LogistCourierRow => ({
    id,
    name: `Kuryer ${id}`,
    initials: "K",
    orders: 10,
    sold: rate / 10,
    cancelled: 0,
    rate,
  });

  it("qizil zona — CircleX (CircleAlert reestrda almashtirilgan)", () => {
    const { container } = renderWithProviders(
      <LogistRegionCouriers rows={[row("a", 80), row("b", 50), row("c", 20)]} counts={{ active: 3, total: 3 }} />,
    );
    expect(container.querySelector("svg.lucide-circle-x")).not.toBeNull();
    expect(container.querySelector('svg[class*="circle-alert"]')).toBeNull();
  });

  it("bo'sh holat — Truck («Kuryer, yetkazish»), Users emas", () => {
    const { container } = renderWithProviders(<LogistRegionCouriers rows={[]} counts={{ active: 0, total: 0 }} />);
    expect(container.querySelector("svg.lucide-truck")).not.toBeNull();
    expect(container.querySelector("svg.lucide-users")).toBeNull();
  });
});
