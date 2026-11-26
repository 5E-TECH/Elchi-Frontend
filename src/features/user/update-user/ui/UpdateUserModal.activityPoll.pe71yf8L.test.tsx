import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import type { User } from "../../../../entities/user/types/user";
import { UpdateUserModal } from "./UpdateUserModal";

/**
 * pe71yf8L: «Marketlar» ro'yxati va market tafsiloti «Online / Offline» uchun har 60 s qayta so'raladi — har safar
 * yangi `initialUser` obyekti keladi. Oyna ochiq turganda faqat faollik o'zgarsa: kiritilgan qiymat ham, saqlashdagi
 * xato ham joyida qoladi. Serverda boshqa maydon o'zgarsa — tegilmagan maydon yangilanadi, kiritilgan va xato qoladi.
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

vi.mock("../../../../entities/user/api/userApi", () => ({
  user: "user",
  useUser: () => ({
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    updateUser: { mutateAsync: vi.fn(), isPending: false },
    updateMyProfile: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("../../../../entities/logistics/api/logisticsApi", () => ({
  useLogistics: () => ({ useGetDistricts: () => ({ data: [], isLoading: false, isError: false }) }),
}));

vi.mock("../../../../shared/lib/useLogout", () => ({
  useLogout: () => ({ logout: vi.fn() }),
}));

const market = (overrides: Partial<User> = {}): User => ({
  id: "389",
  name: "Online Market",
  phone_number: "+998903500001",
  username: "online_market",
  role: "market",
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-09-09T09:00:00.000Z",
  updatedAt: "2026-10-02T09:00:00.000Z",
  is_deleted: false,
  tariff_home: 30_000,
  tariff_center: 25_000,
  default_tariff: "home",
  can_manage: true,
  is_online: true,
  last_login_at: "2026-11-27T08:00:00.000Z",
  last_seen_at: "2026-11-27T08:00:00.000Z",
  ...overrides,
});

const harness: { set?: (next: User) => void } = {};

const Harness = ({ initial }: { initial: User }) => {
  const [row, setRow] = useState(initial);
  useEffect(() => {
    harness.set = setRow;
  }, []);
  return <UpdateUserModal userId={row.id} initialUser={row} onClose={vi.fn()} />;
};

const renderModal = () =>
  renderWithProviders(<Harness initial={market()} />, {
    preloadedState: {
      role: { id: "25", role: "manager", region: null, name: "Menejer" },
      user: {
        user: { id: "25", role: "manager" },
        isAuthenticated: true,
        accessToken: null,
        loading: false,
        isAppInitializing: false,
        error: null,
      },
    } as never,
  });

describe("pe71yf8L — UpdateUserModal: faollik so'rovi formani buzmaydi", () => {
  it("⭐ faqat Online / Offline o'zgarsa — saqlashdagi xato va kiritilgan qiymat qoladi", async () => {
    const user = userEvent.setup();
    renderModal();

    const name = screen.getByRole("textbox", { name: /Market nomi/ });
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));
    expect(await screen.findByText("Ism Familya talab qilinadi")).toBeInTheDocument();

    // 60 s so'rov: yangi obyekt, faqat faollik o'zgargan.
    act(() => harness.set?.(market({ is_online: false, last_seen_at: "2026-11-27T08:05:00.000Z" })));

    expect(screen.getByText("Ism Familya talab qilinadi")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Market nomi/ })).toHaveValue("");
  });

  it("serverda boshqa maydon o'zgarsa — tegilmagan maydon yangilanadi, kiritilgan qiymat va xato joyida", async () => {
    const user = userEvent.setup();
    renderModal();

    const name = screen.getByRole("textbox", { name: /Market nomi/ });
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));
    expect(await screen.findByText("Ism Familya talab qilinadi")).toBeInTheDocument();

    act(() => harness.set?.(market({ name: "Boshqa admin o'zgartirdi", tariff_home: 35_000, is_online: false })));

    expect(screen.getByRole("textbox", { name: /Market nomi/ })).toHaveValue("");
    expect(screen.getByText("Ism Familya talab qilinadi")).toBeInTheDocument();
    expect(screen.getByDisplayValue("35 000")).toBeInTheDocument();
  });
});
