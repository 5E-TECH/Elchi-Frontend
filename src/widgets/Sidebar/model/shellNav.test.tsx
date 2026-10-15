import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { createTestStore } from "../../../test/test-utils";
import { getActiveNavPath, isNavPathActive, useMobileMenu } from "./shellNav";
import { getSidebarConfigForUser } from "./menuConfig";

describe("isNavPathActive (NavLink qoidasi)", () => {
  it.each([
    ["/orders", "/orders", false, true],
    ["/orders", "/orders/", false, true],
    ["/orders", "/orders/42", false, true],
    ["/orders", "/orders-archive", false, false],
    ["/orders", "/Orders/42", false, true],
    ["/", "/", true, true],
    ["/", "/orders", true, false],
    ["/", "/orders", false, false],
    ["/branch-dashboard", "/branch-dashboard", true, true],
    ["/branch-dashboard", "/branch-dashboard/x", true, false],
  ] as const)("%s @ %s (end=%s) → %s", (to, pathname, end, expected) => {
    expect(isNavPathActive(to, pathname, end)).toBe(expected);
  });
});

describe("getActiveNavPath", () => {
  const items = [
    { to: "/", end: true },
    { to: "/new-orders" },
    { to: "/new-orders/markets" },
    { to: "/orders" },
  ];

  it("⭐ eng uzun mos yo'l g'olib", () => {
    expect(getActiveNavPath(items, "/new-orders/markets/7")).toBe("/new-orders/markets");
    expect(getActiveNavPath(items, "/new-orders/branches")).toBe("/new-orders");
    expect(getActiveNavPath(items, "/orders/42")).toBe("/orders");
  });

  it("bosh sahifa faqat aynan `/` da; mos band bo'lmasa null", () => {
    expect(getActiveNavPath(items, "/")).toBe("/");
    expect(getActiveNavPath(items, "/settings")).toBeNull();
  });

  it("haqiqiy superadmin menyusi: har bir band o'z yo'lida faol, bittadan", () => {
    const menu = getSidebarConfigForUser("superadmin", null);
    expect(menu.length).toBeGreaterThan(5);
    for (const item of menu) {
      expect(getActiveNavPath(menu, item.to)).toBe(item.to);
      if (item.to !== "/") expect(getActiveNavPath(menu, `${item.to}/123`)).toBe(item.to);
    }
  });
});

describe("useMobileMenu (redux sidebar.isMobileMenuOpen)", () => {
  it("⭐ open / close / toggle bitta holatni boshqaradi, desktop yig'ish holatiga tegmaydi", () => {
    const store = createTestStore();
    const desktopBefore = store.getState().sidebar.isOpen;
    const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
    const { result } = renderHook(() => useMobileMenu(), { wrapper });

    expect(result.current.isOpen).toBe(false);
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    expect(store.getState().sidebar.isMobileMenuOpen).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.toggle());
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(store.getState().sidebar.isOpen).toBe(desktopBefore);
  });
});
