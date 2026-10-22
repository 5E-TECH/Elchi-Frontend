import { screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { DetailHeader } from "./DetailHeader";
import { normalizeOrderDetail } from "./orderDetailModel";

/**
 * kH2zZsz3 — yaratilgan sana Asia/Tashkent zonasida: brauzer (qurilma) zonasi UTC bo'lsa ham kun siljimaydi.
 * №54: `createdAt 2026-10-16T21:34:26Z` — Toshkentda 17.10.2026, 02:34 (tarixdagi bilan bir xil).
 * Sana maketdagidek sarlavhada («Yaratilgan: …») ko'rsatiladi.
 */
vi.mock("../../../../shared/api/api", () => ({ api: { get: vi.fn(() => new Promise(() => {})) } }));

const ORDER_54 = {
  id: "54",
  status: "new",
  createdAt: "2026-10-16T21:34:26.000Z",
  market: { id: "37", name: "TEST market", phone_number: "+998901112233" },
};

describe("Yaratilgan sana — Toshkent zonasi (UTC qurilmada)", () => {
  const hostZone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "UTC";
  });

  afterAll(() => {
    if (hostZone === undefined) delete process.env.TZ;
    else process.env.TZ = hostZone;
  });

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-10-19T09:00:00.000Z"), toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("test muhiti haqiqatan UTC zonasida (aks holda tekshiruv ma'nosiz)", () => {
    expect(new Date("2026-10-16T21:34:26.000Z").getDate()).toBe(16);
  });

  it("⭐ sarlavha: «Yaratilgan: 17.10.2026, 02:34» — 16.10 21:34 (brauzer zonasi) emas", () => {
    const order = normalizeOrderDetail(ORDER_54);
    renderWithProviders(<DetailHeader orderId="54" order={order} layout="default" onBack={vi.fn()} />);

    expect(screen.getByText("17.10.2026, 02:34")).toBeInTheDocument();
    expect(screen.queryByText(/16\.10\.2026/)).not.toBeInTheDocument();
  });

});
