import { screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { UserListTable } from "./UserListTable";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * pe71yf8L — «Marketlar» / «Market operatorlari» tablarida «Faollik» ustuni: «Online» yoki «Offline» + oxirgi
 * faollik; hech kirmagan — «Hali kirmagan»; ma'lumot kelmagan qator — «—». Boshqa tablarda ustun yo'q.
 */
const device = vi.hoisted(() => ({ phone: false }));

vi.mock("../../../shared/ui/primitives/date/useIsPhone", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/ui/primitives/date/useIsPhone")>()),
  useIsPhone: () => device.phone,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    updateUserStatus: { mutate: vi.fn() },
    deleteUser: { mutate: vi.fn(), isPending: false },
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    updateUser: { mutateAsync: vi.fn(), isPending: false },
    updateMyProfile: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const NOW = new Date("2026-11-27T10:00:00.000Z");

const markets = [
  {
    id: "26",
    name: "Online Market",
    phone_number: "+998901234567",
    role: "market",
    status: "active",
    createdAt: "2026-09-03T09:00:00.000Z",
    is_online: true,
    last_login_at: "2026-11-27T08:00:00.000Z",
    last_seen_at: "2026-11-27T08:00:00.000Z",
  },
  {
    id: "27",
    name: "Offline Market",
    phone_number: "+998901234568",
    role: "market",
    status: "active",
    createdAt: "2026-09-03T09:00:00.000Z",
    is_online: false,
    last_login_at: "2026-11-27T06:00:00.000Z",
    last_seen_at: "2026-11-27T08:00:00.000Z",
  },
  {
    id: "28",
    name: "Yangi Market",
    phone_number: "+998901234569",
    role: "market",
    status: "active",
    createdAt: "2026-11-26T09:00:00.000Z",
    is_online: false,
    last_login_at: null,
    last_seen_at: null,
  },
  {
    id: "29",
    name: "Eski backend",
    phone_number: "+998901234560",
    role: "market",
    status: "active",
    createdAt: "2026-11-26T09:00:00.000Z",
  },
];

const rowOf = (table: HTMLElement, name: string) => within(table).getByText(name).closest("tr") as HTMLElement;

describe("pe71yf8L — «Faollik» ustuni", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    device.phone = false;
  });

  it("⭐ TC1/TC2/TC4: Online · Offline + «2 soat oldin» (title — to'liq vaqt) · «Hali kirmagan» · ma'lumotsiz «—»", () => {
    renderWithProviders(<UserListTable users={markets as never} canManage showActivity />);
    const table = screen.getByRole("table", { name: "Foydalanuvchilar ro'yxati" });

    const headers = within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent?.trim());
    // «Telegram boti» darhol «Holat» dan keyin qoladi; «Faollik» — undan keyin.
    expect(headers.indexOf("Telegram boti")).toBe(headers.indexOf("Holat") + 1);
    expect(headers.indexOf("Faollik")).toBe(headers.indexOf("Telegram boti") + 1);

    const online = within(rowOf(table, "Online Market"));
    expect(online.getByText("Online")).toBeInTheDocument();
    expect(online.queryByText("Offline")).not.toBeInTheDocument();

    const offline = within(rowOf(table, "Offline Market"));
    expect(offline.getByText("Offline")).toBeInTheDocument();
    const ago = offline.getByText("2 soat oldin");
    expect(ago.tagName).toBe("TIME");
    expect(ago).toHaveAttribute("datetime", "2026-11-27T08:00:00.000Z");
    expect(ago).toHaveAttribute("title", "Bugun, 13:00");

    const fresh = within(rowOf(table, "Yangi Market"));
    expect(fresh.getByText("Offline")).toBeInTheDocument();
    expect(fresh.getByText("Hali kirmagan")).toBeInTheDocument();

    const legacy = within(rowOf(table, "Eski backend"));
    expect(legacy.queryByText("Online")).not.toBeInTheDocument();
    expect(legacy.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("⭐ TC9: `showActivity` siz (boshqa tablar) — ustun ham, belgi ham yo'q", () => {
    renderWithProviders(<UserListTable users={markets as never} canManage />);
    const table = screen.getByRole("table", { name: "Foydalanuvchilar ro'yxati" });
    expect(within(table).queryByRole("columnheader", { name: /Faollik/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
  });

  it("⭐ TC7: menejer (canManage yo'q) — «Faollik» «Holat» dan keyin", () => {
    renderWithProviders(<UserListTable users={markets as never} showActivity />);
    const table = screen.getByRole("table", { name: "Foydalanuvchilar ro'yxati" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent?.trim());
    expect(headers.indexOf("Faollik")).toBe(headers.indexOf("Holat") + 1);
    expect(within(rowOf(table, "Online Market")).getByText("Online")).toBeInTheDocument();
  });

  it("⭐ TC10: telefon kartasida ham Online / Offline va vaqt", () => {
    device.phone = true;
    renderWithProviders(<UserListTable users={markets as never} canManage showActivity />);
    const cards = screen.getByRole("list", { name: "Foydalanuvchilar" });
    expect(within(cards).getAllByText("Online")).toHaveLength(1);
    expect(within(cards).getAllByText("Offline")).toHaveLength(2);
    expect(within(cards).getByText("2 soat oldin")).toBeInTheDocument();
    expect(within(cards).getByText("Hali kirmagan")).toBeInTheDocument();
  });

  it("market operatori qatori ham (o'z akkaunti); xodim qatorida — «—»", () => {
    const rows = [
      { ...markets[0], id: "41", name: "Operator Kamola", role: "market_operator", is_online: false, last_seen_at: "2026-11-27T09:30:00.000Z" },
      { id: "25", name: "Bahrom", phone_number: "+998901111111", role: "courier", status: "active", createdAt: "2026-09-01T09:00:00.000Z" },
    ];
    renderWithProviders(<UserListTable users={rows as never} canManage showActivity />);
    const table = screen.getByRole("table", { name: "Foydalanuvchilar ro'yxati" });
    const operator = within(rowOf(table, "Operator Kamola"));
    expect(operator.getByText("Offline")).toBeInTheDocument();
    expect(operator.getByText("30 daqiqa oldin")).toBeInTheDocument();
    const courier = within(rowOf(table, "Bahrom"));
    expect(courier.queryByText("Offline")).not.toBeInTheDocument();
  });
});
