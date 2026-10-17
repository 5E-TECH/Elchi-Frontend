import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { RegionItem } from "../../../entities/region";
import { renderWithProviders } from "../../../test/test-utils";
import RegionDetailDialog from "../index";

const apiGet = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/api/api", () => ({
  api: { get: (...args: unknown[]) => apiGet(...args) },
}));

const fallback: RegionItem = {
  id: "6",
  name: "Samarqand viloyati",
  districtCount: 16,
  activeCouriers: 3,
  ordersCount: 31,
  deliveredOrders: 24,
  cancelledOrders: 3,
  pendingOrders: 0,
  totalRevenue: 4_860_000,
  successRate: 0,
};

const DETAIL = {
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
      activeCouriers: 3,
    },
    couriers: [
      {
        id: "c1",
        name: "Ilhom Saidov",
        phoneNumber: "+998972389014",
        totalOrders: 6,
        deliveredOrders: 5,
        totalRevenue: 1_110_000,
      },
      {
        id: "c2",
        name: "Shohruh Mirzayev",
        phoneNumber: "+998904121805",
        totalOrders: 15,
        deliveredOrders: 12,
        totalRevenue: 2_340_000,
      },
    ],
    districts: [
      {
        id: "d1",
        name: "Samarqand sh.",
        satoCode: "1718401",
        couriers: [{ id: "c1" }, { id: "c2" }],
        totalOrders: 11,
        deliveredOrders: 9,
        cancelledOrders: 1,
        totalRevenue: 1_790_000,
      },
      {
        id: "d2",
        name: "Jomboy tumani",
        satoCode: "1718209",
        couriers: [{ id: "c1" }],
        totalOrders: 2,
        deliveredOrders: 1,
        cancelledOrders: 0,
        totalRevenue: 230_000,
      },
      {
        id: "d3",
        name: "Payariq tumani",
        satoCode: "1718224",
        couriers: [],
        totalOrders: 1,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
      },
      {
        id: "d4",
        name: "Nurobod tumani",
        satoCode: "1718216",
        couriers: [],
        totalOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
      },
    ],
  },
};

const renderDialog = (props: Partial<Parameters<typeof RegionDetailDialog>[0]> = {}) =>
  renderWithProviders(
    <RegionDetailDialog
      open
      onClose={() => undefined}
      region={{ id: "6", name: "Samarqand viloyati" }}
      dateParams={{ startDate: "2026-10-08", endDate: "2026-10-08" }}
      periodLabel="Bugun"
      fallback={fallback}
      company={{ totalOrders: 312, totalRevenue: 48_600_000, successRate: 77.2 }}
      {...props}
    />,
  );

describe("RegionDetailDialog (umumiy viloyat oynasi)", () => {
  afterEach(() => apiGet.mockReset());

  it("loads GET region/stats/:id with the period and shows KPIs, couriers and districts", async () => {
    apiGet.mockResolvedValue({ data: DETAIL });
    const user = userEvent.setup();
    renderDialog();

    const dialog = await screen.findByRole("dialog", { name: "Samarqand viloyati" });
    expect(apiGet).toHaveBeenCalledWith("region/stats/6", {
      params: { startDate: "2026-10-08", endDate: "2026-10-08" },
    });
    expect(within(dialog).getByText("Batafsil statistika · Bugun")).toBeInTheDocument();

    const kpis = within(dialog).getByRole("group", { name: "Viloyat ko'rsatkichlari" });
    expect(within(kpis).getByText("Jarayonda 4 ta")).toBeInTheDocument();
    // 31 / 312 = 9,9% — kompaniyadagi ulushi; 24 / 31 = 77,4% vs 77,2% → +0,2 p.p.
    expect(within(kpis).getAllByText("9,9%").length).toBeGreaterThan(0);
    expect(within(kpis).getByText("77,4%")).toBeInTheDocument();
    expect(within(kpis).getAllByText("+0,2 p.p.").length).toBeGreaterThan(0);
    expect(within(kpis).getByText("4 860 000 so'm")).toBeInTheDocument();

    const couriers = await within(dialog).findByRole("list", { name: "Viloyat kuryerlari" });
    expect(within(couriers).getByText("Ilhom Saidov")).toBeInTheDocument();
    expect(within(couriers).getByText("Asosiy")).toBeInTheDocument();
    expect(within(couriers).getByText("83,3%")).toBeInTheDocument();
    expect(within(couriers).getByText("5 / 6 ta")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Ma'lumot hali kam — foizlar taxminiy (har kuryerda 30 tadan kam)"),
    ).toBeInTheDocument();

    // Tumanlar: xulosa, reyting, buyurtmasizlar yig'iq.
    expect(within(dialog).getByText("Kuryersiz tumanlar")).toBeInTheDocument();
    expect(within(dialog).getByText("1 ta jarayonda")).toBeInTheDocument();
    expect(within(dialog).getByText("Buyurtmasiz tumanlar · 1 ta")).toBeInTheDocument();
    const rank = within(dialog).getByRole("list", { name: "Tumanlar, buyurtmalar soni bo'yicha" });
    expect(within(rank).queryByText("Nurobod tumani")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Ko'rsatish" }));
    expect(within(rank).getByText("Nurobod tumani")).toBeInTheDocument();

    // Jadval egizagi.
    await user.click(within(dialog).getByRole("radio", { name: "Jadval" }));
    const table = within(dialog).getByRole("table");
    expect(within(table).getByText("Jami · 4 tuman")).toBeInTheDocument();
    expect(within(table).getByText("2 nafar")).toBeInTheDocument();
  });

  it("keeps the map numbers and shows the dialog error when region stats fail", async () => {
    apiGet.mockRejectedValue(
      Object.assign(new Error("forbidden"), {
        isAxiosError: true,
        response: { status: 403, data: {} },
      }),
    );
    renderDialog();

    const dialog = await screen.findByRole("dialog", { name: "Samarqand viloyati" });
    expect(
      await within(dialog).findByText("Viloyat ma'lumotini yuklab bo'lmadi"),
    ).toBeInTheDocument();
    const kpis = within(dialog).getByRole("group", { name: "Viloyat ko'rsatkichlari" });
    expect(within(kpis).getByText("31")).toBeInTheDocument();
    expect(within(kpis).getByText("4 860 000 so'm")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("list", { name: "Viloyat kuryerlari" }),
    ).not.toBeInTheDocument();
  });

  it("shows only the error (no endless skeletons) when region stats fail and no fallback is given", async () => {
    apiGet.mockRejectedValue(
      Object.assign(new Error("forbidden"), {
        isAxiosError: true,
        response: { status: 403, data: {} },
      }),
    );
    renderDialog({ fallback: undefined });

    const dialog = await screen.findByRole("dialog", { name: "Samarqand viloyati" });
    expect(
      await within(dialog).findByText("Viloyat ma'lumotini yuklab bo'lmadi"),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("group", { name: "Viloyat ko'rsatkichlari" }),
    ).not.toBeInTheDocument();
    expect(
      dialog.querySelector("[data-skeleton], [data-skeleton-preset], [aria-busy='true']"),
    ).toBeNull();
  });

  it("hides every revenue figure when showRevenue is false (registrator)", async () => {
    apiGet.mockResolvedValue({ data: DETAIL });
    const user = userEvent.setup();
    renderDialog({ showRevenue: false });

    const dialog = await screen.findByRole("dialog", { name: "Samarqand viloyati" });
    const couriers = await within(dialog).findByRole("list", { name: "Viloyat kuryerlari" });
    const kpis = within(dialog).getByRole("group", { name: "Viloyat ko'rsatkichlari" });
    expect(within(kpis).queryByText("Umumiy tushum")).not.toBeInTheDocument();
    expect(within(kpis).getByText("77,4%")).toBeInTheDocument();
    // Kuryer qatorida telefon qoladi, summa yo'q; tuman qatorida faqat foiz.
    expect(within(couriers).getByText("+998 97 238 90 14")).toBeInTheDocument();
    const rank = within(dialog).getByRole("list", { name: "Tumanlar, buyurtmalar soni bo'yicha" });
    expect(within(rank).getByText("81,8%")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("so'm");

    await user.click(within(dialog).getByRole("radio", { name: "Jadval" }));
    const table = within(dialog).getByRole("table");
    expect(within(table).queryByRole("columnheader", { name: "Tushum" })).not.toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Sotuv" })).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("so'm");
  });

  it("does not request anything while closed", async () => {
    renderDialog({ open: false });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiGet).not.toHaveBeenCalled();
  });
});
