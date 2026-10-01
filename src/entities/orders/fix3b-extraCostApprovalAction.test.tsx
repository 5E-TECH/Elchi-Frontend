import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import {
  clearPendingExtraCostApproval,
  recordPendingExtraCostApproval,
  resolveOrderActionResponse,
} from "./extraCostApproval";
import {
  ExtraCostApprovalBadge,
  ExtraCostApprovalPendingBanner,
  ExtraCostApprovalSentNote,
} from "./ui/ExtraCostApproval";

/**
 * fix3b M3 — kutilayotgan qo'shimcha xarajat tasdig'i QAYSI amal uchun
 * (sotish / qisman sotish / bekor qilish) ko'rinadi: market aynan shu amalni
 * bajaradi. Javobdagi tasdiq amali yoziladi (eski backend bekor qilish
 * so'ralganda eski SOTISH tasdig'ini qaytarardi).
 */

const readStored = () => JSON.parse(window.localStorage.getItem("extra_cost_pending_approvals") ?? "{}");

describe("resolveOrderActionResponse — tasdiq amali (fix3b M3)", () => {
  afterEach(() => clearPendingExtraCostApproval("o-3"));

  it("javobdagi tasdiq amali yoziladi (so'ralgani emas)", () => {
    resolveOrderActionResponse(
      {
        statusCode: 202,
        data: {
          approval_required: true,
          approval: { id: "a-1", action: "sell", amount: 5000, createdAt: "2026-10-01T09:00:00.000Z" },
        },
      },
      { order: { id: "o-3", status: "waiting" }, action: "cancel", extraCost: 3000, onCompleted: vi.fn(), onApprovalRequested: vi.fn() },
    );

    expect(readStored()["o-3"]).toEqual(expect.objectContaining({ action: "sell", amount: 5000 }));
  });

  it("javobda amal bo'lmasa yoki noma'lum bo'lsa — so'ralgan amal", () => {
    resolveOrderActionResponse(
      { statusCode: 202, data: { approval_required: true, approval: { action: "boshqa", amount: 3000 } } },
      { order: { id: "o-3", status: "waiting" }, action: "cancel", extraCost: 3000, onCompleted: vi.fn(), onApprovalRequested: vi.fn() },
    );

    expect(readStored()["o-3"]).toEqual(expect.objectContaining({ action: "cancel" }));
  });
});

describe("ExtraCostApproval UI — amal ko'rinadi (fix3b M3)", () => {
  afterEach(() => clearPendingExtraCostApproval("o-4"));

  const approval = {
    orderId: "o-4",
    action: "cancel" as const,
    amount: 3000,
    requestedAt: new Date().toISOString(),
    orderStatus: "waiting",
  };

  it("kuryerning eslatmasida amal nomi bor", () => {
    renderWithProviders(<ExtraCostApprovalSentNote approval={approval} />);

    expect(
      screen.getByText(/^Bekor qilish: 3\D?000 so'm qo'shimcha xarajat .* market tasdig'iga yuborilgan$/),
    ).toBeInTheDocument();
  });

  it.each([
    ["sell", "Sotish"],
    ["partly_sell", "Qisman sotish"],
  ] as const)("%s → '%s'", (action, label) => {
    renderWithProviders(<ExtraCostApprovalSentNote approval={{ ...approval, action }} />);

    expect(screen.getByText(new RegExp(`^${label}: `))).toBeInTheDocument();
  });

  it("ro'yxat belgisi sarlavhasida ham amal", () => {
    recordPendingExtraCostApproval({ ...approval, action: "partly_sell" });
    renderWithProviders(<ExtraCostApprovalBadge orderId="o-4" status="waiting" />);

    expect(screen.getByLabelText(/^Qisman sotish: 3\D?000 so'm qo'shimcha xarajat/)).toBeInTheDocument();
  });

  it("kutish banneri so'ralgan amalni ko'rsatadi", () => {
    renderWithProviders(<ExtraCostApprovalPendingBanner amount={5000} action="sell" />);

    expect(screen.getByRole("status")).toHaveTextContent("So'ralgan amal: Sotish");
  });

  it("amalsiz banner avvalgidek", () => {
    renderWithProviders(<ExtraCostApprovalPendingBanner amount={5000} />);

    expect(screen.getByRole("status")).not.toHaveTextContent("So'ralgan amal");
    expect(screen.getByRole("status")).toHaveTextContent("Market tasdig'i kutilmoqda");
  });
});
