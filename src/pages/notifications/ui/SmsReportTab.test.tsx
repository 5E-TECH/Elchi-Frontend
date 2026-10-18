import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { addDays, tashkentDay } from "../lib/smsReport";
import SmsReportTab from "./SmsReportTab";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api }));

const today = tashkentDay();
const yesterday = addDays(today, -1);

const DAYS = [
  {
    day: yesterday,
    message_class: "transactional",
    total: 1412,
    delivered: 1389,
    failed: 23,
    parts: 1507,
    cost: 173305,
    untariffed: 0,
  },
  {
    day: yesterday,
    message_class: "security",
    total: 52,
    delivered: 51,
    failed: 1,
    parts: 52,
    cost: 0,
    untariffed: 52,
  },
  {
    day: today,
    message_class: "transactional",
    total: 1236,
    delivered: 1168,
    failed: 14,
    parts: 1318,
    cost: 151570,
    untariffed: 0,
  },
];
const TOTALS = {
  total: 2700,
  delivered: 2608,
  failed: 38,
  parts: 2877,
  cost: 324875,
  untariffed: 52,
  success_rate: 98.6,
  tariff_configured: true,
};

describe("SmsReportTab — xarajat hisoboti", () => {
  beforeEach(() => {
    api.get.mockReset().mockImplementation((url: string) => {
      if (url.endsWith("tariffs"))
        return Promise.resolve({
          data: { data: { transactional: 115, promo: 160, security: null } },
        });
      if (url.endsWith("report"))
        return Promise.resolve({ data: { data: { days: DAYS, totals: TOTALS } } });
      return Promise.resolve({ data: { data: null } });
    });
  });

  it("asks the report for the last 30 Tashkent days (half-open, +05:00) — as before", async () => {
    renderWithProviders(<SmsReportTab />);
    await screen.findByText("Kunlar bo'yicha");
    const call = api.get.mock.calls.find(([url]) => String(url).endsWith("report"));
    expect(call?.[1]).toEqual({
      params: {
        from: `${addDays(today, -29)}T00:00:00+05:00`,
        to: `${addDays(today, 1)}T00:00:00+05:00`,
      },
    });
    expect(screen.getByText("Kunlar Toshkent vaqti bo'yicha hisoblanadi")).toBeInTheDocument();
  });

  it("KPI, untariffed warning, delivery gauge, cost and status cards are derived from the rows", async () => {
    renderWithProviders(<SmsReportTab />);

    const summary = await screen.findByRole("region", { name: "SMS xarajati xulosasi" });
    expect(within(summary).getByText("2 700")).toBeInTheDocument();
    expect(within(summary).getByText("2 877")).toBeInTheDocument();
    expect(within(summary).getByText("kuniga o'rtacha 90 ta")).toBeInTheDocument();
    expect(within(summary).getByText("1 SMS = o'rtacha 1,07 bo'lak")).toBeInTheDocument();

    expect(screen.getByText(/52 ta SMS uchun tarif sozlanmagan/)).toBeInTheDocument();

    // Yetkazilish = yetkazildi / jami yuborilgan: 2 608 / 2 700 = 96,6%.
    expect(screen.getByRole("img", { name: /^Yetkazilish: 96,6%/ })).toBeInTheDocument();
    expect(screen.getByText("Yaxshi · 70% va undan yuqori")).toBeInTheDocument();
    expect(screen.getByText(/54 ta SMS hali operatordan javob kutmoqda/)).toBeInTheDocument();

    // Xarajat turlari: tarif × bo'lak, OTP — tarif sozlanmagan, «Tarifni sozlash» — Sozlamalar tabiga.
    expect(screen.getByText("2 825 bo'lak × 115 so'm")).toBeInTheDocument();
    expect(screen.getByText("52 bo'lak · tarif sozlanmagan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tarifni sozlash" })).toHaveAttribute(
      "href",
      "/notifications/sms?tab=settings",
    );
    expect(
      screen.getByRole("meter", { name: "Xavfsizlik (OTP): xarajat hisoblanmagan" }),
    ).toBeInTheDocument();

    // Holat turlari: segment chiziq nomi.
    expect(
      screen.getByRole("img", { name: "Xizmat xabari: 2 557 yetkazildi, 54 kutilmoqda, 37 xato" }),
    ).toBeInTheDocument();
  });

  it("«Kunlar bo'yicha»: today first, untariffed cost is «—», Grafik | Jadval toggle shows the daily table", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SmsReportTab />);

    const table = await screen.findByRole("table", { name: "Kunlar bo'yicha SMS" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent(/^Bugun/);
    expect(rows[0]).toHaveTextContent("151 570 so'm");
    expect(within(rows[2]).getByTitle("Tarif sozlanmagan")).toHaveTextContent("—");

    await user.click(screen.getByRole("radio", { name: "Jadval" }));
    const daily = screen.getByRole("table", { name: "Kunlik SMS soni" });
    expect(within(daily).getAllByRole("row")).toHaveLength(31);
  });

  it("no SMS in the period — empty state", async () => {
    api.get.mockImplementation((url: string) =>
      url.endsWith("report")
        ? Promise.resolve({
            data: {
              data: {
                days: [],
                totals: {
                  ...TOTALS,
                  total: 0,
                  delivered: 0,
                  failed: 0,
                  parts: 0,
                  cost: 0,
                  untariffed: 0,
                },
              },
            },
          })
        : Promise.resolve({ data: { data: null } }),
    );
    renderWithProviders(<SmsReportTab />);
    expect(await screen.findByText("Bu davrda SMS yo'q")).toBeInTheDocument();
  });
});
