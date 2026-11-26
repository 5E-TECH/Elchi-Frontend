import { screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { User, UserRole } from "../../../entities/user/types/user";
import { UserDetailView } from "./UserDetailView";

/**
 * pe71yf8L — market (va market operatori) tafsiloti, «Aloqa va sanalar»: «Faollik» (Online / Offline), «Oxirgi kirish»
 * (sana-vaqt + nisbiy), «Oxirgi faollik» (online — «Hozir»). Xodim tafsilotida bu bandlar yo'q.
 */

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  updateMarketAddOrder: vi.fn(),
  updateMarketExpenseProof: vi.fn(),
  updateMarketCancelledHandoverQr: vi.fn(),
  updateMarketExtraCost: vi.fn(),
  updateMarketCashboxDebt: vi.fn(),
  updateMarketProblemPhone: vi.fn(),
  updateMarketTelegramGroupPii: vi.fn(),
}));

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    updateUser: { mutateAsync: mocks.updateUser, isPending: false },
    updateMarketAddOrder: { mutateAsync: mocks.updateMarketAddOrder, isPending: false },
    updateMarketExpenseProof: { mutateAsync: mocks.updateMarketExpenseProof, isPending: false },
    updateMarketCancelledHandoverQr: { mutateAsync: mocks.updateMarketCancelledHandoverQr, isPending: false },
    updateMarketExtraCost: { mutateAsync: mocks.updateMarketExtraCost, isPending: false },
    updateMarketCashboxDebt: { mutateAsync: mocks.updateMarketCashboxDebt, isPending: false },
    updateMarketProblemPhone: { mutateAsync: mocks.updateMarketProblemPhone, isPending: false },
    updateMarketTelegramGroupPii: { mutateAsync: mocks.updateMarketTelegramGroupPii, isPending: false },
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    updateMyProfile: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

// Karta o'z so'rovlarini yuboradi (o'z testi — `MarketTelegramGroupsCard.test.tsx`); bu yerda faqat kim ko'radi.
vi.mock("./MarketTelegramGroupsCard", () => ({
  MarketTelegramGroupsCard: ({ user, mode }: { user: User; mode: string }) => (
    <section aria-label="Telegram guruhi" data-mode={mode} data-market-id={user.id} />
  ),
}));

// «Xizmat viloyatlari» ham o'z so'rovlarini yuboradi (o'z testi — `CourierRegionsCard.test.tsx`); bu yerda kim ko'radi.
vi.mock("./CourierRegionsCard", () => ({
  CourierRegionsCard: ({ user }: { user: User }) => (
    <section aria-label="Xizmat viloyatlari" data-courier-id={user.id} />
  ),
}));

// «Hisob» (B1te60bD) o'z so'rovlarini yuboradi (o'z testi — `OperatorAccountSection.test.tsx`); bu yerda kim ko'radi.
vi.mock("./OperatorAccountSection", () => ({
  OperatorAccountSection: ({ operatorId, marketName }: { operatorId: string; marketName?: string | null }) => (
    <section aria-label="Operator hisobi" data-operator-id={operatorId} data-market={marketName ?? ""} />
  ),
}));

vi.mock("../../../features/courier-transfer-branch", () => ({
  TransferCourierButton: ({
    courierId,
    courierName,
    variant,
  }: {
    courierId: string;
    courierName?: string;
    variant?: string;
  }) => (
    <button type="button" data-testid={`transfer-${courierId}`} data-variant={variant}>
      {courierName}
    </button>
  ),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const makeUser = (role: UserRole, overrides: Partial<User> = {}): User => ({
  id: "201",
  name: "Baraka Shop",
  phone_number: "+998903152241",
  username: "baraka_shop",
  role,
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-09-29T09:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
  is_deleted: false,
  tariff_home: 35000,
  tariff_center: 25000,
  default_tariff: "home",
  add_order: true,
  cancelled_handover_qr_required: true,
  expense_proof_conditions: ["sell_any"],
  ...overrides,
});

const stateFor = (role: string, branchName?: string) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    ...(branchName
      ? {
          user: {
            user: { id: `${role}-1`, role, branch: { branch: { id: "44", name: branchName, type: "REGIONAL" } } },
            isAuthenticated: true,
            accessToken: null,
            loading: false,
            isAppInitializing: false,
            error: null,
          },
        }
      : {}),
  }) as never;

const renderView = (user: User, viewerRole: string, branchName?: string) =>
  renderWithProviders(<UserDetailView user={user} />, { preloadedState: stateFor(viewerRole, branchName) });

const NOW = new Date("2026-11-27T10:00:00.000Z");

describe("pe71yf8L — tafsilotda faollik", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  const contact = () => within(screen.getByRole("region", { name: "Aloqa va sanalar" }));

  it("⭐ TC1: online market — «Online», oxirgi kirish (sana-vaqt + «2 soat oldin»), oxirgi faollik «Hozir»", () => {
    renderView(
      makeUser("market", {
        is_online: true,
        last_login_at: "2026-11-27T08:00:00.000Z",
        last_seen_at: "2026-11-27T09:00:00.000Z",
      }),
      "superadmin",
    );
    const card = contact();
    expect(card.getByText("Faollik")).toBeInTheDocument();
    expect(card.getByText("Online")).toBeInTheDocument();
    expect(card.getByText("Oxirgi kirish")).toBeInTheDocument();
    expect(card.getByText("Bugun, 13:00")).toBeInTheDocument();
    expect(card.getByText("2 soat oldin")).toBeInTheDocument();
    expect(card.getByText("Oxirgi faollik")).toBeInTheDocument();
    expect(card.getByText("Hozir")).toBeInTheDocument();
    // Avvalgi bandlar joyida.
    expect(card.getByText("Ro'yxatdan o'tgan")).toBeInTheDocument();
  });

  it("⭐ TC2: offline market — «Offline», oxirgi faollik = uzilish vaqti, oxirgi kirish o'zgarmaydi", () => {
    renderView(
      makeUser("market", {
        is_online: false,
        last_login_at: "2026-11-27T06:00:00.000Z",
        last_seen_at: "2026-11-27T09:30:00.000Z",
      }),
      "admin",
    );
    const card = contact();
    expect(card.getByText("Offline")).toBeInTheDocument();
    expect(card.getByText("4 soat oldin")).toBeInTheDocument();
    expect(card.getByText("30 daqiqa oldin")).toBeInTheDocument();
    expect(card.queryByText("Hozir")).not.toBeInTheDocument();
  });

  it("⭐ TC4: hech kirmagan market — «Offline», ikkala vaqt «Hali kirmagan»", () => {
    renderView(makeUser("market", { is_online: false, last_login_at: null, last_seen_at: null }), "superadmin");
    const card = contact();
    expect(card.getByText("Offline")).toBeInTheDocument();
    expect(card.getAllByText("Hali kirmagan")).toHaveLength(2);
  });

  it("faollik xizmati javob bermagan (last_* yo'q) — «—»; is_online baribir", () => {
    renderView(makeUser("market", { is_online: true }), "superadmin");
    const card = contact();
    expect(card.getByText("Online")).toBeInTheDocument();
    expect(card.getByText("Oxirgi kirish").parentElement).toHaveTextContent("—");
  });

  it("⭐ TC8: market operatori — o'z holati bilan", () => {
    renderView(
      makeUser("market_operator", { is_online: false, last_login_at: "2026-11-26T10:00:00.000Z", last_seen_at: null }),
      "superadmin",
    );
    expect(contact().getByText("Offline")).toBeInTheDocument();
    // last_seen_at yo'q — oxirgi faollik = oxirgi kirish.
    expect(contact().getAllByText("1 kun oldin")).toHaveLength(2);
  });

  it("⭐ TC7: menejer o'zi yaratgan market tafsilotida holatni ko'radi", () => {
    renderView(makeUser("market", { is_online: true, last_login_at: null, last_seen_at: null, can_manage: false }), "manager", "Andijon filiali");
    expect(contact().getByText("Online")).toBeInTheDocument();
  });

  it("⭐ TC9: kuryer tafsilotida faollik bandlari yo'q", () => {
    renderView(makeUser("courier"), "superadmin");
    const card = contact();
    expect(card.queryByText("Faollik")).not.toBeInTheDocument();
    expect(card.queryByText("Oxirgi kirish")).not.toBeInTheDocument();
  });
});
