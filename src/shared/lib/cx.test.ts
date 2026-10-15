import { describe, expect, it } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("qismlarni bitta bo'sh joy bilan qo'shadi", () => {
    expect(cx("h-10", "px-4", "text-sm")).toBe("h-10 px-4 text-sm");
  });

  it("false, null, undefined, 0 va bo'sh satrni tashlaydi", () => {
    expect(cx("a", false, null, undefined, 0, "", "b")).toBe("a b");
  });

  it("shartli klass bilan ishlaydi", () => {
    const active = true;
    const disabled = false;
    expect(cx("base", active && "is-active", disabled && "is-disabled")).toBe("base is-active");
  });

  it("chetdagi bo'sh joylarni olib tashlaydi, faqat bo'sh joydan iborat qismni tashlaydi", () => {
    expect(cx("  a  ", "   ", " b")).toBe("a b");
  });

  it("takrorni olib tashlamaydi va klasslarni birlashtirmaydi (sehrsiz)", () => {
    expect(cx("p-2", "p-2", "p-4")).toBe("p-2 p-2 p-4");
  });

  it("hech narsa berilmasa bo'sh satr qaytaradi", () => {
    expect(cx()).toBe("");
    expect(cx(false, null, undefined)).toBe("");
  });
});
