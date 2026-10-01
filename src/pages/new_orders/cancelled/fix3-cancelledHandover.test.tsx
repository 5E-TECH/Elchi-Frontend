import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import CancelledMarketDetail from "./detail";
import NewOrders from "../index";

/**
 * fix3 FE-RET-05 — RU/EN interfeysda ham qo'lda tanlash sababi backend enum
 * (o'zbekcha) qiymati bilan ketadi. fix3 CODE-16 / C4 — HQ registratori
 * "Bekor qilinganlar" tabini ko'radi.
 */

const mocks = vi.hoisted(() => ({
  handoverMutate: vi.fn(),
}));

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useCancelledOrdersByMarket: () => ({
      data: {
        data: [
          {
            id: "501",
            status: "cancelled",
            where_deliver: "center",
            total_price: 100000,
            paid_amount: 0,
            to_be_paid: 0,
            createdAt: "2026-10-01T08:00:00.000Z",
            comment: null,
            address: null,
            qr_code_token: "tok-501",
            items: [],
            customer: { id: "c1", name: "Ali", phone_number: "+998901112233" },
            market: { id: "201", name: "Yandex", cancelled_handover_qr_required: false },
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    generateCancelledMarketQr: { mutate: vi.fn(), isPending: false },
    scanMarketCancelledQr: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
    handoverCancelledOrders: { mutate: mocks.handoverMutate, isPending: false },
  }),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: () => undefined,
}));

const adminState = {
  role: { id: "admin-1", role: "admin", region: null, name: "Admin" },
} as never;

const renderDetail = () =>
  renderWithProviders(
    <Routes>
      <Route path="/new-orders/cancelled/:marketId" element={<CancelledMarketDetail />} />
    </Routes>,
    { route: "/new-orders/cancelled/201", preloadedState: adminState },
  );

describe("Bekor qilingan mollar — qo'lda tanlash sababi (fix3 FE-RET-05)", () => {
  beforeEach(async () => {
    mocks.handoverMutate.mockReset();
    await i18n.changeLanguage("ru");
  });

  afterEach(async () => {
    await i18n.changeLanguage("uz");
  });

  it("RU interfeysda tarjima ko'rinadi, backendga o'zbekcha enum qiymati ketadi", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: "QR поврежден" }));
    const select = screen.getByRole("combobox");
    // Foydalanuvchi tarjimani ko'radi...
    expect(within(select).getByRole("option", { name: "QR не читается" })).toBeInTheDocument();
    // ...lekin qiymat — enum kodi.
    await user.selectOptions(select, "QR o'qilmayapti");
    await user.click(screen.getByRole("button", { name: "Подтвердить вручную" }));
    await user.click(screen.getByRole("button", { name: /Отправить маркету \(1\)/ }));

    expect(mocks.handoverMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        marketId: "201",
        orderIds: ["501"],
        manualOverrides: [{ order_id: "501", reason: "QR o'qilmayapti" }],
      }),
      expect.any(Object),
    );
  });

  it("sukut bo'yicha birinchi sabab — 'QR yirtilgan' (tarjima 'QR порван' EMAS)", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: "QR поврежден" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить вручную" }));
    await user.click(screen.getByRole("button", { name: /Отправить маркету \(1\)/ }));

    expect(mocks.handoverMutate).toHaveBeenCalledWith(
      expect.objectContaining({ manualOverrides: [{ order_id: "501", reason: "QR yirtilgan" }] }),
      expect.any(Object),
    );
  });
});

describe("Yangi buyurtmalar tablari — HQ registratori (fix3 CODE-16 / C4)", () => {
  const stateFor = (role: string, branchType?: string) =>
    ({
      role: { id: `${role}-1`, role, region: null, name: role },
      user: {
        user: { id: `${role}-1`, role, ...(branchType ? { branch: { id: "1", type: branchType } } : {}) },
        isAuthenticated: true,
        accessToken: null,
        loading: false,
        isAppInitializing: false,
        error: null,
      },
    }) as never;

  it("HQ registratori 'Bekor qilinganlar' tabini ko'radi", () => {
    renderWithProviders(<NewOrders />, { route: "/new-orders", preloadedState: stateFor("registrator", "HQ") });

    expect(screen.getByText("Bekor qilinganlar")).toBeInTheDocument();
  });

  it("REGIONAL registratorida tab yo'q (mollar HQ omborida)", () => {
    renderWithProviders(<NewOrders />, {
      route: "/new-orders",
      preloadedState: stateFor("registrator", "REGIONAL"),
    });

    expect(screen.queryByText("Bekor qilinganlar")).not.toBeInTheDocument();
  });
});
