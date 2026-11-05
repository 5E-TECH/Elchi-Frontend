import { vi } from "vitest";
import {
  EXTRA_COST_APPROVAL_POLL_MS,
  clearPendingExtraCostApproval,
  getActivePendingApproval,
  getPendingExtraCostApprovalHints,
  getRequestedApproval,
  isExtraCostApprovalResponse,
  pollWhileApprovalPending,
  readServerPendingApproval,
  recordPendingExtraCostApproval,
  resolveOrderActionResponse,
} from "./extraCostApproval";

const approvalResponse = {
  statusCode: 202,
  message: "Market tasdig'i kutilmoqda",
  data: {
    approval_required: true,
    approval: {
      id: "a-1",
      action: "sell",
      amount: 5000,
      status: "pending",
      createdAt: "2026-09-25T09:30:00.000Z",
      auto_approve_at: "2026-09-26T09:30:00.000Z",
    },
  },
};

const SERVER_PENDING = {
  id: "ap-9",
  action: "cancel",
  amount: 7000,
  created_at: "2026-11-05T08:00:00.000Z",
  auto_approve_at: "2026-11-06T08:00:00.000Z",
};

const LEGACY_KEY = "extra_cost_pending_approvals";

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

  it("keeps the modal open and remembers the order in memory (never in localStorage) when approval is required", () => {
    const onCompleted = vi.fn();
    const onApprovalRequested = vi.fn();
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    resolveOrderActionResponse(approvalResponse, {
      order: { id: "o-1", status: "waiting" },
      action: "sell",
      extraCost: 5000,
      onCompleted,
      onApprovalRequested,
    });

    expect(onApprovalRequested).toHaveBeenCalledTimes(1);
    expect(onCompleted).not.toHaveBeenCalled();
    expect(getPendingExtraCostApprovalHints()["o-1"]).toEqual({
      orderId: "o-1",
      action: "sell",
      amount: 5000,
      requestedAt: "2026-09-25T09:30:00.000Z",
      orderStatus: "waiting",
      id: "a-1",
      autoApproveAt: "2026-09-26T09:30:00.000Z",
    });
    // GykuOz8f: kutilayotgan so'rov endi qurilmada saqlanmaydi — manba server.
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
    setItem.mockRestore();
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
    expect(getPendingExtraCostApprovalHints()["o-1"]).toBeUndefined();
  });

  it("without the server field (old response) a hint is active only while the order keeps the status it had when sent", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "cancel", amount: 3000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    const approvals = getPendingExtraCostApprovalHints();

    expect(getActivePendingApproval(approvals, { id: "o-1", status: "waiting" })).toBeDefined();
    expect(getActivePendingApproval(approvals, { id: "o-1", status: "cancelled" })).toBeUndefined();
  });

  it("⭐ server wins: `pending_extra_cost_approval: null` hides a local hint, an object shows on any device", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "sell", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    const approvals = getPendingExtraCostApprovalHints();

    // Market rad etdi (yoki boshqa joyda hal qilindi) — server `null`: belgi darhol yo'qoladi.
    expect(getActivePendingApproval(approvals, { id: "o-1", status: "waiting", pending_extra_cost_approval: null })).toBeUndefined();
    // Boshqa qurilmada yozilgan so'rov — shu qurilmada ishora yo'q, server obyekti bor.
    expect(getActivePendingApproval({}, { id: "o-2", status: "waiting", pending_extra_cost_approval: SERVER_PENDING })).toEqual({
      orderId: "o-2",
      action: "cancel",
      amount: 7000,
      requestedAt: "2026-11-05T08:00:00.000Z",
      orderStatus: "waiting",
      id: "ap-9",
      autoApproveAt: "2026-11-06T08:00:00.000Z",
    });
  });

  it("the awaiting view prefers the fresh local request, then the server value", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "sell", amount: 5000, requestedAt: "2026-11-05T09:00:00.000Z", orderStatus: "waiting" });
    const approvals = getPendingExtraCostApprovalHints();

    expect(getRequestedApproval(approvals, { id: "o-1", status: "waiting", pending_extra_cost_approval: null })).toMatchObject({ amount: 5000 });
    expect(getRequestedApproval(approvals, { id: "o-2", status: "waiting", pending_extra_cost_approval: SERVER_PENDING })).toMatchObject({ amount: 7000, action: "cancel" });
    expect(getRequestedApproval(approvals, null)).toBeUndefined();
  });

  it("reads the server field: absent → undefined, null/garbage → null, numbers normalised", () => {
    expect(readServerPendingApproval(undefined)).toBeUndefined();
    expect(readServerPendingApproval(null)).toBeNull();
    expect(readServerPendingApproval("x")).toBeNull();
    expect(readServerPendingApproval({ id: 5, action: "sell", amount: "1500", created_at: "2026-11-05T08:00:00.000Z", auto_approve_at: null })).toEqual({
      id: "5",
      action: "sell",
      amount: 1500,
      created_at: "2026-11-05T08:00:00.000Z",
      auto_approve_at: null,
    });
  });

  it("polls the list only while a visible order is waiting for approval (server field or local hint)", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "sell", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });

    expect(pollWhileApprovalPending([{ id: "o-1", status: "waiting" }, { id: "o-2", status: "waiting" }])).toBe(EXTRA_COST_APPROVAL_POLL_MS);
    expect(pollWhileApprovalPending([{ id: "o-1", status: "sold" }])).toBe(false);
    expect(pollWhileApprovalPending([{ id: "o-2", status: "waiting" }])).toBe(false);
    expect(pollWhileApprovalPending([{ id: "o-2", status: "waiting", pending_extra_cost_approval: SERVER_PENDING }])).toBe(EXTRA_COST_APPROVAL_POLL_MS);
    expect(pollWhileApprovalPending([{ id: "o-1", status: "waiting", pending_extra_cost_approval: null }])).toBe(false);
  });

  it("⭐ onlyHinted (open dialog, non-requester roles): a server-pending order without this device's hint does not poll", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "sell", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    const others = [{ id: "o-2", status: "waiting", pending_extra_cost_approval: SERVER_PENDING }];

    expect(pollWhileApprovalPending(others, { onlyHinted: true })).toBe(false);
    expect(pollWhileApprovalPending(others, { onlyHinted: false })).toBe(EXTRA_COST_APPROVAL_POLL_MS);
    // Shu qurilma yuborgan so'rov — server hali kutilmoqda deydi.
    expect(
      pollWhileApprovalPending([{ id: "o-1", status: "waiting", pending_extra_cost_approval: SERVER_PENDING }], { onlyHinted: true }),
    ).toBe(EXTRA_COST_APPROVAL_POLL_MS);
    // Server «yo'q» desa (rad etildi) — ishora bo'lsa ham polling yo'q.
    expect(pollWhileApprovalPending([{ id: "o-1", status: "waiting", pending_extra_cost_approval: null }], { onlyHinted: true })).toBe(false);
  });

  it("⭐ the old localStorage list is removed on load and never read (a rejection used to hang there for 3 days)", async () => {
    window.localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        "o-old": { orderId: "o-old", action: "sell", amount: 1000, requestedAt: new Date().toISOString(), orderStatus: "waiting" },
      }),
    );
    vi.resetModules();
    const reloaded = await import("./extraCostApproval");

    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(reloaded.getPendingExtraCostApprovalHints()).toEqual({});
    expect(reloaded.pollWhileApprovalPending([{ id: "o-old", status: "waiting" }])).toBe(false);
  });
});
