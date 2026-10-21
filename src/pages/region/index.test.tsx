import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { vi } from "vitest";
import Region from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.hoisted(() => vi.fn());

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

// Highcharts xaritasi jsdom'da chizilmaydi — bosiladigan viloyat tugmalari bilan almashtiriladi.
vi.mock("./ui/UzbekistanRegionMap", () => ({
  default: ({
    rows,
    onSelect,
    ariaLabel,
  }: {
    rows: Array<{ id: string; name: string }>;
    onSelect: (row: unknown) => void;
    ariaLabel: string;
  }) => (
    <div role="img" aria-label={ariaLabel}>
      {rows.map((row) => (
        <button key={row.id} type="button" onClick={() => onSelect(row)}>
          {`map:${row.name}`}
        </button>
      ))}
    </div>
  ),
}));

const Where = () => {
  const location = useLocation();
  return <span data-testid="where">{`${location.pathname}${location.search}`}</span>;
};

const roleState = (role: string) => ({ id: `${role}-1`, role, region: null, name: role });

const STATS_ALL = {
  statusCode: 200,
  data: {
    regions: [
      {
        id: "1",
        name: "Toshkent shahri",
        sato_code: "1726",
        districts_count: 12,
        totalOrders: 112,
        deliveredOrders: 91,
        cancelledOrders: 9,
        revenue: 18_500_000,
        activeCouriers: 20,
        totalCouriers: 22,
      },
      {
        id: "6",
        name: "Samarqand viloyati",
        sato_code: "1718",
        districts_count: 16,
        totalOrders: 31,
        deliveredOrders: 24,
        cancelledOrders: 3,
        revenue: 4_860_000,
        activeCouriers: 3,
        totalCouriers: 3,
      },
      {
        id: "11",
        name: "Sirdaryo viloyati",
        sato_code: "1724",
        districts_count: 11,
        totalOrders: 5,
        deliveredOrders: 3,
        cancelledOrders: 1,
        revenue: 600_000,
        activeCouriers: 2,
        totalCouriers: 2,
      },
    ],
    summary: {
      totalRegions: 3,
      totalOrders: 148,
      deliveredOrders: 118,
      cancelledOrders: 13,
      totalRevenue: 23_960_000,
    },
  },
};

const STATS_BY_ID = {
  statusCode: 200,
  data: {
    region: {
      id: "6",
      name: "Samarqand viloyati",
      satoCode: "1718",
      mainCourier: { id: "c2", name: "Shohruh Mirzayev" },
    },
    summary: {
      totalOrders: 31,
      deliveredOrders: 24,
      cancelledOrders: 3,
      pendingOrders: 4,
      totalRevenue: 4_860_000,
      successRate: 77,
      totalCouriers: 2,
      activeCouriers: 2,
      totalDistricts: 3,
    },
    couriers: [
      {
        id: "c1",
        name: "Ilhom Saidov",
        phoneNumber: "+998972389014",
        totalOrders: 6,
        deliveredOrders: 5,
        totalRevenue: 1_110_000,
        successRate: 83,
      },
      {
        id: "c2",
        name: "Shohruh Mirzayev",
        phoneNumber: "+998904121805",
        totalOrders: 15,
        deliveredOrders: 12,
        totalRevenue: 2_340_000,
        successRate: 80,
      },
    ],
    districts: [
      {
        id: "d1",
        name: "Samarqand sh.",
        satoCode: "1718401",
        couriers: [{ id: "c1" }],
        totalOrders: 11,
        deliveredOrders: 9,
        cancelledOrders: 1,
        totalRevenue: 1_790_000,
        successRate: 82,
      },
      {
        id: "d2",
        name: "Urgut tumani",
        satoCode: "1718236",
        couriers: [],
        totalOrders: 5,
        deliveredOrders: 4,
        cancelledOrders: 0,
        totalRevenue: 790_000,
        successRate: 80,
      },
      {
        id: "d3",
        name: "Nurobod tumani",
        satoCode: "1718216",
        couriers: [],
        totalOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        successRate: 0,
      },
    ],
  },
};

const MY_DISTRICT_STATS = {
  statusCode: 200,
  data: {
    region: { id: "12", name: "Jizzax viloyati", satoCode: "1708" },
    summary: {
      totalOrders: 9,
      deliveredOrders: 6,
      cancelledOrders: 1,
      pendingOrders: 2,
      totalRevenue: 1_200_000,
      successRate: 67,
      districtsCount: 3,
    },
    districts: [
      {
        id: "1",
        name: "Arnasoy tumani",
        satoCode: "1708201",
        totalOrders: 7,
        deliveredOrders: 5,
        cancelledOrders: 1,
        pendingOrders: 1,
        totalRevenue: 900_000,
        successRate: 71,
        couriersCount: 1,
      },
      {
        id: "2",
        name: "Baxmal tumani",
        satoCode: "1708204",
        totalOrders: 2,
        deliveredOrders: 1,
        cancelledOrders: 0,
        pendingOrders: 1,
        totalRevenue: 300_000,
        successRate: 50,
        couriersCount: 0,
      },
      {
        id: "3",
        name: "Do'stlik tumani",
        satoCode: "1708209",
        totalOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        successRate: 0,
        couriersCount: 0,
      },
    ],
  },
};

const DISTRICT_CATALOG = {
  statusCode: 200,
  data: [
    { id: "1", name: "Arnasoy tumani", region_id: "12" },
    { id: "2", name: "Baxmal tumani", region_id: "12" },
    { id: "3", name: "Do'stlik tumani", region_id: "12" },
  ],
};

const respond = (routes: Record<string, unknown>) =>
  apiGetMock.mockImplementation((url: string) =>
    url in routes
      ? Promise.resolve({ data: routes[url] })
      : Promise.reject(new Error(`Unexpected API request: ${url}`)),
  );

const calledUrls = () => apiGetMock.mock.calls.map(([url]) => url as string);

const renderRegion = (role: string, route = "/regions") =>
  renderWithProviders(
    <>
      <Region />
      <Where />
    </>,
    { route, preloadedState: { role: roleState(role) } as never },
  );

describe("Region page — superadmin / admin", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    respond({ "region/stats/all": STATS_ALL, "region/stats/6": STATS_BY_ID });
  });

  it("renders the v2 header, subtitle and KPI row from region/stats/all", async () => {
    renderRegion("admin");

    expect(screen.getByRole("heading", { level: 1, name: "Hududlar" })).toBeInTheDocument();
    expect(screen.getByText("Hududlar kesimida buyurtmalar statistikasi")).toBeInTheDocument();
    const kpis = await screen.findByRole("group", {
      name: "Hududlar bo'yicha umumiy ko'rsatkichlar",
    });
    expect(await within(kpis).findByText("148")).toBeInTheDocument();
    expect(within(kpis).getByText("Jarayonda 17 ta · 3 viloyat")).toBeInTheDocument();
    expect(within(kpis).getByText("Sotilgan va to'langan")).toBeInTheDocument();
    expect(calledUrls()).toEqual(["region/stats/all"]);
  });

  it("both see all three section links in the maket order (admin: «Tumanlar» first — DM-1)", async () => {
    const SECTIONS = ["Tumanlarni o'tkazish", "Tumanlar", "Logist biriktirish"];
    const sectionOrder = () =>
      screen
        .getAllByRole("button")
        .map((button) => button.textContent ?? "")
        .filter((name) => SECTIONS.includes(name));

    const { unmount } = renderRegion("superadmin");
    expect(sectionOrder()).toEqual(["Tumanlarni o'tkazish", "Tumanlar", "Logist biriktirish"]);
    unmount();

    renderRegion("admin");
    expect(sectionOrder()).toEqual(["Tumanlar", "Tumanlarni o'tkazish", "Logist biriktirish"]);
  });

  it("keeps the period in the URL and sends the matching date range", async () => {
    const user = userEvent.setup();
    renderRegion("admin", "/regions?period=week");

    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("region/stats/all", {
        params: {
          startDate: dayjs().startOf("week").format("YYYY-MM-DD"),
          endDate: dayjs().endOf("week").format("YYYY-MM-DD"),
        },
      }),
    );
    expect(screen.getByRole("radio", { name: "Bu hafta" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("radio", { name: "Barchasi" }));
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent("/regions?period=all"),
    );
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("region/stats/all", { params: {} }),
    );
  });

  it("restores a custom range from the URL", async () => {
    renderRegion("admin", "/regions?period=custom&startDate=2026-10-01&endDate=2026-10-08");

    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("region/stats/all", {
        params: { startDate: "2026-10-01", endDate: "2026-10-08" },
      }),
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "period=custom&startDate=2026-10-01&endDate=2026-10-08",
    );
  });

  it("opens the region dialog from the ranking with region stats, couriers and districts", async () => {
    const user = userEvent.setup();
    renderRegion("superadmin", "/regions?period=today");

    const ranking = await screen.findByRole("list", {
      name: "Viloyatlar reytingi, buyurtmalar soni bo'yicha",
    });
    await user.click(within(ranking).getByRole("button", { name: "Samarqand" }));

    const dialog = await screen.findByRole("dialog", { name: "Samarqand viloyati" });
    const today = dayjs().format("YYYY-MM-DD");
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("region/stats/6", {
        params: { startDate: today, endDate: today },
      }),
    );
    expect(within(dialog).getByText("Batafsil statistika · Bugun")).toBeInTheDocument();
    expect(await within(dialog).findByText("Ilhom Saidov")).toBeInTheDocument();
    expect(within(dialog).getByText("Asosiy")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Urgut tumani").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Buyurtmasiz tumanlar · 1 ta")).toBeInTheDocument();
  });

  it("shows the map numbers and an error inside the dialog when region stats fail", async () => {
    const user = userEvent.setup();
    apiGetMock.mockImplementation((url: string) =>
      url === "region/stats/all"
        ? Promise.resolve({ data: STATS_ALL })
        : Promise.reject(
            Object.assign(new Error("forbidden"), {
              isAxiosError: true,
              response: { status: 500, data: {} },
            }),
          ),
    );
    renderRegion("admin");

    await user.click(await screen.findByRole("button", { name: "map:Samarqand viloyati" }));
    const dialog = await screen.findByRole("dialog", { name: "Samarqand viloyati" });
    expect(
      await within(dialog).findByText("Viloyat ma'lumotini yuklab bo'lmadi"),
    ).toBeInTheDocument();
    // KPI xaritadagi qatordan: 31 ta buyurtma.
    const kpis = within(dialog).getByRole("group", { name: "Viloyat ko'rsatkichlari" });
    expect(within(kpis).getByText("31")).toBeInTheDocument();
    expect(within(dialog).queryByText("Viloyat kuryerlari")).not.toBeInTheDocument();
  });

  it("shows an error state with retry when region/stats/all fails", async () => {
    apiGetMock.mockRejectedValue(
      Object.assign(new Error("fail"), { isAxiosError: true, response: { status: 500, data: {} } }),
    );
    renderRegion("admin");

    expect(await screen.findByText("Viloyat ma'lumotini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
  });
});

describe("Region page — manager / courier (scoped, my/district-stats)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    respond({ "region/my/district-stats": MY_DISTRICT_STATS, district: DISTRICT_CATALOG });
  });

  it.each(["courier", "manager"])(
    "%s reads only region/my/district-stats (no stats/all, no orders lookup)",
    async (role) => {
      renderRegion(role);

      expect(
        await screen.findByRole("heading", {
          level: 1,
          name: "Jizzax viloyati — tumanlar statistikasi",
        }),
      ).toBeInTheDocument();
      expect((await screen.findAllByText("Arnasoy tumani")).length).toBeGreaterThan(0);
      expect(screen.getAllByText("Do'stlik tumani").length).toBeGreaterThan(0);
      const today = dayjs().format("YYYY-MM-DD");
      expect(apiGetMock).toHaveBeenCalledWith("region/my/district-stats", {
        params: { startDate: today, endDate: today },
      });
      await waitFor(() =>
        expect(apiGetMock).toHaveBeenCalledWith("district", { params: { region_id: "12" } }),
      );
      expect(calledUrls()).not.toContain("region/stats/all");
      expect(calledUrls()).not.toContain("orders");
      expect(calledUrls().some((url) => url.startsWith("region/stats/"))).toBe(false);
    },
  );

  it("selects a district tile and shows it in the «Tanlangan tuman» panel", async () => {
    const user = userEvent.setup();
    renderRegion("manager");

    const tile = await screen.findByRole("button", { name: /^Baxmal tumani: 2 ta buyurtma/ });
    expect(tile).toHaveAttribute("aria-pressed", "false");
    await user.click(tile);
    expect(tile).toHaveAttribute("aria-pressed", "true");
    const panels = screen.getAllByRole("region", { name: "Tanlangan tuman: Baxmal tumani" });
    expect(panels.length).toBeGreaterThan(0);
  });

  it("shows the «no region» empty state when the endpoint returns region: null", async () => {
    respond({
      "region/my/district-stats": {
        statusCode: 200,
        message: "Sizga viloyat biriktirilmagan",
        data: { region: null, summary: null, districts: [] },
      },
    });
    renderRegion("manager");

    expect(await screen.findByText("Bu foydalanuvchi uchun viloyat topilmadi")).toBeInTheDocument();
    expect(calledUrls()).toEqual(["region/my/district-stats"]);
  });

  it("shows the load error with retry when my/district-stats fails", async () => {
    apiGetMock.mockRejectedValue(
      Object.assign(new Error("fail"), { isAxiosError: true, response: { status: 500, data: {} } }),
    );
    renderRegion("courier");

    expect(await screen.findByText("Viloyat ma'lumotini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
  });

  it("redirects roles without region stats to /403", async () => {
    renderRegion("market");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/403"));
    expect(apiGetMock).not.toHaveBeenCalled();
  });
});

describe("Region page — logist (LG-3, region/stats/all + region/stats/:id, pulsiz)", () => {
  const ME = "logist-1";
  const regionRow = (id: string, name: string, logistId: string | null, totalOrders: number) => ({
    id,
    name,
    logist_id: logistId,
    districts_count: 3,
    totalOrders,
    deliveredOrders: Math.floor(totalOrders / 2),
    cancelledOrders: 1,
    revenue: 987_654_321,
    activeCouriers: 2,
    totalCouriers: 3,
  });
  const LOGIST_STATS_ALL = {
    statusCode: 200,
    data: {
      regions: [
        regionRow("8", "Qashqadaryo viloyati", ME, 12),
        regionRow("6", "Samarqand viloyati", ME, 31),
        regionRow("1", "Toshkent shahri", "logist-7", 112),
        regionRow("11", "Sirdaryo viloyati", null, 5),
      ],
    },
  };
  const courier = (id: string, name: string, totalOrders: number, deliveredOrders: number, extra = {}) => ({
    id,
    name,
    phoneNumber: "+998905556677",
    status: "active",
    districtId: "d1",
    totalOrders,
    deliveredOrders,
    cancelledOrders: 1,
    totalRevenue: 123_456_789,
    successRate: 0,
    ...extra,
  });
  const LOGIST_DETAIL = {
    statusCode: 200,
    data: {
      ...STATS_BY_ID.data,
      summary: { ...STATS_BY_ID.data.summary, totalRevenue: 987_654_321 },
      couriers: [
        courier("c1", "Ilhom Saidov", 9, 7),
        courier("c2", "Shohruh Mirzayev", 8, 4, { districtId: "d2" }),
        courier("c3", "Jasur Tursunov", 6, 5),
        courier("c4", "Bekzod Aliyev", 5, 3),
        courier("c5", "Sardor Qodirov", 4, 3),
        courier("c6", "Otabek Yo'ldoshev", 3, 2, { status: "inactive" }),
        courier("c7", "Ulug'bek Sobirov", 2, 1),
        courier("c8", "Buyurtmasiz Kuryer", 0, 0, { status: "inactive" }),
      ],
    },
  };
  const QASHQADARYO_DETAIL = {
    statusCode: 200,
    data: {
      region: { id: "8", name: "Qashqadaryo viloyati" },
      summary: { totalOrders: 12, deliveredOrders: 6, cancelledOrders: 1, totalCouriers: 0, activeCouriers: 0 },
      couriers: [],
      districts: [
        { id: "q1", name: "Qarshi sh.", couriers: [], totalOrders: 12, deliveredOrders: 6, cancelledOrders: 1 },
      ],
    },
  };

  const forbidden = () =>
    Promise.reject(
      Object.assign(new Error("forbidden"), {
        isAxiosError: true,
        response: { status: 403, data: { message: "Bu viloyat statistikasini ko'rishga ruxsat yo'q" } },
      }),
    );

  beforeEach(() => {
    apiGetMock.mockReset();
    respond({
      "region/stats/all": LOGIST_STATS_ALL,
      "region/stats/6": LOGIST_DETAIL,
      "region/stats/8": QASHQADARYO_DETAIL,
    });
  });

  it("opens the busiest own region: no district catalog, no my/district-stats, no money on the page", async () => {
    renderRegion("logist");

    expect(await screen.findByRole("heading", { level: 1, name: "Samarqand viloyati" })).toBeInTheDocument();
    expect(await screen.findAllByText("Urgut tumani")).not.toHaveLength(0);
    const today = dayjs().format("YYYY-MM-DD");
    expect(apiGetMock).toHaveBeenCalledWith("region/stats/6", {
      params: { startDate: today, endDate: today },
    });
    expect(calledUrls()).not.toContain("district");
    expect(calledUrls()).not.toContain("region/my/district-stats");
    expect(calledUrls()).not.toContain("region/stats/1");

    // Faqat o'z viloyatlari, buyurtmalar ko'pidan; URL ga o'zboshimcha yozilmaydi.
    const picker = screen.getByRole("radiogroup", { name: "Viloyatni tanlash" });
    expect(within(picker).getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Samarqand",
      "Qashqadaryo",
    ]);
    expect(within(picker).getByRole("radio", { name: "Samarqand" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("where").textContent).not.toContain("region=");

    // LG-S1: pul yo'q — tushum, «so'm», summalar chizilmaydi.
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/so'm|Tushum|987|123/);
    // «Tuman buyurtmalari» (LG-4) va «Barcha kuryerlar» (LG-5) hali yo'q.
    expect(screen.queryByText("Tuman buyurtmalari")).not.toBeInTheDocument();
    expect(screen.queryByText("Barcha kuryerlar")).not.toBeInTheDocument();
  });

  it("shows active couriers (status) and the top-5 courier table with «Yana N ta kuryer»", async () => {
    const user = userEvent.setup();
    renderRegion("logist");

    const card = (await screen.findByRole("heading", { level: 2, name: /^Kuryerlar/ })).closest("section")!;
    expect(within(card).getByText("(7)")).toBeInTheDocument();
    expect(within(card).getByText("Buyurtmasi bor kuryerlar · viloyatda faol 6 / 8")).toBeInTheDocument();
    const table = within(card).getByRole("table", { name: "Kuryerlar jadvali" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("Ilhom Saidov");
    expect(rows[0]).toHaveTextContent("Samarqand sh.");
    expect(rows[0]).toHaveTextContent("77,8%");
    expect(rows[1]).toHaveTextContent("Urgut tumani");
    expect(within(card).queryByText("Buyurtmasiz Kuryer")).not.toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Yana 2 ta kuryer" }));
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(7);
    expect(within(card).getByRole("button", { name: "Kamroq ko'rsatish" })).toHaveAttribute("aria-expanded", "true");

    // Umumiy ko'rsatkichlar: «Faol kuryerlar 6 / 8».
    expect(screen.getByText("/ 8")).toBeInTheDocument();
  });

  it("the selected district panel shows couriers instead of revenue", async () => {
    renderRegion("logist");
    const panels = await screen.findAllByRole("region", { name: "Tanlangan tuman: Samarqand sh." });
    expect(within(panels[0]).getByText("Kuryerlar")).toBeInTheDocument();
    expect(within(panels[0]).queryByText("Tushum")).not.toBeInTheDocument();
  });

  it("reads ?region= and writes the user's pick to the URL", async () => {
    const user = userEvent.setup();
    renderRegion("logist", "/regions?region=8&period=all");

    expect(await screen.findByRole("heading", { level: 1, name: "Qashqadaryo viloyati" })).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith("region/stats/8", { params: {} });
    expect(calledUrls()).not.toContain("region/stats/6");

    await user.click(screen.getByRole("radio", { name: "Samarqand" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Samarqand viloyati" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("region=6");
    expect(screen.getByTestId("where")).toHaveTextContent("period=all");
  });

  it("a region of another logist in the URL — «endi sizga biriktirilmagan», no stats/:id, URL kept", async () => {
    renderRegion("logist", "/regions?region=1");

    expect(await screen.findByText("Bu viloyat endi sizga biriktirilmagan")).toBeInTheDocument();
    expect(calledUrls().filter((url) => url.startsWith("region/stats/") && url !== "region/stats/all")).toEqual([]);
    expect(screen.getByTestId("where")).toHaveTextContent("region=1");
    const picker = screen.getByRole("radiogroup", { name: "Viloyatni tanlash" });
    expect(within(picker).getAllByRole("radio").every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(
      true,
    );
  });

  it("stats/:id 403 (region moved, backend iOnGbEqi) — «endi sizga biriktirilmagan»", async () => {
    apiGetMock.mockImplementation((url: string) =>
      url === "region/stats/all" ? Promise.resolve({ data: LOGIST_STATS_ALL }) : forbidden(),
    );
    renderRegion("logist");
    expect(await screen.findByText("Bu viloyat endi sizga biriktirilmagan")).toBeInTheDocument();
    expect(screen.queryByText(/ruxsat yo'q/)).not.toBeInTheDocument();
  });

  it("stale cached list: re-checks once before rejecting the URL region (LG-2 race lesson)", async () => {
    const user = userEvent.setup();
    let assigned = false;
    apiGetMock.mockImplementation((url: string) => {
      if (url === "region/stats/all") {
        const regions = LOGIST_STATS_ALL.data.regions.map((item) =>
          item.id === "11" && assigned ? { ...item, logist_id: ME } : item,
        );
        return Promise.resolve({ data: { statusCode: 200, data: { regions } } });
      }
      if (url === "region/stats/11") return Promise.resolve({ data: { ...QASHQADARYO_DETAIL, data: { ...QASHQADARYO_DETAIL.data, region: { id: "11", name: "Sirdaryo viloyati" } } } });
      if (url === "region/stats/6") return Promise.resolve({ data: LOGIST_DETAIL });
      return Promise.reject(new Error(`Unexpected API request: ${url}`));
    });

    // Sahifadan chiqib, keyin `?region=11` bilan qaytish (masalan bosh sahifadagi «Tafsilot»): ro'yxat keshda.
    const Remount = () => {
      const [shown, setShown] = useState(true);
      const navigate = useNavigate();
      return (
        <>
          <button
            type="button"
            onClick={() => {
              assigned = true;
              setShown(false);
              navigate("/regions?region=11");
            }}
          >
            leave
          </button>
          <button
            type="button"
            onClick={() => setShown(true)}
          >
            back
          </button>
          {shown ? <Region /> : null}
        </>
      );
    };
    renderWithProviders(
      <>
        <Remount />
        <Where />
      </>,
      { route: "/regions", preloadedState: { role: roleState("logist") } as never },
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Samarqand viloyati" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 5));

    await user.click(screen.getByRole("button", { name: "leave" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/regions?region=11"));
    await user.click(screen.getByRole("button", { name: "back" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sirdaryo viloyati" })).toBeInTheDocument();
    expect(screen.queryByText("Bu viloyat endi sizga biriktirilmagan")).not.toBeInTheDocument();
    expect(calledUrls().filter((url) => url === "region/stats/all")).toHaveLength(2);
    expect(screen.getByTestId("where")).toHaveTextContent("region=11");
  });

  it("no region assigned — empty state, no picker, no stats/:id", async () => {
    respond({
      "region/stats/all": {
        statusCode: 200,
        data: { regions: LOGIST_STATS_ALL.data.regions.filter((item) => item.logist_id !== ME) },
      },
    });
    renderRegion("logist");
    expect(await screen.findByText("Sizga hali viloyat biriktirilmagan")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Viloyatni tanlash" })).not.toBeInTheDocument();
    expect(calledUrls()).toEqual(["region/stats/all"]);
  });

  it("list load error — readable text (no backend message) and «Qayta urinish»", async () => {
    apiGetMock.mockRejectedValue(
      Object.assign(new Error("Internal RPC timeout"), {
        isAxiosError: true,
        response: { status: 500, data: { message: "Internal RPC timeout logistics.region.stats_all" } },
      }),
    );
    renderRegion("logist");
    expect(await screen.findByText("Viloyat ma'lumotini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
    expect(screen.queryByText(/RPC timeout/)).not.toBeInTheDocument();
  });
});
