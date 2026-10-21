import { act, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import i18n from "../../i18n";
import { __resetNavigationPendingForTests, beginRouteSuspense } from "../../shared/lib/navigationPending";
import ScanLayout from "./scanLayout";

/**
 * Skaner qobig'i (`/scan`, `/scan/:token`): menyusiz, chekkalar maket `.el-cam-screen` dagidek,
 * bo'lim yuklanishida yuqori chiziq (`RouteProgress`) shu qobiqda ham bor.
 */
const renderScan = () => {
  const router = createMemoryRouter(
    [{ path: "/", element: <ScanLayout />, children: [{ path: "scan", element: <h1>Skaner</h1> }] }],
    { initialEntries: ["/scan"] },
  );
  return render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  );
};

afterEach(() => {
  vi.useRealTimers();
  __resetNavigationPendingForTests();
});

describe("ScanLayout (shell)", () => {
  it("menyusiz, bitta <main>, chekkalar maketdagidek (≥ 1024: 24·32·32, torroqda 16), `sm:` chegarasi yo'q", () => {
    const { container } = renderScan();
    expect(screen.getByRole("heading", { name: "Skaner" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    const main = screen.getByRole("main");
    for (const cls of ["px-4", "py-4", "lg:px-8", "lg:pt-6", "lg:pb-8"]) expect(main).toHaveClass(cls);
    expect(container.innerHTML).not.toMatch(/\bsm:/);
    expect(container.firstElementChild).toHaveClass("min-h-dvh", "bg-bg", "text-text");
  });

  it("«Asosiy kontentga o'tish» (KI-S2) — birinchi element, bosilsa fokus kontent blokiga", () => {
    const { container } = renderScan();
    const link = screen.getByRole("link", { name: "Asosiy kontentga o'tish" });
    expect((container.firstElementChild as HTMLElement).firstElementChild).toBe(link);
    const content = container.querySelector("#main-content") as HTMLElement;
    expect(content).toHaveAttribute("tabindex", "-1");
    expect(content).toContainElement(screen.getByRole("heading", { name: "Skaner" }));
    fireEvent.click(link);
    expect(content).toHaveFocus();
  });

  it("bo'lim kodi yuklanayotganda 150 ms dan keyin yuqori chiziq ko'rinadi (oyna skrolida ham tepada — `fixed`)", () => {
    vi.useFakeTimers();
    renderScan();
    expect(screen.queryByRole("progressbar")).toBeNull();

    let end: () => void = () => {};
    act(() => {
      end = beginRouteSuspense();
    });
    act(() => {
      vi.advanceTimersByTime(160);
    });
    const bar = screen.getByRole("progressbar");
    expect(bar.parentElement).toHaveClass("fixed", "inset-x-0", "top-0", "z-50");
    act(() => end());
  });
});
