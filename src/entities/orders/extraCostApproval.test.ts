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
import { toastStore } from "../../shared/lib/notify";

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

  it("⭐ SPEC v2: deferred extra cost (`data.extra_cost_request`, mode deferred) — the action is DONE: modal closes, info toast", () => {
    recordPendingExtraCostApproval({ orderId: "o-2", action: "sell", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    const onCompleted = vi.fn();
    const onApprovalRequested = vi.fn();

    resolveOrderActionResponse(
      {
        statusCode: 201,
        data: {
          id: "o-2",
          status: "sold",
          extra_cost_request: {
            id: "xc-1",
            status: "pending",
            mode: "deferred",
            action: "sell",
            amount: 20000,
            items: [
              { order_item_id: "i-1", product_id: "p-1", product_name: "Telefon g'ilofi", quantity: 1 },
              { order_item_id: "i-2", product_id: "p-2", product_name: "Zaryadka", quantity: 2 },
            ],
            auto_approve_at: "2026-11-13T09:00:00.000Z",
            created_at: "2026-11-12T09:00:00.000Z",
          },
        },
      },
      { order: { id: "o-2", status: "waiting" }, action: "sell", extraCost: 20000, onCompleted, onApprovalRequested },
    );

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onApprovalRequested).not.toHaveBeenCalled();
    // Kutish ishorasi yo'q — 30 s lik tasdiq pollingi ham yo'q.
    expect(getPendingExtraCostApprovalHints()["o-2"]).toBeUndefined();
    expect(pollWhileApprovalPending([{ id: "o-2", status: "sold", pending_extra_cost_approval: null }])).toBe(false);
    const toasts = toastStore.getSnapshot();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toEqual(
      expect.objectContaining({ tone: "info", message: expect.stringMatching(/^20\D000 so'm qo'shimcha xarajat market tasdig'ini kutmoqda$/) }),
    );
    expect(String(toasts[0].description)).toMatch(/^Mahsulotlar: Telefon g'ilofi ×1, Zaryadka ×2\. Naqdni to'liq topshiring/);
  });

  it("an ordinary completion (no extra cost request) shows no extra-cost toast", () => {
    resolveOrderActionResponse({ statusCode: 201, data: { id: "o-2", extra_cost_request: null } }, {
      order: { id: "o-2", status: "waiting" },
      action: "cancel",
      extraCost: 0,
      onCompleted: vi.fn(),
      onApprovalRequested: vi.fn(),
    });

    expect(toastStore.getSnapshot()).toHaveLength(0);
  });

  it("the legacy 202 envelope still wins over a deferred field (replay rows keep the waiting view)", () => {
    const onCompleted = vi.fn();
    const onApprovalRequested = vi.fn();

    resolveOrderActionResponse(
      { statusCode: 202, data: { approval_required: true, extra_cost_request: { id: "x", status: "pending", mode: "deferred", amount: 1 } } },
      { order: { id: "o-2", status: "waiting" }, action: "sell", extraCost: 1, onCompleted, onApprovalRequested },
    );

    expect(onCompleted).not.toHaveBeenCalled();
    expect(onApprovalRequested).toHaveBeenCalledTimes(1);
    expect(toastStore.getSnapshot()).toHaveLength(0);
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
