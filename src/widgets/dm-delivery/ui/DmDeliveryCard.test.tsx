import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { toDmDeliveryReport } from "../api/dmDelivery";
import DmDeliveryCard from "./DmDeliveryCard";

/**
 * 2crjWf7v — «Yetkazish metrikasi: kvitansiya yuborilgan/yetgan nisbati dashboardda ko'rinadi»:
 * `GET /telegram/dm-delivery` (faqat superadmin) → spidometr (`delivery_ratio`), «Qamrov» (`reach_ratio`),
 * navbat va «Yuborilmadi» sabablari. Nisbat `null` — «ma'lumot yo'q» (0% emas).
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../shared/api/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/api/api")>()),
  api: { get: mocks.get },
}));

/** Backend CHANGELOG 2026-10-23 namunasi. */
const REPORT = {
  statusCode: 200,
  message: "success",
  data: {
    type: "finance.payment_received",
    from: "2026-09-30T19:00:00.000Z",
    to: "2026-10-23T19:00:00.000Z",
    totals: {
      total: 120,
      sent: 90,
      failed: 4,
      pending: 1,
      skipped: 25,
      no_provider: 0,
      other: 0,
      delivery_ratio: 0.947,
      reach_ratio: 0.75,
    },
    skipped_reasons: { no_telegram_id: 20, bot_blocked: 3, user_deactivated: 2 },
    by_role: [],
    days: [],
  },
};

const plain = (text: string | null | undefined) => (text ?? "").replace(/\s/g, " ");

beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue({ data: REPORT });
});

describe("DmDeliveryCard (2crjWf7v)", () => {
  it("spidometr — delivery_ratio, «Yetdi» / «Xato», «Qamrov», navbat va sabablar; davr javobdan", async () => {
    renderWithProviders(<DmDeliveryCard enabled from="2026-10-01" to="2026-10-23" />);

    const card = await screen.findByRole("region", { name: "Kvitansiya yetkazilishi" });
    expect(mocks.get).toHaveBeenCalledWith("telegram/dm-delivery", { params: { from: "2026-10-01", to: "2026-10-23" } });
    const gauge = await within(card).findByRole("img", { name: /Kvitansiya yetkazilishi: 94,7%/ });
    expect(gauge).toHaveTextContent("94,7%");
    expect(gauge).toHaveTextContent("Yetdi / yuborilgan");
    expect(plain(gauge.textContent)).toContain("90 taYetdi");
    expect(plain(gauge.textContent)).toContain("4 taXato");

    expect(plain(within(card).getByTestId("dm-delivery-reach").textContent)).toBe(
      "Qamrov120 qabul qiluvchidan 90 tasiga yetdi75%",
    );
    expect(within(card).getByTestId("dm-delivery-pending")).toHaveTextContent("1 ta");
    expect(plain(within(card).getByTestId("dm-delivery-skipped").textContent)).toBe(
      "YuborilmadiTelegram ulanmagan: 20 ta · Botni bloklagan: 3 ta · Boshqa sabab: 2 ta25 ta",
    );
    expect(within(card).queryByTestId("dm-delivery-noProvider")).toBeNull();
    // Tanlangan davr (Toshkent kunlari).
    expect(card).toHaveTextContent("01.10.2026 – 23.10.2026 · Telegram, shaxsiy chat");
  });

  it("sana berilmasa — parametrsiz (backend sukuti 30 kun), davr javobdagi chegaradan", async () => {
    renderWithProviders(<DmDeliveryCard enabled />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("telegram/dm-delivery", { params: {} }));
    // `to` kirmaydi: 2026-10-23T19:00Z dan oldingi lahza — mahalliy (testda UTC) 23.10.
    expect(await screen.findByText(/– 23\.10\.2026 · Telegram, shaxsiy chat/)).toBeInTheDocument();
  });

  it("enabled=false (superadmin emas) — so'rov ham, karta ham yo'q", () => {
    renderWithProviders(<DmDeliveryCard enabled={false} />);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Kvitansiya yetkazilishi" })).toBeNull();
  });

  it("davrda kvitansiya yo'q — bo'sh holat (0% emas)", async () => {
    mocks.get.mockResolvedValue({
      data: { data: { ...REPORT.data, totals: { total: 0, sent: 0, failed: 0, pending: 0, skipped: 0, delivery_ratio: null, reach_ratio: null }, skipped_reasons: {} } },
    });
    renderWithProviders(<DmDeliveryCard enabled />);
    expect(await screen.findByText("Bu davrda kvitansiya yuborilmagan")).toBeInTheDocument();
    expect(screen.queryByText(/0%/)).toBeNull();
  });

  it("hammasi o'tkazib yuborilgan (delivery_ratio null) — spidometr o'rnida izoh, «Qamrov» 0%", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          ...REPORT.data,
          totals: { total: 5, sent: 0, failed: 0, pending: 0, skipped: 5, delivery_ratio: null, reach_ratio: 0 },
          skipped_reasons: { no_telegram_id: 5 },
        },
      },
    });
    renderWithProviders(<DmDeliveryCard enabled />);
    expect(await screen.findByText("Yuborishga urinish bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Kvitansiya yetkazilishi:/ })).toBeNull();
    expect(screen.getByTestId("dm-delivery-reach")).toHaveTextContent("0%");
  });

  it("xato — «Qayta urinish» qayta so'raydi", async () => {
    mocks.get.mockRejectedValueOnce({ isAxiosError: true, response: { status: 500, data: {} } });
    const user = userEvent.setup();
    renderWithProviders(<DmDeliveryCard enabled />);
    expect(await screen.findByText("Yetkazish hisobotini yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  });
});

describe("toDmDeliveryReport", () => {
  it("son bo'lmaganlar 0, nisbat null qoladi, 0 sabablar tashlanadi", () => {
    expect(
      toDmDeliveryReport({ data: { totals: { total: "3", sent: null, delivery_ratio: null, reach_ratio: "0.5" }, skipped_reasons: { a: 0, b: 2 } } }),
    ).toEqual({
      from: null,
      to: null,
      totals: {
        total: 3,
        sent: 0,
        failed: 0,
        pending: 0,
        skipped: 0,
        noProvider: 0,
        other: 0,
        deliveryRatio: null,
        reachRatio: 0.5,
      },
      skippedReasons: { b: 2 },
    });
  });
});
