import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import type { User } from "../../../../entities/user/types/user";
import { UpdateUserModal } from "./UpdateUserModal";

/**
 * DtKKY0V8 (maket `superadmin-users-edit-courier-district`): kuryer «Ish hududi» → «Tuman» — viloyat tumanlari
 * (`GET region/:id`), ixtiyoriy; faqat o'zgarsa `PATCH /users/:id { district_id }` (× — `null`). 400 / 503 — maydon
 * ostida va xabarda i18n matni (server matni emas).
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  useGetDistricts: vi.fn(),
}));

vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    updateUser: { mutateAsync: mocks.updateUser, isPending: false },
    updateMyProfile: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("../../../../entities/logistics/api/logisticsApi", () => ({
  useLogistics: () => ({ useGetDistricts: mocks.useGetDistricts }),
}));

vi.mock("../../../../shared/lib/useLogout", () => ({
  useLogout: () => ({ logout: vi.fn() }),
}));

const SAMARQAND = { id: "14", name: "Samarqand viloyati", sato_code: "1718", createdAt: "", updatedAt: "" };

const courier = (overrides: Partial<User> = {}): User => ({
  id: "263",
  name: "Sherzod Alimov",
  phone_number: "+998935124408",
  username: "sherzod_alimov",
  role: "courier",
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-03-12T09:00:00.000Z",
  updatedAt: "2026-09-28T09:00:00.000Z",
  is_deleted: false,
  tariff_home: 25000,
  tariff_center: 15000,
  default_tariff: "home",
  region: SAMARQAND,
  district_id: "41",
  ...overrides,
});

const renderModal = (target: User, viewerRole = "superadmin") =>
  renderWithProviders(<UpdateUserModal userId={target.id} initialUser={target} onClose={vi.fn()} />, {
    preloadedState: {
      role: { id: "1", role: viewerRole, region: null, name: viewerRole },
      user: {
        user: { id: "1", role: viewerRole },
        isAuthenticated: true,
        accessToken: null,
        loading: false,
        isAppInitializing: false,
        error: null,
      },
    } as never,
  });

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

beforeEach(() => {
  mocks.updateUser.mockReset().mockResolvedValue({ statusCode: 200 });
  mocks.useGetDistricts.mockReset().mockImplementation((regionId?: string) => ({
    data:
      regionId === "14"
        ? [
            { id: 41, name: "Urgut tumani" },
            { id: 40, name: "Pastdarg'om tumani" },
          ]
        : undefined,
    isLoading: false,
    isError: false,
  }));
});

describe("UpdateUserModal — kuryer «Tuman» (DtKKY0V8)", () => {
  it("joriy tuman ko'rinadi, faqat shu viloyat tumanlari; izoh «Ixtiyoriy · faqat Samarqand viloyati tumanlari …»", async () => {
    const user = userEvent.setup();
    renderModal(courier());

    const district = screen.getByRole("combobox", { name: "Tuman" });
    expect(district).toHaveValue("Urgut tumani");
    expect(district).toHaveAccessibleDescription(
      "Ixtiyoriy · faqat Samarqand viloyati tumanlari, qidirib tanlanadi",
    );
    expect(mocks.useGetDistricts).toHaveBeenCalledWith("14", true);

    await user.click(district);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Pastdarg'om tumani",
      "Urgut tumani",
    ]);
  });

  it("tuman almashsa — `PATCH { district_id }`; tegilmasa yuborilmaydi", async () => {
    const user = userEvent.setup();
    renderModal(courier());

    await user.click(screen.getByRole("combobox", { name: "Tuman" }));
    await user.click(screen.getByRole("option", { name: "Pastdarg'om tumani" }));
    await save(user);

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "263", data: { district_id: "40" } });
  });

  it("× — tumansiz (`district_id: null`)", async () => {
    const user = userEvent.setup();
    renderModal(courier());

    await user.click(screen.getByRole("button", { name: "Tumanni tozalash" }));
    await save(user);

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ id: "263", data: { district_id: null } }));
  });

  it("400 «Tuman foydalanuvchining viloyatiga tegishli emas» — maydon ostida va xabarda i18n matni, oyna ochiq", async () => {
    mocks.updateUser.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { statusCode: 400, message: "Tuman foydalanuvchining viloyatiga tegishli emas" } },
    });
    const user = userEvent.setup();
    renderModal(courier({ district_id: null }));

    await user.click(screen.getByRole("combobox", { name: "Tuman" }));
    await user.click(screen.getByRole("option", { name: "Urgut tumani" }));
    await save(user);

    const text = "Tuman kuryer viloyatiga tegishli emas — shu viloyat tumanini tanlang";
    await waitFor(() => expect(screen.getAllByText(text).length).toBe(2));
    expect(screen.getByRole("combobox", { name: "Tuman" })).toHaveAccessibleDescription(new RegExp(text));
  });

  it("503 — «Tumanni tekshirib bo'lmadi …»", async () => {
    mocks.updateUser.mockRejectedValue({
      isAxiosError: true,
      response: { status: 503, data: { statusCode: 503, message: "Tumanni tekshirib bo'lmadi — birozdan keyin qayta urinib ko'ring" } },
    });
    const user = userEvent.setup();
    renderModal(courier());

    await user.click(screen.getByRole("combobox", { name: "Tuman" }));
    await user.click(screen.getByRole("option", { name: "Pastdarg'om tumani" }));
    await save(user);

    expect(
      (await screen.findAllByText("Tumanni tekshirib bo'lmadi — birozdan keyin qayta urinib ko'ring")).length,
    ).toBeGreaterThan(0);
  });

  it("viloyat biriktirilmagan kuryer — maydon o'chiq, sababi izohda", () => {
    renderModal(courier({ region: null, region_id: null }));
    const district = screen.getByRole("combobox", { name: "Tuman" });
    expect(district).toBeDisabled();
    expect(district).toHaveAccessibleDescription("Kuryerga viloyat biriktirilmagan — tuman tanlanmaydi");
  });
});
