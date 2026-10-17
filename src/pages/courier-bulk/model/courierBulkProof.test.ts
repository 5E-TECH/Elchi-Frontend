import { describe, expect, it } from "vitest";
import {
  getCourierBulkProofKey,
  hasAllCourierBulkProofs,
  isCourierBulkProofRequired,
  runLimited,
  splitCourierBulkTasksByProof,
  summarizeCourierBulkResults,
} from "./courierBulk";

/** j9KFyqlS — ommaviy yopishda isbot: ajratish, natijani buyurtmaga bog'lash, parallellik. */

const order = (id: string, conditions: string[] | null, total_price: unknown = 100000) => ({
  id,
  total_price,
  market: { expense_proof_conditions: conditions },
});

describe("isCourierBulkProofRequired", () => {
  it("amalga mos shart: sotish — sell_*, bekor qilish — cancel_*", () => {
    expect(isCourierBulkProofRequired(order("1", ["sell_any"]), "sold")).toBe(true);
    expect(isCourierBulkProofRequired(order("1", ["sell_any"]), "cancel")).toBe(false);
    expect(isCourierBulkProofRequired(order("1", ["cancel_any", "sell_any"]), "cancel")).toBe(true);
    expect(isCourierBulkProofRequired(order("1", null), "sold")).toBe(false);
  });

  it("ommaviy yopishda xarajat yo'q — *_extra_cost talab qilinmaydi; 0 summa — *_zero_total", () => {
    expect(isCourierBulkProofRequired(order("1", ["sell_extra_cost"]), "sold")).toBe(false);
    expect(isCourierBulkProofRequired(order("1", ["sell_zero_total"], 0), "sold")).toBe(true);
    expect(isCourierBulkProofRequired(order("1", ["cancel_zero_total"], "0"), "cancel")).toBe(true);
    // Summa noma'lum — taxmin qilinmaydi.
    expect(isCourierBulkProofRequired(order("1", ["sell_zero_total"], undefined), "sold")).toBe(false);
  });
});

describe("splitCourierBulkTasksByProof", () => {
  it("isbotlilar va qolganlari, tartib saqlanadi", () => {
    const tasks = [
      { order: order("1", ["sell_any"]), action: "sold" as const },
      { order: order("2", ["sell_any"]), action: "cancel" as const },
      { order: order("3", null), action: "sold" as const },
      { order: order("4", ["cancel_any"]), action: "cancel" as const },
    ];
    const { proofTasks, plainTasks } = splitCourierBulkTasksByProof(tasks);
    expect(proofTasks.map((task) => task.order.id)).toEqual(["1", "4"]);
    expect(plainTasks.map((task) => task.order.id)).toEqual(["2", "3"]);
  });
});

describe("hasAllCourierBulkProofs", () => {
  it("har isbotli buyurtmada (shu amal uchun) fayl bo'lsagina true", () => {
    const tasks = [
      { order: { id: "1" }, action: "sold" as const },
      { order: { id: "2" }, action: "cancel" as const },
    ];
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    expect(getCourierBulkProofKey(tasks[1])).toBe("2:cancel");
    expect(hasAllCourierBulkProofs(tasks, { "1:sold": file })).toBe(false);
    expect(hasAllCourierBulkProofs(tasks, { "1:sold": file, "2:cancel": undefined })).toBe(false);
    // Boshqa amal uchun tanlangan isbot hisoblanmaydi.
    expect(hasAllCourierBulkProofs(tasks, { "1:sold": file, "2:sold": file })).toBe(false);
    expect(hasAllCourierBulkProofs(tasks, { "1:sold": file, "2:cancel": file })).toBe(true);
  });
});

describe("runLimited", () => {
  it("natijalar kirish tartibida (tugash tartibida emas) va parallellik chegarasida", async () => {
    let inFlight = 0;
    let peak = 0;
    const delays = [30, 5, 20, 1, 10];
    const results = await runLimited(delays.map((delay, index) => ({ delay, index })), 2, async ({ delay, index }) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, delay));
      inFlight -= 1;
      if (index === 2) throw new Error("ikkinchi");
      return index;
    });

    expect(peak).toBe(2);
    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "rejected",
      "fulfilled",
      "fulfilled",
    ]);
    expect(results.map((result) => (result.status === "fulfilled" ? result.value : null))).toEqual([0, 1, null, 3, 4]);
  });

  it("bo'sh ro'yxat — bo'sh natija", async () => {
    await expect(runLimited([], 2, async () => 1)).resolves.toEqual([]);
  });
});

describe("summarizeCourierBulkResults", () => {
  it("xato aynan o'z buyurtmasiga bog'lanadi", () => {
    const tasks = [
      { order: { id: "1" }, action: "sold" as const },
      { order: { id: "2" }, action: "cancel" as const },
    ];
    const reason = new Error("400");
    const { succeededOrderIds, failures } = summarizeCourierBulkResults(tasks, [
      { status: "fulfilled", value: {} },
      { status: "rejected", reason },
    ]);
    expect([...succeededOrderIds]).toEqual(["1"]);
    expect(failures).toEqual([{ order: { id: "2" }, action: "cancel", error: reason }]);
  });
});
