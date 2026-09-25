import { vi } from "vitest";
import {
  EXTRA_COST_APPROVAL_POLL_MS,
  clearPendingExtraCostApproval,
  getActivePendingApproval,
  isExtraCostApprovalResponse,
  pollWhileApprovalPending,
  recordPendingExtraCostApproval,
  resolveOrderActionResponse,
} from "./extraCostApproval";

const approvalResponse = {
  statusCode: 202,
  message: "Market tasdig'i kutilmoqda",
  data: {
    approval_required: true,
    approval: { id: "a-1", action: "sell", amount: 5000, status: "pending", createdAt: "2026-09-25T09:30:00.000Z" },
  },
};

const readStored = () => JSON.parse(window.localStorage.getItem("extra_cost_pending_approvals") ?? "{}");

describe("extra cost approval", () => {
  afterEach(() => {
    ["o-1", "o-2", "o-old"].forEach(clearPendingExtraCostApproval);
  });

  it("recognises the backend's approval envelope even though HTTP status is 201", () => {
    expect(isExtraCostApprovalResponse(approvalResponse)).toBe(true);
    expect(isExtraCostApprovalResponse({ statusCode: 201, data: { approval_required: true } })).toBe(true);
    expect(isExtraCostApprovalResponse({ statusCode: 200, data: { id: "o-1", status: "sold" } })).toBe(false);
    expect(isExtraCostApprovalResponse(undefined)).toBe(false);
  });

  it("keeps the modal open and remembers the order when approval is required", () => {
    const onCompleted = vi.fn();
    const onApprovalRequested = vi.fn();

    resolveOrderActionResponse(approvalResponse, {
      order: { id: "o-1", status: "waiting" },
      action: "sell",
      extraCost: 5000,
      onCompleted,
      onApprovalRequested,
    });

    expect(onApprovalRequested).toHaveBeenCalledTimes(1);
    expect(onCompleted).not.toHaveBeenCalled();
    expect(readStored()["o-1"]).toEqual({
      orderId: "o-1",
      action: "sell",
      amount: 5000,
      requestedAt: "2026-09-25T09:30:00.000Z",
      orderStatus: "waiting",
    });
  });

  it("closes the modal and forgets a previous request when the action completes (extraCost 0)", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "sell", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    const onCompleted = vi.fn();
    const onApprovalRequested = vi.fn();

    resolveOrderActionResponse({ statusCode: 200, data: { id: "o-1" } }, {
      order: { id: "o-1", status: "waiting" },
      action: "sell",
      extraCost: 0,
      onCompleted,
      onApprovalRequested,
    });

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onApprovalRequested).not.toHaveBeenCalled();
    expect(readStored()["o-1"]).toBeUndefined();
  });

  it("treats a request as active only while the order keeps the status it had when sent", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "cancel", amount: 3000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    const approvals = readStored();

    expect(getActivePendingApproval(approvals, { id: "o-1", status: "waiting" })).toBeDefined();
    expect(getActivePendingApproval(approvals, { id: "o-1", status: "cancelled" })).toBeUndefined();
  });

  it("polls the list only while a visible order is waiting for approval", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "sell", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });

    expect(pollWhileApprovalPending([{ id: "o-1", status: "waiting" }, { id: "o-2", status: "waiting" }])).toBe(EXTRA_COST_APPROVAL_POLL_MS);
    expect(pollWhileApprovalPending([{ id: "o-1", status: "sold" }])).toBe(false);
    expect(pollWhileApprovalPending([{ id: "o-2", status: "waiting" }])).toBe(false);
  });

  it("drops requests older than three days on load (a rejection is never reported back)", async () => {
    const old = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    window.localStorage.setItem(
      "extra_cost_pending_approvals",
      JSON.stringify({
        "o-old": { orderId: "o-old", action: "sell", amount: 1000, requestedAt: old, orderStatus: "waiting" },
        "o-2": { orderId: "o-2", action: "sell", amount: 1000, requestedAt: recent, orderStatus: "waiting" },
      }),
    );
    vi.resetModules();
    const reloaded = await import("./extraCostApproval");

    expect(reloaded.pollWhileApprovalPending([{ id: "o-old", status: "waiting" }])).toBe(false);
    expect(reloaded.pollWhileApprovalPending([{ id: "o-2", status: "waiting" }])).toBe(EXTRA_COST_APPROVAL_POLL_MS);
    window.localStorage.removeItem("extra_cost_pending_approvals");
  });
});
