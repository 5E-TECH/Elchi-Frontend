import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TOASTS, notify, TOAST_EXIT_MS, toastStore } from "./notify";

/**
 * notify() — `tizim-feedback` 01–02: vaqtlar (4 / 4 / 6 s, xato — yopilguncha, amalli — 6 s), 3 tadan ortiq
 * bo'lmaydi, takror xabar qo'shilmaydi, kursor/fokusda vaqt to'xtaydi, yopilish 200 ms (harakatsiz — darhol).
 */

const ids = () => toastStore.getSnapshot().map((toast) => toast.id);
const open = () => toastStore.getSnapshot().filter((toast) => !toast.closing);

beforeEach(() => {
  vi.useFakeTimers();
  toastStore.reset();
});

afterEach(() => {
  toastStore.reset();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("notify", () => {
  it("xabar qo'shadi va id qaytaradi; React'siz ishlaydi", () => {
    const id = notify.success("To'lov o'tkazildi", { description: "1 250 000 so'm asosiy kassaga o'tkazildi." });
    expect(ids()).toEqual([id]);
    expect(toastStore.getSnapshot()[0]).toMatchObject({
      tone: "success",
      message: "To'lov o'tkazildi",
      description: "1 250 000 so'm asosiy kassaga o'tkazildi.",
      duration: 4000,
      closing: false,
    });
  });

  it.each([
    ["success", 4000],
    ["info", 4000],
    ["warning", 6000],
  ] as const)("%s — %d ms dan keyin yopiladi (200 ms harakat bilan)", (tone, duration) => {
    notify[tone]("Xabar");
    vi.advanceTimersByTime(duration - 1);
    expect(open()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(open()).toHaveLength(0);
    expect(toastStore.getSnapshot()[0].closing).toBe(true);
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(toastStore.getSnapshot()).toHaveLength(0);
  });

  it("xato foydalanuvchi yopguncha turadi", () => {
    const id = notify.error("Ruxsat yo'q");
    vi.advanceTimersByTime(60_000);
    expect(ids()).toEqual([id]);
    notify.dismiss(id);
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(ids()).toEqual([]);
  });

  it("amalli xabar — 6 s; o'z `duration` (ms) ustun; 0 — yopilmaydi", () => {
    notify.success("Olib tashlandi", { action: { label: "Bekor qilish", onClick: () => {} } });
    expect(toastStore.getSnapshot()[0].duration).toBe(6000);
    notify.info("Uzoq", { duration: 10_000 });
    notify.warning("Doim", { duration: 0 });
    vi.advanceTimersByTime(9_999);
    expect(open().map((toast) => toast.message)).toEqual(["Uzoq", "Doim"]);
    vi.advanceTimersByTime(1);
    expect(open().map((toast) => toast.message)).toEqual(["Doim"]);
  });

  it(`${MAX_TOASTS} tadan ortig'i — eng eskisi yopiladi`, () => {
    const first = notify.success("1");
    notify.warning("2");
    notify.error("3");
    notify.info("4");
    expect(open().map((toast) => toast.message)).toEqual(["2", "3", "4"]);
    expect(toastStore.getSnapshot().find((toast) => toast.id === first)?.closing).toBe(true);
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(toastStore.getSnapshot().map((toast) => toast.message)).toEqual(["2", "3", "4"]);
  });

  it("bir xil xabar ko'rinib turganda qo'shilmaydi — vaqti yangilanadi, qayta e'lon qilinmaydi", () => {
    const first = notify.error("Hisobot yuklanmadi", { description: "Server javob bermadi." });
    const announced = toastStore.getAnnouncements().alert;
    const second = notify.error("Hisobot yuklanmadi", { description: "Server javob bermadi." });
    expect(second).toBe(first);
    expect(toastStore.getSnapshot()).toHaveLength(1);
    expect(toastStore.getAnnouncements().alert).toBe(announced);

    notify.success("Saqlandi");
    vi.advanceTimersByTime(3000);
    notify.success("Saqlandi");
    vi.advanceTimersByTime(3000);
    expect(open().map((toast) => toast.message)).toContain("Saqlandi");
  });

  it("bir xil `id` — xabar yangilanadi (yangi mazmun qayta e'lon qilinadi)", () => {
    notify.info("Yuklanmoqda", { id: "export" });
    const before = toastStore.getAnnouncements().status;
    notify.success("Excelga saqlandi", { id: "export", description: "248 ta buyurtma" });
    expect(ids()).toEqual(["export"]);
    const item = toastStore.getSnapshot()[0];
    expect(item).toMatchObject({ tone: "success", message: "Excelga saqlandi", version: 1 });
    expect(toastStore.getAnnouncements().status).not.toBe(before);
    expect(toastStore.getAnnouncements().status.map((item) => item.version)).toEqual([1]);
  });

  it("e'lon: xato — alert, qolgani — status; yopilgach e'lon tozalanadi", () => {
    const error = notify.error("Xato");
    notify.success("Bo'ldi");
    const messages = (key: "status" | "alert") => toastStore.getAnnouncements()[key].map((item) => item.message);
    expect(messages("alert")).toEqual(["Xato"]);
    expect(messages("status")).toEqual(["Bo'ldi"]);
    notify.dismiss(error);
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(messages("alert")).toEqual([]);
    expect(messages("status")).toEqual(["Bo'ldi"]);
  });

  it("e'lon: bir lahzada kelgan xabarlar bir-birini o'chirmaydi (tartibda qo'shiladi)", () => {
    notify.success("Excelga saqlandi");
    notify.warning("To'lov allaqachon yozilgan");
    notify.success("Buyurtma qabul qilindi");
    expect(toastStore.getAnnouncements().status.map((item) => item.message)).toEqual([
      "Excelga saqlandi",
      "To'lov allaqachon yozilgan",
      "Buyurtma qabul qilindi",
    ]);
    // `id` bilan yangilangan xabar — eski e'lon o'rniga, oxiriga (yangi qator bo'lib qayta o'qiladi).
    notify.info("Yuklanmoqda", { id: "export" });
    notify.success("Tayyor", { id: "export" });
    expect(toastStore.getAnnouncements().status.filter((item) => item.id === "export")).toHaveLength(1);
    expect(toastStore.getAnnouncements().status.at(-1)?.message).toBe("Tayyor");
  });

  it("pause/resume: kursor yoki fokus ustida vaqt to'xtaydi, qolgan vaqt davom etadi", () => {
    notify.success("Bo'ldi");
    vi.advanceTimersByTime(3000);
    toastStore.pause("hover");
    vi.advanceTimersByTime(10_000);
    expect(open()).toHaveLength(1);
    toastStore.pause("focus");
    toastStore.resume("hover");
    vi.advanceTimersByTime(10_000);
    expect(open()).toHaveLength(1);
    toastStore.resume("focus");
    vi.advanceTimersByTime(999);
    expect(open()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(open()).toHaveLength(0);
  });

  it("to'xtatilgan paytda qo'shilgan xabar ham kutadi", () => {
    toastStore.pause("hidden");
    notify.info("Kun yakunlandi");
    vi.advanceTimersByTime(20_000);
    expect(open()).toHaveLength(1);
    toastStore.resume("hidden");
    vi.advanceTimersByTime(4000);
    expect(open()).toHaveLength(0);
  });

  it("dismiss() — hammasini yopadi", () => {
    notify.success("1");
    notify.error("2");
    notify.dismiss();
    expect(open()).toHaveLength(0);
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(toastStore.getSnapshot()).toHaveLength(0);
  });

  it("«Harakatni kamaytirish» — yopilish darhol", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    const id = notify.error("Xato");
    notify.dismiss(id);
    expect(toastStore.getSnapshot()).toHaveLength(0);
  });

  it("obunachilarga xabar beradi", () => {
    const listener = vi.fn();
    const unsubscribe = toastStore.subscribe(listener);
    notify.info("Salom");
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    notify.info("Yana");
    expect(listener).not.toHaveBeenCalled();
  });

  it("DEV: soniyadagi `duration` haqida ogohlantiradi", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    notify.warning("QR topilmadi", { duration: 3 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("millisekund"));
  });
});
