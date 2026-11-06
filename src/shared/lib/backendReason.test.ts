import { describe, expect, it } from "vitest";
import { getBackendReason, readBackendRejection } from "./backendReason";

/** Gateway rad javobi: `{ statusCode, message, data: { reason, details } }` (anKpzwxk, #620/#621). */
const rejection = (status: number, body: Record<string, unknown>) => ({
  isAxiosError: true,
  message: `Request failed with status code ${status}`,
  response: { status, data: { statusCode: status, ...body } },
});

describe("readBackendRejection", () => {
  it.each([
    [403, "order_not_in_your_branch"],
    [403, "branch_not_assigned"],
    [503, "branch_scope_unavailable"],
    [403, "post_not_visible_to_courier"],
    [403, "new_posts_hq_only"],
    [403, "post_receive_manager_only"],
    [409, "order_in_outgoing_batch"],
    [403, "hq_courier_region_only"],
    [400, "branch_region_missing"],
    [400, "region_mismatch"],
    [403, "district_not_served_by_branch"],
  ])("%s %s — sabab va holat kodi o'qiladi", (status, reason) => {
    const result = readBackendRejection(rejection(status, { message: "Matn", data: { reason } }));
    expect(result.status).toBe(status);
    expect(result.reason).toBe(reason);
    expect(result.message).toBe("Matn");
  });

  it("id'lar — avval details.order_ids (satrga aylantiriladi, takrorsiz), message dagi ro'yxat emas", () => {
    const result = readBackendRejection(
      rejection(409, {
        message: "Boshqa viloyat buyurtmasi — bu filialga jo'natilmaydi: #1, #2",
        data: { reason: "district_not_served_by_branch", details: { order_ids: [12, "13", 12, null, ""], district_ids: [7, "8"] } },
      }),
    );
    expect(result.orderIds).toEqual(["12", "13"]);
    expect(result.districtIds).toEqual(["7", "8"]);
  });

  it("details.order_ids yo'q — message dagi #id / №id olinadi", () => {
    const result = readBackendRejection(
      rejection(403, {
        message: "Boshqa viloyat buyurtmasi — kuryerga berilmaydi: #12, №13, # 14",
        data: { reason: "district_not_served_by_branch" },
      }),
    );
    expect(result.orderIds).toEqual(["12", "13", "14"]);
  });

  it("50 talik cheklov: details dagi 50 ta id saqlanadi, message dagi «va yana N ta» aralashmaydi", () => {
    const ids = Array.from({ length: 50 }, (_, index) => 100 + index);
    const message = `Buyurtma chiquvchi partiyada — kuryerga berilmaydi: ${ids.slice(0, 10).map((id) => `#${id}`).join(", ")} va yana 70 ta`;
    const result = readBackendRejection(
      rejection(409, { message, data: { reason: "order_in_outgoing_batch", details: { order_ids: ids } } }),
    );
    expect(result.orderIds).toHaveLength(50);
    expect(result.orderIds[0]).toBe("100");
    expect(result.orderIds).not.toContain("70");
  });

  it("details.missing — faqat satrlar", () => {
    const result = readBackendRejection(
      rejection(400, {
        message: "Jo'natib bo'lmaydi",
        data: { reason: "branch_region_missing", details: { missing: ["destination_branch_region", 3, "post_region"], post_id: 5 } },
      }),
    );
    expect(result.missing).toEqual(["destination_branch_region", "post_region"]);
    expect(result.details.post_id).toBe(5);
  });

  it("sababsiz 403 — reason null, matn saqlanadi", () => {
    const result = readBackendRejection(rejection(403, { message: "Siz bu branch pochtasini qabul qila olmaysiz" }));
    expect(result).toMatchObject({ status: 403, reason: null, message: "Siz bu branch pochtasini qabul qila olmaysiz", orderIds: [] });
  });

  it("shakli noto'g'ri sabab (katta harf, bo'shliq, ob'ekt) — null", () => {
    expect(getBackendReason(rejection(403, { data: { reason: "ORDER_NOT_FOUND" } }))).toBeNull();
    expect(getBackendReason(rejection(403, { data: { reason: "bad reason" } }))).toBeNull();
    expect(getBackendReason(rejection(403, { data: { reason: { code: "x" } } }))).toBeNull();
  });

  it("axios bo'lmagan xato — hammasi bo'sh, JS xato matni chiqmaydi", () => {
    expect(readBackendRejection(new Error("boom"))).toEqual({
      status: null,
      reason: null,
      message: null,
      details: {},
      orderIds: [],
      districtIds: [],
      missing: [],
    });
    expect(readBackendRejection(null).reason).toBeNull();
    expect(readBackendRejection("x").message).toBeNull();
  });

  it("javobsiz axios xatosi (tarmoq) — axios matni («Network Error») message emas", () => {
    const result = readBackendRejection({ isAxiosError: true, message: "Network Error", code: "ERR_NETWORK" });
    expect(result.message).toBeNull();
    expect(result.status).toBeNull();
  });
});
