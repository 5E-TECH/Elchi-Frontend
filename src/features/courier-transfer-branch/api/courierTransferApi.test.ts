import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock("../../../shared/api/instance", () => ({
  api: { get: mocks.get, patch: mocks.patch },
}));

import { API_ENDPOINTS } from "../../../shared/api";
import { LONG_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";
import {
  getCourierTransferCheck,
  normalizeCourierTransferCheck,
  transferCourierToBranch,
} from "./courierTransferApi";

// Shartnoma §1: GET /couriers/:id/transfer-check javobining `data` qismi.
const CLEAN_CHECK = {
  user_id: "263",
  current_branch: { id: "1", name: "Bosh ofis", type: "HQ" },
  hq_branch: { id: "1", name: "Bosh ofis" },
  has_cashbox: true,
  balance: 0,
  balance_cash: 0,
  balance_card: 0,
  pending_settlement_count: 0,
  pending_settlement_amount: 0,
  carry_amount: 0,
  orders_in_hand: 0,
  orders_sample: [],
  open_return_posts: 0,
  return_posts_sample: [],
  pending_extra_cost_approvals: 0,
  reasons: [],
  can_transfer: true,
};

describe("courier transfer endpoints", () => {
  it("points at the new gateway routes", () => {
    expect(API_ENDPOINTS.COURIERS.TRANSFER_CHECK("263")).toBe("couriers/263/transfer-check");
    expect(API_ENDPOINTS.COURIERS.BRANCH(263)).toBe("couriers/263/branch");
  });
});

describe("normalizeCourierTransferCheck", () => {
  it("keeps a clean check transferable", () => {
    expect(normalizeCourierTransferCheck(CLEAN_CHECK)).toEqual({
      userId: "263",
      currentBranch: { id: "1", name: "Bosh ofis", type: "HQ" },
      hqBranch: { id: "1", name: "Bosh ofis" },
      balance: 0,
      ordersInHand: 0,
      ordersSample: [],
      openReturnPosts: 0,
      pendingSettlementCount: 0,
      reasons: [],
      canTransfer: true,
    });
  });

  it("turns string numbers into numbers and ids into strings", () => {
    const result = normalizeCourierTransferCheck({
      ...CLEAN_CHECK,
      user_id: 263,
      current_branch: { id: 15, name: "Sirdaryo", type: "regional" },
      balance: "150000.50",
      orders_in_hand: "7",
      orders_sample: [
        { id: 101, status: "on the road" },
        { id: "102", status: "waiting" },
      ],
      open_return_posts: "2",
      pending_settlement_count: "3",
      reasons: ["kuryer qo'lida 150 000,50 so'm pul bor"],
      can_transfer: false,
    });

    expect(result).toMatchObject({
      userId: "263",
      currentBranch: { id: "15", name: "Sirdaryo", type: "REGIONAL" },
      balance: 150000.5,
      ordersInHand: 7,
      ordersSample: [
        { id: "101", status: "on the road" },
        { id: "102", status: "waiting" },
      ],
      openReturnPosts: 2,
      pendingSettlementCount: 3,
      canTransfer: false,
    });
  });

  it("treats missing reasons as [] and missing can_transfer as not transferable", () => {
    const withoutVerdict: Record<string, unknown> = { ...CLEAN_CHECK };
    delete withoutVerdict.can_transfer;
    delete withoutVerdict.reasons;

    const result = normalizeCourierTransferCheck(withoutVerdict);

    expect(result.reasons).toEqual([]);
    expect(result.canTransfer).toBe(false);
  });

  it("never allows the move when reasons are present, even if can_transfer is true", () => {
    const result = normalizeCourierTransferCheck({
      ...CLEAN_CHECK,
      reasons: ["kuryer qo'lida 1 ta yakunlanmagan buyurtma bor (#101)"],
      can_transfer: true,
    });

    expect(result.canTransfer).toBe(false);
    expect(result.reasons).toEqual(["kuryer qo'lida 1 ta yakunlanmagan buyurtma bor (#101)"]);
  });

  it("drops non-string reasons but still refuses the move (fail closed)", () => {
    const result = normalizeCourierTransferCheck({
      ...CLEAN_CHECK,
      reasons: [42, null, "  ", "kuryer kassasi manfiy (-5 000 so'm)"],
      can_transfer: true,
    });

    expect(result.reasons).toEqual(["kuryer kassasi manfiy (-5 000 so'm)"]);
    expect(result.canTransfer).toBe(false);

    const onlyJunk = normalizeCourierTransferCheck({
      ...CLEAN_CHECK,
      reasons: [42],
      can_transfer: true,
    });
    expect(onlyJunk.reasons).toEqual([]);
    expect(onlyJunk.canTransfer).toBe(false);
  });

  it("keeps a missing branch as null (orphan courier, no HQ)", () => {
    const result = normalizeCourierTransferCheck({
      ...CLEAN_CHECK,
      current_branch: null,
      hq_branch: { name: "id yo'q" },
    });

    expect(result.currentBranch).toBeNull();
    expect(result.hqBranch).toBeNull();
  });

  it("maps an unknown branch type to null", () => {
    const result = normalizeCourierTransferCheck({
      ...CLEAN_CHECK,
      current_branch: { id: "9", name: "Noma'lum", type: "CITY" },
    });

    expect(result.currentBranch).toEqual({ id: "9", name: "Noma'lum", type: null });
  });

  it("returns a non-transferable empty check for a malformed reply", () => {
    [undefined, null, "xato", 42, []].forEach((raw) => {
      const result = normalizeCourierTransferCheck(raw);
      expect(result.canTransfer).toBe(false);
      expect(result.reasons).toEqual([]);
      expect(result.balance).toBe(0);
      expect(result.currentBranch).toBeNull();
    });
  });
});

describe("getCourierTransferCheck / transferCourierToBranch", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.patch.mockReset();
  });

  it("reads the check from the response envelope", async () => {
    mocks.get.mockResolvedValue({
      data: { statusCode: 200, message: "Kuryer o'tkazish tekshiruvi", data: CLEAN_CHECK },
    });

    const result = await getCourierTransferCheck("263");

    expect(mocks.get).toHaveBeenCalledWith("couriers/263/transfer-check");
    expect(result.canTransfer).toBe(true);
    expect(result.hqBranch).toEqual({ id: "1", name: "Bosh ofis" });
  });

  it("sends only branch_id with the long request timeout", async () => {
    const body = {
      statusCode: 200,
      message: "Kuryer 'Sirdaryo' filialiga o'tkazildi",
      data: { user_id: "263", from_branch_id: "1", to_branch_id: "15", region_id: "12" },
    };
    mocks.patch.mockResolvedValue({ data: body });

    const result = await transferCourierToBranch("263", "15");

    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(mocks.patch).toHaveBeenCalledWith(
      "couriers/263/branch",
      { branch_id: "15" },
      { timeout: LONG_REQUEST_TIMEOUT_MS },
    );
    expect(LONG_REQUEST_TIMEOUT_MS).toBe(120000);
    expect(result).toEqual(body);
  });
});
