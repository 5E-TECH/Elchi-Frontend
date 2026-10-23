import { afterEach, describe, expect, it, vi } from "vitest";
import { focusRemittancesSection } from "./remittancesAnchor";
import { remittancesPeriodText } from "./remittancesPeriod";

/** IS-3 review: «To'lov №N» o'tishi qobiq ildizini surmasin; «Bu davrda to'lov yo'q» matni bitta chet bilan ham to'g'ri. */

const rect = (top: number) => ({ top, bottom: top + 40, left: 0, right: 100, width: 100, height: 40, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

describe("focusRemittancesSection", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("⭐ faqat <main> suriladi (scrollIntoView emas — u `h-dvh overflow-hidden` ildizini ham 64 px surardi), fokus sarlavhada", () => {
    document.body.innerHTML = `<div class="flex h-dvh overflow-hidden"><main><div data-remittances-head tabindex="-1">Olingan to'lovlar</div></main></div>`;
    const main = document.querySelector("main")!;
    const head = document.querySelector<HTMLElement>("[data-remittances-head]")!;
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { value: scrollIntoView, configurable: true, writable: true });
    const scrollTo = vi.fn();
    main.scrollTo = scrollTo as unknown as typeof main.scrollTo;
    main.scrollTop = 200;
    vi.spyOn(main, "getBoundingClientRect").mockReturnValue(rect(64));
    vi.spyOn(head, "getBoundingClientRect").mockReturnValue(rect(900));

    focusRemittancesSection();

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 200 + 900 - 64 - 16 }));
    expect(head).toHaveFocus();
  });
});

describe("remittancesPeriodText", () => {
  it("⭐ ikkala chet bir yilda — «01.09 – 30.09.2026»", () => {
    expect(remittancesPeriodText({ from: "2026-09-01", to: "2026-09-30" }, "uz")).toEqual({
      key: "emptyPeriodText",
      values: { range: "01.09 – 30.09.2026" },
    });
  });

  it("turli yil — to'liq sanalar", () => {
    expect(remittancesPeriodText({ from: "2025-12-20", to: "2026-01-10" }, "ru").values.range).toBe("20.12.2025 – 10.01.2026");
  });

  it("⭐ bitta chet — alohida «dan beri» / «gacha» kaliti (oraliq gapi buzilmaydi)", () => {
    expect(remittancesPeriodText({ from: "2026-09-01", to: "" }, "en")).toEqual({ key: "emptyPeriodFromText", values: { date: "01.09.2026" } });
    expect(remittancesPeriodText({ from: "", to: "2026-09-30" }, "en")).toEqual({ key: "emptyPeriodToText", values: { date: "30.09.2026" } });
  });
});
