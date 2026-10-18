import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import ErrorBoundaryPage from "./ErrorBoundaryPage";
import ForbiddenPage from "./Forbidden";
import NotFoundPage from "./NotFound";
import ServerErrorPage from "./ServerError";
import { getRuntimeError, RUNTIME_ERROR_STORAGE_KEY, saveRuntimeError } from "../lib/runtimeError";

/**
 * Xato sahifalari (taxta `tizim-errors` 01): `EmptyState`/`ErrorState` `size="page"` — ustki yozuv, h1 sarlavha,
 * 2 ta tugma; 403 kulrang (`role=status` emas, oddiy holat), 500 va ilova xatosi qizil (`role=alert`).
 */

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/** Ilova xatosi sahifasi + u olib boradigan sahifalar (SPA o'tishni ko'rish uchun). */
const renderRuntimeErrorPage = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/runtime-error" element={<ErrorBoundaryPage standalone />} />
        <Route path="/orders" element={<p>Buyurtmalar sahifasi</p>} />
        <Route path="/" element={<p>Bosh sahifa</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route: "/runtime-error" },
  );

describe("xato sahifalari (dizayn v2)", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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

  it("ilova xatosi: texnik matn yopiq «Xato tafsilotlari» ichida; «Qayta urinish» — xato bo'lgan sahifaga, qayta yuklashsiz", async () => {
    const replace = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, replace } as Location);
    saveRuntimeError({ message: "boom xato", stack: "at Page (page.tsx:1)", sourcePath: "/orders?page=2" });
    renderRuntimeErrorPage();

    expect(screen.getByRole("heading", { level: 1, name: "Sahifani ko'rsatib bo'lmadi" })).toBeInTheDocument();
    expect(screen.getByText("Kutilmagan xato")).toBeInTheDocument();
    expect(screen.getByText("Ilovada kutilmagan xato yuz berdi. Qayta urinib ko'ring.")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Xato tafsilotlari" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/boom xato/)).not.toBeVisible();
    await userEvent.click(toggle);
    expect(screen.getByText(/boom xato/)).toBeVisible();
    expect(screen.getByText(/Xato kodi: ERR-[0-9A-F]{4}/)).toBeVisible();
    // Ishlab chiqishda (vitest — DEV) stek ham ko'rinadi.
    expect(screen.getByText(/at Page \(page\.tsx:1\)/)).toBeVisible();

    const retry = screen.getByRole("button", { name: "Qayta urinish" });
    expect(retry).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "Bosh sahifaga qaytish" })).toHaveAttribute("data-variant", "secondary");
    expect(screen.queryByRole("button", { name: "Orqaga" })).not.toBeInTheDocument();
    await userEvent.click(retry);
    expect(await screen.findByText("Buyurtmalar sahifasi")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/orders?page=2");
    expect(replace).not.toHaveBeenCalled();
    // Yozuv qoladi — sahifa yana yiqilsa hisoblagich oshadi.
    expect(getRuntimeError()).toMatchObject({ sourcePath: "/orders?page=2", retryCount: 1 });
  });

  it("takroriy xato (shu sahifa 2-marta yiqildi): «Qayta urinish» yo'q, «Bosh sahifaga qaytish» asosiy, administratorga murojaat", async () => {
    saveRuntimeError({ message: "boom", sourcePath: "/orders" });
    saveRuntimeError({ message: "boom", sourcePath: "/orders" });
    renderRuntimeErrorPage();

    expect(screen.getByRole("heading", { level: 1, name: "Sahifani ko'rsatib bo'lmadi" })).toBeInTheDocument();
    expect(screen.getByText("Bu sahifa takroran xato bermoqda. Administratorga murojaat qiling.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
    const home = screen.getByRole("button", { name: "Bosh sahifaga qaytish" });
    expect(home).toHaveAttribute("data-variant", "primary");
    // Ikkinchi chiqish yo'li — 403 blokidagidek «Orqaga».
    expect(screen.getByRole("button", { name: "Orqaga" })).toHaveAttribute("data-variant", "secondary");

    await userEvent.click(home);
    expect(await screen.findByText("Bosh sahifa")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(RUNTIME_ERROR_STORAGE_KEY)).toBeNull();
  });

  it("prod build: stek «Xato tafsilotlari» ichida ham yo'q — faqat xato kodi va xabar", async () => {
    vi.stubEnv("DEV", false);
    saveRuntimeError({
      message: "r.forEach is not a function",
      stack: "TypeError: r.forEach is not a function\n    at Hx (index-abc.js:1:2345)",
      componentStack: "\n    at Orders (index-abc.js:9:99)",
      sourcePath: "/orders",
    });
    renderRuntimeErrorPage();

    await userEvent.click(screen.getByRole("button", { name: "Xato tafsilotlari" }));
    const details = screen.getByText(/Xato kodi: ERR-[0-9A-F]{4}/);
    expect(details).toBeVisible();
    expect(details).toHaveTextContent("r.forEach is not a function");
    expect(details).not.toHaveTextContent("index-abc.js");
  });

  it("ilova xatosi yozuvi yo'q — hech narsa chizilmaydi (bosh sahifaga yo'naltiriladi)", () => {
    renderWithProviders(<ErrorBoundaryPage standalone />, { route: "/runtime-error" });
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
