import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { queryKeys } from "../../../shared/config/queryKeys";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * «Tashqi yetkazuvchilar» — Integratsiyalar konsolining 4-tabi (maket `*-carrier-console`) va katalog kartasi.
 * Backend `admin/carriers` faqat SUPERADMIN, ADMIN: konsolga kiradigan registrator / menejerda tab ham, so'rov ham yo'q.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/api/api")>();
  return { ...original, api: { ...original.api, get: mocks.get, post: vi.fn(), patch: vi.fn() } };
});

import ConnectionsPage from "../ConnectionsPage";
import CatalogPage from "../CatalogPage";

const as = (role: string) => ({ role: { id: "1", role, region: null, name: role } }) as never;

describe("Carrier API — tab va katalog rol bo'yicha", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    // `admin/carriers` — bo'sh ro'yxat (bo'sh holat); qolgan so'rovlar ham bo'sh.
    mocks.get.mockResolvedValue({ data: { statusCode: 200, data: [] } });
  });

  it("⭐ superadmin: 4-tab bor va ?scope=carrier — carrier konsoli (KPI yo'q)", async () => {
    renderWithProviders(<ConnectionsPage />, {
      route: "/integrations/connections?scope=carrier",
      preloadedState: as("superadmin"),
    });
    expect(await screen.findByRole("tab", { name: /Tashqi yetkazuvchilar/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("Hali tashqi yetkazuvchi yo'q")).toBeInTheDocument();
    expect(screen.queryByText(/oxirgi 24 soat/i)).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Yangi tashqi yetkazuvchi" }).length,
    ).toBeGreaterThan(0);
    expect(mocks.get).toHaveBeenCalledWith("admin/carriers");
  });

  it("⭐ sarlavhadagi «Yangi tashqi yetkazuvchi» yaratish oynasini ochadi; yopilgach qayta ochilmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionsPage />, {
      route: "/integrations/connections?scope=carrier",
      preloadedState: as("superadmin"),
    });
    await screen.findByText("Hali tashqi yetkazuvchi yo'q");
    // Birinchisi — sahifa sarlavhasidagi tugma (bo'sh holatdagi ikkinchisi).
    const [header] = screen.getAllByRole("button", { name: "Yangi tashqi yetkazuvchi" });
    await waitFor(() => expect(header).toBeEnabled());
    await user.click(header);
    const dialog = await screen.findByRole("dialog", { name: "Yangi tashqi yetkazuvchi" });
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Yangi tashqi yetkazuvchi" })).not.toBeInTheDocument(),
    );
    // `?new=1` bir marta o'qilgan — URL yangilanishi oynani qayta ochmaydi.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("dialog", { name: "Yangi tashqi yetkazuvchi" })).not.toBeInTheDocument();
  });

  it("⭐ sarlavhadagi «Yangi tashqi yetkazuvchi»: ro'yxatni qayta so'rash yiqilsa ham (ma'lumot keshda) ishlaydi", async () => {
    const { queryClient } = renderWithProviders(
      <StrictMode>
        <ConnectionsPage />
      </StrictMode>,
      { route: "/integrations/connections?scope=carrier", preloadedState: as("superadmin") },
    );
    await screen.findByText("Hali tashqi yetkazuvchi yo'q");
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Yangi tashqi yetkazuvchi" })[0]).toBeEnabled(),
    );
    // Fondagi qayta so'rash (mutatsiya `onSettled`, `refetchOnReconnect`) 504 bilan yiqiladi.
    mocks.get.mockImplementation((url: string) =>
      url === "admin/carriers"
        ? Promise.reject(new Error("Gateway Timeout"))
        : Promise.resolve({ data: { statusCode: 200, data: [] } }),
    );
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.carrierAccounts.all });
    });
    await waitFor(() =>
      expect(queryClient.getQueryState(queryKeys.carrierAccounts.all)?.status).toBe("error"),
    );
    expect(screen.getAllByRole("button", { name: "Yangi tashqi yetkazuvchi" })[0]).toBeEnabled();
    expect(screen.getByText("Hali tashqi yetkazuvchi yo'q")).toBeInTheDocument();
  });

  it("⭐ klaviatura: ← → bilan «Tashqi yetkazuvchilar» tabiga kirish va chiqishda fokus tabda qoladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StrictMode>
        <ConnectionsPage />
      </StrictMode>,
      { route: "/integrations/connections?scope=marketplace", preloadedState: as("superadmin") },
    );
    const marketplace = await screen.findByRole("tab", { name: /Marketplace/, selected: true });
    await user.click(marketplace);
    expect(marketplace).toHaveFocus();

    // Carrier tab qatori `CarrierConsole` kartasida — qator qayta o'rnatiladi, fokus `<body>` ga tushmasin.
    await user.keyboard("{ArrowRight}");
    const carrier = await screen.findByRole("tab", { name: /Tashqi yetkazuvchilar/, selected: true });
    expect(carrier).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    const back = await screen.findByRole("tab", { name: /Marketplace/, selected: true });
    expect(back).toHaveFocus();
  });

  it("⭐ admin ham ko'radi", async () => {
    renderWithProviders(<ConnectionsPage />, {
      route: "/integrations/connections?scope=partner",
      preloadedState: as("admin"),
    });
    expect(await screen.findByRole("tab", { name: /Tashqi yetkazuvchilar/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("⭐ registrator: tab yo'q, ?scope=carrier hamkorlarga tushadi, admin/carriers so'ralmaydi", async () => {
    renderWithProviders(<ConnectionsPage />, {
      route: "/integrations/connections?scope=carrier",
      preloadedState: as("registrator"),
    });
    expect(await screen.findByRole("tab", { name: /Hamkorlar/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("tab", { name: /Tashqi yetkazuvchilar/ })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
    expect(mocks.get).not.toHaveBeenCalledWith("admin/carriers");
  });

  it("⭐ katalog: «Tashqi yetkazuvchi (Carrier API)» kartasi «Yetkazuvchi» dan keyin — faqat superadmin / admin", () => {
    const { unmount } = renderWithProviders(<CatalogPage />, {
      route: "/integrations/new?scope=external",
      preloadedState: as("superadmin"),
    });
    const cards = screen
      .getAllByRole("button", { name: /— ulanish yaratish/ })
      .map((el) => el.getAttribute("aria-label"));
    const carrierIndex = cards.indexOf("Tashqi yetkazuvchi (Carrier API) — ulanish yaratish");
    expect(carrierIndex).toBeGreaterThan(0);
    expect(cards[carrierIndex - 1]).toBe("Yetkazuvchi — ulanish yaratish");
    unmount();

    renderWithProviders(<CatalogPage />, {
      route: "/integrations/new?scope=external",
      preloadedState: as("registrator"),
    });
    expect(
      screen.queryByRole("button", { name: "Tashqi yetkazuvchi (Carrier API) — ulanish yaratish" }),
    ).not.toBeInTheDocument();
  });
});
