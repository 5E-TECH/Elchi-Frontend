import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "../../../test/test-utils";
import UserListPage from "./UserListPage";

/**
 * `/all-users` (dizayn v2): holat URL'da — `role` (tab), `status`, `search`, `page`, `limit`; filtr o'zgarsa
 * sahifa 1 ga qaytadi; so'rov parametrlari URL'dan. KPI faqat superadmin/admin; menejerda — 4 ta tab, KPI va
 * amallar yo'q.
 */

const mocks = vi.hoisted(() => ({ useGetUser: vi.fn() }));

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: mocks.useGetUser,
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

const ITEMS = [
  { id: "1", name: "Mehr Kosmetika", phone_number: "+998941173984", role: "market", status: "active", createdAt: "2026-10-01T09:40:00.000Z" },
  { id: "2", name: "Jasur Tursunov", phone_number: "+998904121855", role: "courier", status: "inactive", createdAt: "2026-10-06T09:30:00.000Z" },
];

const listResponse = (overrides: Record<string, unknown> = {}) => ({
  data: {
    data: {
      items: ITEMS,
      meta: { page: 1, limit: 10, total: 1286, totalPages: 129, totalMarket: 342, totalEmployees: 944, totalUsers: 1286, ...overrides },
    },
  },
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

/** Joriy URL — sahifa yozgan parametrlarni tekshirish uchun. */
const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
};
const currentSearch = () => new URLSearchParams(screen.getByTestId("location").textContent ?? "");

const listCalls = () =>
  mocks.useGetUser.mock.calls.filter(([params]) => !(params?.page === 1 && params?.limit === 1));
const lastListParams = () => listCalls().at(-1)?.[0];

const render = (route: string, role = "superadmin", user?: Record<string, unknown>) =>
  renderWithProviders(
    <>
      <UserListPage />
      <LocationProbe />
    </>,
    {
      route,
      preloadedState: {
        role: { id: "1", role, region: null, name: role },
        ...(user
          ? {
              user: {
                user,
                isAuthenticated: true,
                accessToken: null,
                loading: false,
                isAppInitializing: false,
                error: null,
              },
            }
          : {}),
      } as never,
    },
  );

beforeEach(() => {
  mocks.useGetUser.mockReset().mockImplementation(() => listResponse());
});

describe("UserListPage — superadmin/admin (maket `superadmin-users-list`)", () => {
  it("sarlavha, «Foydalanuvchi qo'shish», KPI va 9 ta rol tabi (FY-S1 tartibi)", () => {
    render("/all-users");

    expect(screen.getByRole("heading", { level: 1, name: "Foydalanuvchilar" })).toBeInTheDocument();
    expect(screen.getByText("Xodimlar, marketlar va mijozlar hisoblarini boshqarish")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Foydalanuvchi qo'shish" })).toHaveAttribute("href", "/all-users/create-user");
    const kpi = screen.getAllByRole("region", { name: "Foydalanuvchilar soni" })[0];
    expect(kpi).toHaveTextContent("1 286");
    expect(kpi).toHaveTextContent("Jamining 26,6%");
    expect(kpi).toHaveTextContent("Jamining 73,4%");
    // Mijozlar — `GET /users` da yo'q: «shundan … mijoz» chizilmaydi.
    expect(kpi).not.toHaveTextContent("mijoz");
    const tabs = screen.getByRole("tablist", { name: "Rol bo'yicha" });
    expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Hammasi",
      "Adminlar",
      "Menejerlar",
      "Ro'yxatchilar",
      "Kuryerlar",
      "Logistlar",
      "Marketlar",
      "Market operatorlari",
      "Investorlar",
    ]);
    // Eski «Operatorlar» tabi olindi.
    expect(within(tabs).queryByRole("tab", { name: "Operatorlar" })).not.toBeInTheDocument();
    // KPI — filtrsiz alohida yengil so'rov.
    expect(mocks.useGetUser).toHaveBeenCalledWith({ page: 1, limit: 1 }, true, { silentError: true });
    expect(lastListParams()).toEqual({ page: 1, limit: 10 });
    expect(screen.getByText("1–10 / 1 286 ta foydalanuvchi")).toBeInTheDocument();
  });

  it("URL'dagi filtrlar so'rovga o'tadi", () => {
    render("/all-users?role=courier&status=inactive&search=Jasur&page=3&limit=25");

    expect(lastListParams()).toEqual({ page: 3, limit: 25, role: "courier", status: "inactive", search: "Jasur" });
    expect(screen.getByRole("tab", { name: "Kuryerlar" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("searchbox", { name: "Foydalanuvchilarni qidirish" })).toHaveValue("Jasur");
    expect(screen.getByRole("combobox", { name: "Holat" })).toHaveTextContent("Nofaol");
  });

  it.each([
    ["Logistlar", "logist"],
    ["Market operatorlari", "market_operator"],
    ["Investorlar", "investor"],
  ])("yangi «%s» tabi — `role=%s` so'rovga ketadi", async (label, role) => {
    const user = userEvent.setup();
    render("/all-users");

    await user.click(screen.getByRole("tab", { name: label }));

    expect(currentSearch().get("role")).toBe(role);
    expect(lastListParams()).toEqual({ page: 1, limit: 10, role });
  });

  it("eski yoki ko'rinuvchida tabi yo'q rol (`operator`) — «Hammasi», so'rovga ketmaydi", () => {
    render("/all-users?role=operator");

    expect(screen.getByRole("tab", { name: "Hammasi" })).toHaveAttribute("aria-selected", "true");
    expect(lastListParams()).toEqual({ page: 1, limit: 10 });
  });

  it("telefon: tablar o'rnida «Rol: Hammasi» tanlovi — «Xodimlar» va «Tashqi hisoblar» guruhlari, URL `role`", async () => {
    const user = userEvent.setup();
    render("/all-users?page=3");

    // Tablar telefonda yashirin (`max-md:hidden`), tanlov — faqat telefonda (`md:hidden`).
    expect(screen.getByRole("tablist", { name: "Rol bo'yicha" }).closest(".max-md\\:hidden")).not.toBeNull();
    const select = screen.getByRole("combobox", { name: "Rol" });
    expect(select.closest(".md\\:hidden")).not.toBeNull();
    expect(select).toHaveTextContent("Hammasi");

    await user.click(select);
    const list = screen.getByRole("listbox", { name: "Rol bo'yicha" });
    expect(within(list).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Hammasi",
      "Adminlar",
      "Menejerlar",
      "Ro'yxatchilar",
      "Kuryerlar",
      "Logistlar",
      "Marketlar",
      "Market operatorlari",
      "Investorlar",
    ]);
    const staff = within(list).getByRole("group", { name: "Xodimlar" });
    expect(within(staff).getAllByRole("option")).toHaveLength(5);
    const external = within(list).getByRole("group", { name: "Tashqi hisoblar" });
    expect(within(external).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Marketlar",
      "Market operatorlari",
      "Investorlar",
    ]);

    await user.click(within(external).getByRole("option", { name: "Market operatorlari" }));
    expect(currentSearch().get("role")).toBe("market_operator");
    expect(currentSearch().get("page")).toBe("1");
    expect(lastListParams()).toEqual({ page: 1, limit: 10, role: "market_operator" });
    expect(screen.getByRole("tab", { name: "Market operatorlari" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("combobox", { name: "Rol" })).toHaveTextContent("Market operatorlari");
  });

  it("tab almashsa — `role` URL'ga yoziladi va sahifa 1 ga qaytadi", async () => {
    const user = userEvent.setup();
    render("/all-users?page=4");

    await user.click(screen.getByRole("tab", { name: "Marketlar" }));

    expect(currentSearch().get("role")).toBe("market");
    expect(currentSearch().get("page")).toBe("1");
    expect(lastListParams()).toEqual({ page: 1, limit: 10, role: "market" });
  });

  it("holat filtri — URL `status`, × → «Barchasi»", async () => {
    const user = userEvent.setup();
    render("/all-users?page=2");

    await user.click(screen.getByRole("combobox", { name: "Holat" }));
    await user.click(screen.getByRole("option", { name: "Faol" }));

    expect(currentSearch().get("status")).toBe("active");
    expect(currentSearch().get("page")).toBe("1");

    await user.click(screen.getByRole("combobox", { name: "Holat" }));
    await user.click(screen.getByRole("option", { name: "Barchasi" }));
    expect(currentSearch().has("status")).toBe(false);
  });

  it("qidiruv — kechikib URL `search` ga yoziladi; Enter — darhol", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render("/all-users");

      const box = screen.getByRole("searchbox", { name: "Foydalanuvchilarni qidirish" });
      await user.type(box, "Mehr");
      expect(currentSearch().has("search")).toBe(false);
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      await waitFor(() => expect(currentSearch().get("search")).toBe("Mehr"));
      expect(lastListParams()).toEqual({ page: 1, limit: 10, search: "Mehr" });

      await user.clear(box);
      await user.type(box, "Jasur{Enter}");
      expect(currentSearch().get("search")).toBe("Jasur");
    } finally {
      vi.useRealTimers();
    }
  });

  it("eski `userRole/userStatus/userSearch` kalitlari yangisiga ko'chiriladi (`marketing` → `market`)", async () => {
    render("/all-users?userRole=marketing&userStatus=active&userSearch=Baraka");

    await waitFor(() => expect(currentSearch().get("role")).toBe("market"));
    expect(currentSearch().get("status")).toBe("active");
    expect(currentSearch().get("search")).toBe("Baraka");
    expect(currentSearch().has("userRole")).toBe(false);
    expect(lastListParams()).toEqual({ page: 1, limit: 10, role: "market", status: "active", search: "Baraka" });
  });

  it("filtr bilan bo'sh — «Mos foydalanuvchi topilmadi» va filtrlarni tozalash", async () => {
    mocks.useGetUser.mockImplementation((params: { limit?: number }) =>
      params?.limit === 1 ? listResponse() : { ...listResponse(), data: { data: { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } } } },
    );
    const user = userEvent.setup();
    render("/all-users?status=inactive&search=zzz");

    expect(screen.getByText("Mos foydalanuvchi topilmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));

    expect(currentSearch().has("status")).toBe(false);
    expect(currentSearch().has("search")).toBe(false);
  });

  it("xato — «Foydalanuvchilarni yuklab bo'lmadi» + «Qayta urinish»", async () => {
    const refetch = vi.fn();
    mocks.useGetUser.mockImplementation((params: { limit?: number }) =>
      params?.limit === 1
        ? listResponse()
        : { data: undefined, isLoading: false, isError: true, error: { response: { status: 500 } }, refetch },
    );
    const user = userEvent.setup();
    render("/all-users");

    expect(screen.getByText("Foydalanuvchilarni yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("KPI so'rovi yiqilsa — skelet emas, xato holati va «Qayta urinish» (ro'yxat ishlayveradi)", async () => {
    const kpiRefetch = vi.fn();
    mocks.useGetUser.mockImplementation((params: { limit?: number }) =>
      params?.limit === 1
        ? { data: undefined, isLoading: false, isFetching: false, isError: true, error: { response: { status: 500 } }, refetch: kpiRefetch }
        : listResponse(),
    );
    const user = userEvent.setup();
    render("/all-users");

    const kpi = screen.getByRole("region", { name: "Foydalanuvchilar soni" });
    await user.click(within(kpi).getByRole("button", { name: "Qayta urinish" }));
    expect(kpiRefetch).toHaveBeenCalled();
    expect(screen.getAllByText("Mehr Kosmetika").length).toBeGreaterThan(0);
  });
});

describe("UserListPage — menejer (maket `manager-users-list`)", () => {
  it("filial nomi sarlavhada, KPI yo'q, 4 ta tab, amallar o'rnida «Ochish»", () => {
    render("/all-users", "manager", { id: "70", role: "manager", branch: { branch: { id: "44", name: "Urgut filiali", type: "HYBRID" } } });

    expect(screen.getByText("Urgut filiali xodimlari va marketlari")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Foydalanuvchilar soni" })).not.toBeInTheDocument();
    expect(mocks.useGetUser).toHaveBeenCalledWith({ page: 1, limit: 1 }, false, { silentError: true });
    const tabs = screen.getByRole("tablist", { name: "Rol bo'yicha" });
    expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Hammasi",
      "Kuryerlar",
      "Ro'yxatchilar",
      "Marketlar",
    ]);
    // Menejerda 4 ta tab telefonda ham sig'adi — «Rol» tanlovi yo'q, tablar yashirilmaydi.
    expect(screen.queryByRole("combobox", { name: "Rol" })).not.toBeInTheDocument();
    expect(tabs.closest(".max-md\\:hidden")).toBeNull();
    expect(screen.queryByRole("button", { name: /amallari$/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Mehr Kosmetika tafsilotlari" })[0]).toHaveAttribute(
      "href",
      "/all-users/1",
    );
  });
});
