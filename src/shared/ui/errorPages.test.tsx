import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import ErrorBoundaryPage from "./ErrorBoundaryPage";
import ForbiddenPage from "./Forbidden";
import NotFoundPage from "./NotFound";
import ServerErrorPage from "./ServerError";
import { RUNTIME_ERROR_STORAGE_KEY, saveRuntimeError } from "../lib/runtimeError";

/**
 * Xato sahifalari (taxta `tizim-errors` 01): `EmptyState`/`ErrorState` `size="page"` — ustki yozuv, h1 sarlavha,
 * 2 ta tugma; 403 kulrang (`role=status` emas, oddiy holat), 500 va ilova xatosi qizil (`role=alert`).
 */

describe("xato sahifalari (dizayn v2)", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("404: sarlavha, «Xato kodi 404», bosh sahifa havolasi va «Orqaga»", () => {
    renderWithProviders(<NotFoundPage />, { route: "/yoq-sahifa" });
    expect(screen.getByRole("heading", { level: 1, name: "Bu sahifa topilmadi" })).toBeInTheDocument();
    expect(screen.getByText("Xato kodi 404")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bosh sahifaga qaytish" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Orqaga" })).toBeInTheDocument();
    // Shell ichida — o'z `main` i yo'q (shell'niki bor).
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("standalone — butun ekran `main`", () => {
    renderWithProviders(<NotFoundPage standalone />, { route: "/404" });
    expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading", { level: 1 }));
  });

  it("403: kulrang holat (xato tonida emas), ikkala chiqish yo'li", () => {
    const { container } = renderWithProviders(<ForbiddenPage standalone />, { route: "/403" });
    expect(screen.getByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" })).toBeInTheDocument();
    expect(screen.getByText("Xato kodi 403")).toBeInTheDocument();
    expect(container.querySelector("[data-state-tone]")).toHaveAttribute("data-state-tone", "neutral");
    expect(screen.getByRole("link", { name: "Bosh sahifaga qaytish" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Orqaga" })).toBeInTheDocument();
  });

  it("500: qizil xato, «Qayta urinish» sahifani qayta yuklaydi", async () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
    renderWithProviders(<ServerErrorPage standalone />, { route: "/500" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-state-tone", "danger");
    expect(screen.getByRole("heading", { level: 1, name: "Serverda xatolik yuz berdi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bosh sahifaga qaytish" })).toHaveAttribute("href", "/");
    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("ilova xatosi: texnik matn yopiq «Xato tafsilotlari» ichida; «Qayta urinish» xato bo'lgan sahifaga qaytadi", async () => {
    const replace = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, replace } as Location);
    saveRuntimeError({ message: "boom xato", stack: "at Page (page.tsx:1)", sourcePath: "/orders?page=2" });
    renderWithProviders(<ErrorBoundaryPage standalone />, { route: "/runtime-error" });

    expect(screen.getByRole("heading", { level: 1, name: "Sahifani ko'rsatib bo'lmadi" })).toBeInTheDocument();
    expect(screen.getByText("Kutilmagan xato")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Xato tafsilotlari" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/boom xato/)).not.toBeVisible();
    await userEvent.click(toggle);
    expect(screen.getByText(/boom xato/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(replace).toHaveBeenCalledWith("/orders?page=2");
    expect(window.sessionStorage.getItem(RUNTIME_ERROR_STORAGE_KEY)).toBeNull();
  });

  it("ilova xatosi yozuvi yo'q — hech narsa chizilmaydi (bosh sahifaga yo'naltiriladi)", () => {
    renderWithProviders(<ErrorBoundaryPage standalone />, { route: "/runtime-error" });
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
