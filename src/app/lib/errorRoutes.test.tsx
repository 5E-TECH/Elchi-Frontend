import { Suspense, useEffect } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";
import {
  getRuntimeError,
  RUNTIME_ERROR_STORAGE_KEY,
  saveRuntimeError,
} from "../../shared/lib/runtimeError";

/**
 * Xato sahifalari qayerda chiziladi (ega qarori 2026-10-16, taxta `tizim-errors` 01 «Xato sahifasi menyu ichida
 * ochiladi»): kirgan foydalanuvchiga — shell ICHIDA (403/404/500/ilova xatosi va noma'lum yo'l); kirmaganga yoki
 * shell'ning o'zi yiqilganda — shell'siz, butun ekran.
 *
 * Shell o'rnida yengil soxta: yon menyu + `main` + `Outlet`. `shell.crash` — shell'ning o'zi yiqilgan holat,
 * `shell.mounts` — shell necha marta qayta qurilgani.
 */
const shell = vi.hoisted(() => ({ crash: false, mounts: 0 }));

vi.mock("../../widgets/layout/dashboardLayout", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  const ShellStub = () => {
    useEffect(() => {
      shell.mounts += 1;
    }, []);
    if (shell.crash) throw new Error("shell yiqildi");
    return (
      <div data-testid="shell">
        <nav aria-label="Yon menyu" />
        <main>
          <Outlet />
        </main>
      </div>
    );
  };
  return { default: ShellStub };
});

vi.mock("../../pages/dashboard/DashboardPage", () => ({
  default: () => <p>Bosh sahifa kontenti</p>,
}));

const signedIn: Partial<RootState> = {
  user: {
    user: null,
    isAuthenticated: true,
    accessToken: "test.token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
  role: { id: "1", role: "superadmin", region: null, name: null },
};

const signedOut: Partial<RootState> = {
  user: {
    user: null,
    isAuthenticated: false,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
  role: { id: null, role: null, region: null, name: null },
};

const renderApp = (route: string, preloadedState: Partial<RootState>) =>
  renderWithProviders(
    <Suspense fallback={null}>
      <AppRouter />
    </Suspense>,
    { route, preloadedState },
  );

const findPageHeading = (name: string) => screen.findByRole("heading", { level: 1, name }, { timeout: 5000 });

const mockLocationReplace = () => {
  const replace = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, replace } as Location);
  return replace;
};

describe("xato sahifalari: shell ichida yoki butun ekran", () => {
  beforeEach(() => {
    shell.crash = false;
    shell.mounts = 0;
  });

  afterEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
  });

  describe("kirgan foydalanuvchi — shell ichida", () => {
    it.each([
      ["/403", "Bu sahifaga ruxsatingiz yo'q"],
      ["/404", "Bu sahifa topilmadi"],
      ["/500", "Serverda xatolik yuz berdi"],
      ["/yoq-bolim/ichki", "Bu sahifa topilmadi"],
    ])("%s — yon menyu joyida, sahifaning o'z `main` i yo'q", async (route, title) => {
      renderApp(route, signedIn);
      const heading = await findPageHeading(title);
      expect(screen.getByTestId("shell")).toContainElement(heading);
      expect(screen.getByRole("navigation", { name: "Yon menyu" })).toBeInTheDocument();
      expect(screen.getAllByRole("main")).toHaveLength(1);
    });

    it("ilova xatosi — shell ichida; «Qayta urinish» xato bo'lgan sahifaga qaytadi va yozuvni tozalaydi", async () => {
      const replace = mockLocationReplace();
      saveRuntimeError({ message: "boom", sourcePath: "/orders?page=2" });
      renderApp("/runtime-error", signedIn);

      const heading = await findPageHeading("Sahifani ko'rsatib bo'lmadi");
      expect(screen.getByTestId("shell")).toContainElement(heading);

      await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
      expect(replace).toHaveBeenCalledWith("/orders?page=2");
      expect(window.sessionStorage.getItem(RUNTIME_ERROR_STORAGE_KEY)).toBeNull();
    });

    it("ilova xatosi — «Bosh sahifaga qaytish» yozuvni tozalab, shell ichida bosh sahifaga o'tadi", async () => {
      saveRuntimeError({ message: "boom", sourcePath: "/orders" });
      renderApp("/runtime-error", signedIn);
      await findPageHeading("Sahifani ko'rsatib bo'lmadi");

      await userEvent.click(screen.getByRole("button", { name: "Bosh sahifaga qaytish" }));
      expect(await screen.findByText("Bosh sahifa kontenti")).toBeInTheDocument();
      expect(window.sessionStorage.getItem(RUNTIME_ERROR_STORAGE_KEY)).toBeNull();
      expect(shell.mounts).toBe(1);
    });

    it("ruxsatsiz bo'lim (`ProtectedRoute`) → /403 shell ichida, shell qayta qurilmaydi", async () => {
      // `/branch-dashboard` — faqat menejer; superadmin `ProtectedRoute` orqali /403 ga.
      renderApp("/branch-dashboard", signedIn);
      const heading = await findPageHeading("Bu sahifaga ruxsatingiz yo'q");
      expect(screen.getByTestId("shell")).toContainElement(heading);
      expect(shell.mounts).toBe(1);
    });
  });

  describe("kirmagan foydalanuvchi — butun ekran (shell'siz)", () => {
    it.each([
      ["/403", "Bu sahifaga ruxsatingiz yo'q"],
      ["/404/", "Bu sahifa topilmadi"],
      ["/500", "Serverda xatolik yuz berdi"],
    ])("%s — o'z `main` i, shell yo'q (kirish sahifasiga otilmaydi)", async (route, title) => {
      renderApp(route, signedOut);
      const heading = await findPageHeading(title);
      expect(screen.getByRole("main")).toContainElement(heading);
      expect(screen.queryByTestId("shell")).not.toBeInTheDocument();
    });

    it("ilova xatosi — butun ekran, saqlangan xato bilan", async () => {
      saveRuntimeError({ message: "boom", sourcePath: "/orders" });
      renderApp("/runtime-error", signedOut);
      const heading = await findPageHeading("Sahifani ko'rsatib bo'lmadi");
      expect(screen.getByRole("main")).toContainElement(heading);
      expect(screen.queryByTestId("shell")).not.toBeInTheDocument();
    });
  });

  describe("shell'ning o'zi yiqilsa", () => {
    beforeEach(() => {
      // React va chegara xatoni konsolga yozadi — test chiqishini ifloslamasin.
      vi.spyOn(console, "error").mockImplementation(() => {});
      shell.crash = true;
    });

    it("/runtime-error — butun ekran nusxasi; asl xato yozuvi va «Qayta urinish» manzili saqlanadi", async () => {
      const replace = mockLocationReplace();
      saveRuntimeError({ message: "asl xato", sourcePath: "/orders?page=2" });
      renderApp("/runtime-error", signedIn);

      const heading = await findPageHeading("Sahifani ko'rsatib bo'lmadi");
      expect(screen.getByRole("main")).toContainElement(heading);
      expect(screen.queryByTestId("shell")).not.toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
      expect(getRuntimeError()).toMatchObject({ message: "asl xato", sourcePath: "/orders?page=2" });

      await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
      expect(replace).toHaveBeenCalledWith("/orders?page=2");
    });

    it("/403 — o'sha sahifaning butun ekran nusxasi; bosh sahifaga o'tilsa shell qayta chiziladi", async () => {
      renderApp("/403", signedIn);
      const heading = await findPageHeading("Bu sahifaga ruxsatingiz yo'q");
      expect(screen.getByRole("main")).toContainElement(heading);
      expect(screen.queryByTestId("shell")).not.toBeInTheDocument();

      shell.crash = false;
      await userEvent.click(screen.getByRole("link", { name: "Bosh sahifaga qaytish" }));
      const content = await screen.findByText("Bosh sahifa kontenti");
      expect(within(screen.getByTestId("shell")).getByText("Bosh sahifa kontenti")).toBe(content);
    });

    it("oddiy sahifada — avvalgidek: xato saqlanadi va /runtime-error ga to'liq qayta yuklash", async () => {
      window.history.replaceState({}, "", "/orders?page=3");
      const replace = mockLocationReplace();
      renderApp("/orders", signedIn);

      await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/runtime-error"), { timeout: 5000 });
      expect(getRuntimeError()).toMatchObject({ message: "shell yiqildi", sourcePath: "/orders?page=3" });
    });
  });
});
