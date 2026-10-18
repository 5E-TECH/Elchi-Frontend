import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { AutoApprovedExtraCosts } from "./AutoApprovedExtraCosts";

/**
 * 1tnpaIqd (ega qarori) — avtomatik tasdiqlangan qo'shimcha xarajatlar market dashboardida alohida
 * filtrda (`status=approved&auto_approved=true`), «Avtomatik tasdiqlangan» belgisi bilan. Bo'sh — blok yo'q.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: http.get, post: http.post },
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const autoApproved = (id: string, orderId: string, extra: Record<string, unknown> = {}) => ({
  id,
  order_id: orderId,
  market_id: "37",
  requested_by_user_id: "26",
  requested_by_role: "courier",
  action: "sell",
  amount: 3000,
  status: "approved",
  decided_by_user_id: null,
  decided_at: "2026-10-17T13:12:00.000Z",
  auto_approved: true,
  auto_approve_at: null,
  ...extra,
});

const response = (items: unknown[]) => ({ data: { statusCode: 200, data: items } });

const renderBlock = () =>
  renderWithProviders(<AutoApprovedExtraCosts />, {
    preloadedState: { role: { id: "37", role: "market", region: null, name: "Market" } },
  });

describe("AutoApprovedExtraCosts", () => {
  beforeEach(() => {
    http.get.mockReset();
  });

  it("⭐ alohida filtr bilan so'raydi va har yozuvda «Avtomatik tasdiqlangan» belgisi", async () => {
    http.get.mockResolvedValue(response([autoApproved("ap-9", "76"), autoApproved("ap-8", "77", { action: "cancel" })]));
    renderBlock();

    const list = await screen.findByRole("list", { name: "Avtomatik tasdiqlangan so'rovlar" });
    expect(http.get).toHaveBeenCalledWith("orders/extra-cost-approvals", {
      params: { status: "approved", auto_approved: true },
    });
    expect(screen.getByRole("region", { name: "Avtomatik tasdiqlangan xarajatlar" })).toHaveTextContent("2 ta");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    const sell = screen.getByRole("listitem", { name: "Sotishdagi qo'shimcha xarajat, buyurtma №76" });
    expect(within(sell).getByRole("link", { name: "№76" })).toHaveAttribute("href", "/orders/edit/76");
    expect(within(sell).getByText("3 000 so'm")).toBeInTheDocument();
    expect(within(sell).getByText("Avtomatik tasdiqlangan")).toHaveAttribute("data-auto-approved", "true");
    expect(within(sell).getByText(/da tasdiqlangan$/)).toBeInTheDocument();
    // Faqat ko'rish — qaror tugmalari yo'q.
    expect(within(list).queryByRole("button")).not.toBeInTheDocument();
  });

  it("yozuv yo'q (avtomatik tasdiq o'chiq) — blok chizilmaydi", async () => {
    http.get.mockResolvedValue(response([]));
    const { container } = renderBlock();
    await waitFor(() => expect(http.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("qo'lda tasdiqlangan yozuv (auto_approved=false) ko'rsatilmaydi", async () => {
    http.get.mockResolvedValue(response([autoApproved("ap-1", "53", { auto_approved: false })]));
    const { container } = renderBlock();
    await waitFor(() => expect(http.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
