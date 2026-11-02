import { describe, expect, it } from "vitest";
import { getPostOrderLocation, isHistoryView, isInPostNow } from "./postHistory";

/** Pochta tarixi (backend #618) — `in_post_now`, «hozir qayerda» va javob ko'rinishi. */

describe("isInPostNow", () => {
  it("kalit yo'q yoki null — joriy a'zo; faqat aniq false — sobiq a'zo", () => {
    expect(isInPostNow({})).toBe(true);
    expect(isInPostNow({ in_post_now: null })).toBe(true);
    expect(isInPostNow({ in_post_now: true })).toBe(true);
    expect(isInPostNow({ in_post_now: false })).toBe(false);
  });
});

describe("getPostOrderLocation", () => {
  it("joriy a'zo — shu pochtada (ko'rsatkichlardan qat'i nazar)", () => {
    expect(getPostOrderLocation({ in_post_now: true, current_post_id: "99" }, "78")).toEqual({ kind: "here" });
    expect(getPostOrderLocation({ current_canceled_post_id: "120" }, "78")).toEqual({ kind: "here" });
  });

  it("avval qaytarish pochtasi, keyin oddiy pochta", () => {
    expect(
      getPostOrderLocation({ in_post_now: false, current_canceled_post_id: "120", current_post_id: "99" }, "78"),
    ).toEqual({ kind: "return", postId: "120" });
    expect(getPostOrderLocation({ in_post_now: false, current_post_id: "99" }, "78")).toEqual({
      kind: "post",
      postId: "99",
    });
  });

  it("current_* yo'q — post_id / canceled_post_id zaxira; raqamli id ham matnga", () => {
    expect(getPostOrderLocation({ in_post_now: false, canceled_post_id: "121", post_id: "99" }, 78)).toEqual({
      kind: "return",
      postId: "121",
    });
    expect(
      getPostOrderLocation({ in_post_now: false, post_id: 99 as unknown as string }, "78"),
    ).toEqual({ kind: "post", postId: "99" });
  });

  it("qaytarish ko'rsatkichi shu pochtaning o'zi — o'tkazib yuboriladi", () => {
    expect(
      getPostOrderLocation({ in_post_now: false, current_canceled_post_id: "78", current_post_id: "99" }, "78"),
    ).toEqual({ kind: "post", postId: "99" });
  });

  it("current_post_id shu pochtaning o'zi — shu pochtada", () => {
    expect(getPostOrderLocation({ in_post_now: false, current_post_id: " 78 " }, 78)).toEqual({ kind: "here" });
  });

  it("ko'rsatkichlar yo'q yoki bo'sh — pochtada emas", () => {
    expect(getPostOrderLocation({ in_post_now: false }, "78")).toEqual({ kind: "none" });
    expect(
      getPostOrderLocation({ in_post_now: false, current_post_id: null, current_canceled_post_id: null }, "78"),
    ).toEqual({ kind: "none" });
    expect(getPostOrderLocation({ in_post_now: false, current_post_id: "  ", post_id: "99" }, "78")).toEqual({
      kind: "none",
    });
  });
});

describe("isHistoryView", () => {
  it("faqat view: 'all' — tarix; kalit yo'q — joriy javob", () => {
    expect(isHistoryView({ view: "all" })).toBe(true);
    expect(isHistoryView({ view: "current" })).toBe(false);
    expect(isHistoryView({})).toBe(false);
    expect(isHistoryView(null)).toBe(false);
    expect(isHistoryView(undefined)).toBe(false);
  });
});
