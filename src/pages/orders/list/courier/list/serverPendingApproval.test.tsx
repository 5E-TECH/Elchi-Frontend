import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SellModal from "./SellModal";
import CancelModal from "./CancelModal";
import { renderWithProviders } from "../../../../../test/test-utils";
import {
  clearPendingExtraCostApproval,
  recordPendingExtraCostApproval,
} from "../../../../../entities/orders/extraCostApproval";
import { buildActionOrder, normalizeOrderDetail } from "../../../../new_orders/components/detail/orderDetailModel";

/**
 * GykuOz8f: sotish / bekor qilish oynasidagi «so'rov allaqachon market tasdig'iga yuborilgan» ogohlantirishi serverdagi
 * `pending_extra_cost_approval` dan (menejer ro'yxati, buyurtma tafsiloti — boshqa qurilmada ham). Server `null` desa
 * (market rad etdi) — shu qurilmadagi eski ishora e'tiborsiz; maydon umuman kelmasa (skaner) — ishora.
 */

const SENT = /market tasdig'iga yuborilgan$/;
const SERVER_PENDING = {
  id: "77",
  action: "sell",
  amount: 5000,
  created_at: "2026-11-05T08:00:00.000Z",
  auto_approve_at: "2026-11-06T08:00:00.000Z",
};

const order = (pending?: unknown) => ({
  id: "10293",
  status: "waiting",
  total_price: 96000,
  where_deliver: "center",
  market: { name: "Chilonzor Market", extra_cost_requires_approval: true },
  customer: { name: "Sevara Tursunova", phone_number: "+998905621407" },
  district: { name: "Jomboy tumani" },
  items: [],
  ...(pending === undefined ? {} : { pending_extra_cost_approval: pending }),
});

const hint = () =>
  recordPendingExtraCostApproval({
    orderId: "10293",
    action: "sell",
    amount: 3000,
    requestedAt: "2026-11-05T07:00:00.000Z",
    orderStatus: "waiting",
  });

const renderSell = (value: ReturnType<typeof order>) =>
  renderWithProviders(
    <SellModal order={value} open variant="manager" onClose={vi.fn()} onSell={vi.fn()} onPartlySell={vi.fn()} />,
  );

const renderCancel = (value: ReturnType<typeof order>) =>
  renderWithProviders(<CancelModal order={value} open variant="manager" onClose={vi.fn()} onCancel={vi.fn()} />);

describe("Sotish / bekor oynasi — serverdagi kutilayotgan so'rov (GykuOz8f)", () => {
  afterEach(() => clearPendingExtraCostApproval("10293"));

  it("⭐ boshqa qurilma: ishora yo'q, server «kutilmoqda» — ogohlantirish bor", () => {
    renderSell(order(SERVER_PENDING));
    expect(screen.getByText(SENT)).toBeInTheDocument();
  });

  it("⭐ market rad etdi: server `null`, shu qurilmada eski ishora — ogohlantirish yo'q", () => {
    hint();
    renderSell(order(null));
    expect(screen.queryByText(SENT)).not.toBeInTheDocument();
  });

  it("maydon kelmagan javob (skaner) — shu qurilmadagi ishora", () => {
    hint();
    renderSell(order());
    expect(screen.getByText(SENT)).toBeInTheDocument();
  });

  it("bekor qilish oynasi ham server qiymatidan", () => {
    hint();
    const { unmount } = renderCancel(order(null));
    expect(screen.queryByText(SENT)).not.toBeInTheDocument();
    unmount();

    clearPendingExtraCostApproval("10293");
    renderCancel(order(SERVER_PENDING));
    expect(screen.getByText(SENT)).toBeInTheDocument();
  });
});

describe("buildActionOrder — `pending_extra_cost_approval` oynaga o'tadi (GykuOz8f)", () => {
  const detail = (extra: Record<string, unknown>) =>
    normalizeOrderDetail({
      id: "10293",
      status: "waiting",
      total_price: 96000,
      customer: { name: "Sevara", phone_number: "+998905621407" },
      items: [],
      ...extra,
    });

  it("server qiymati (obyekt va `null`) o'zgarmay o'tadi; maydon bo'lmasa — umuman yo'q", () => {
    const withPending = detail({ pending_extra_cost_approval: SERVER_PENDING });
    const withNull = detail({ pending_extra_cost_approval: null });
    const without = detail({});

    expect(withPending && buildActionOrder(withPending)).toMatchObject({ pending_extra_cost_approval: SERVER_PENDING });
    expect(withNull && buildActionOrder(withNull)).toMatchObject({ pending_extra_cost_approval: null });
    expect(without && buildActionOrder(without)).not.toHaveProperty("pending_extra_cost_approval");
  });
});
