import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { scrollShellContentToTop, usePagination } from "./usePagination";

const wrapperFor =
  (route: string) =>
  ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [route] }, children);

const render = (route: string, options: Partial<Parameters<typeof usePagination>[0]> = {}) =>
  renderHook(() => usePagination({ key: "orders", defaultLimit: 10, ...options }), { wrapper: wrapperFor(route) });

describe("usePagination", () => {
  it("sukut: URL'dagi har musbat butun son qabul qilinadi (avvalgi xulq)", () => {
    const { result } = render("/orders?page=3&limit=37");
    expect(result.current.page).toBe(3);
    expect(result.current.limit).toBe(37);
  });

  it("noto'g'ri sahifa va limit — sukut qiymatlar", () => {
    const { result } = render("/orders?page=abc&limit=-5");
    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(10);
  });

  it("`allowedLimits`: ro'yxatda yo'q limit (`?limit=5000`) e'tiborsiz — sukut limit (D-08)", () => {
    const { result } = render("/orders?limit=5000", { allowedLimits: [10, 25, 50, 100] });
    expect(result.current.limit).toBe(10);
  });

  it("`allowedLimits`: ro'yxatdagi limit saqlanadi", () => {
    const { result } = render("/orders?limit=50", { allowedLimits: [10, 25, 50, 100] });
    expect(result.current.limit).toBe(50);
  });

  it("setLimit sahifani 1 ga qaytaradi", () => {
    const { result } = render("/orders?page=4", { allowedLimits: [10, 25, 50, 100] });
    act(() => result.current.setLimit(25));
    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(25);
  });
});

describe("scrollShellContentToTop", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shell `<main>` ini tepaga qaytaradi (D-03)", () => {
    document.body.innerHTML = '<main><div data-shell-slot="content"></div></main>';
    const main = document.querySelector("main") as HTMLElement;
    main.scrollTop = 829;
    scrollShellContentToTop();
    expect(main.scrollTop).toBe(0);
  });

  it("shell'siz sahifada xato bermaydi", () => {
    expect(() => scrollShellContentToTop()).not.toThrow();
  });
});
