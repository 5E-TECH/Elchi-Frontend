import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestStore } from "../../../test/test-utils";
import { queryKeys } from "../../../shared/config/queryKeys";
import { useUser } from "./userApi";
import { useUsers } from "./useUsers";

/**
 * SZTZ4HEU (a06642): foydalanuvchi mutatsiyalari faqat `[user]` ni emas, `queryKeys.users` ni ham eskirtiradi —
 * filial «Xodim qo'shish» oynasi (`AddEmployeeModal` → `useUsers`) yangi xodimni 30 s `staleTime` kutmasdan ko'rsatadi.
 * HAQIQIY `QueryClient`: kesh holati (`isInvalidated`) va faol so'rovning qayta yuborilishi tekshiriladi.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api }));
vi.mock("../../../shared/api/instance", () => ({ api }));

// «Xodim qo'shish» oynasi aynan shu parametrlar bilan so'raydi.
const MODAL_PARAMS = { status: "active", role: ["manager", "registrator", "courier"], page: 1, limit: 100 } as const;
const MODAL_KEY = queryKeys.users.list(MODAL_PARAMS);

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={createTestStore()}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
  // Oyna avval ochilgan: kesh to'la va hali «yangi» (staleTime ichida), kuzatuvchisi yo'q (oyna yopiq).
  queryClient.setQueryData(MODAL_KEY, [{ id: "5", fullName: "Eski kuryer", username: "+998900000005" }]);
  const hook = renderHook(() => useUser(), { wrapper });
  return { queryClient, wrapper, ...hook };
};

type Mutations = ReturnType<typeof useUser>;
type Case = [name: string, run: (m: Mutations) => Promise<unknown>];

const CASES: Case[] = [
  ["createAdmin", (m) => m.createAdmin.mutateAsync({ name: "A", phone_number: "+998901112233", password: "1234", salary: 1, payment_day: 1 })],
  ["createRegistrator", (m) => m.createRegistrator.mutateAsync({ name: "R", phone_number: "+998901112233", password: "1234", salary: 1, payment_day: 1, branch_id: "12" })],
  ["createManager", (m) => m.createManager.mutateAsync({ name: "M", phone_number: "+998901112233", password: "1234", branch_id: "12" })],
  ["createMarket", (m) => m.createMarket.mutateAsync({ name: "Mk", phone_number: "+998901112233", password: "1234" } as never)],
  ["createCourier", (m) => m.createCourier.mutateAsync({ name: "K", phone_number: "+998901112233", password: "1234" })],
  ["createLogist", (m) => m.createLogist.mutateAsync({ name: "L", phone_number: "+998901112233", password: "1234", salary: 1 })],
  ["updateUserStatus", (m) => m.updateUserStatus.mutateAsync({ id: "5", status: "inactive" as never })],
  ["updateUser", (m) => m.updateUser.mutateAsync({ id: "5", data: { name: "Yangi ism" } })],
  ["updateMyProfile", (m) => m.updateMyProfile.mutateAsync({ name: "Men" })],
  ["updateMarketAddOrder", (m) => m.updateMarketAddOrder.mutateAsync({ id: "5", add_order: true })],
  ["updateMarketExpenseProof", (m) => m.updateMarketExpenseProof.mutateAsync({ id: "5", expense_proof_conditions: [] })],
  ["updateMarketCancelledHandoverQr", (m) => m.updateMarketCancelledHandoverQr.mutateAsync({ id: "5", cancelled_handover_qr_required: true })],
  ["updateMarketExtraCost", (m) => m.updateMarketExtraCost.mutateAsync({ id: "5", extra_cost_enabled: true })],
  ["updateMarketTelegramGroupPii", (m) => m.updateMarketTelegramGroupPii.mutateAsync({ id: "5", tg_group_show_customer_pii: true })],
  ["deleteUser", (m) => m.deleteUser.mutateAsync("5")],
];

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue({ data: { statusCode: 200, data: { id: "57" } } });
});

describe("useUser mutatsiyalari → queryKeys.users (filial «Xodim qo'shish» ro'yxati)", () => {
  it("useUser hamma mutatsiyasi ro'yxatda (yangisi qo'shilsa shu test ham kengayadi)", () => {
    const { result } = setup();
    const mutationNames = Object.entries(result.current)
      .filter(([, value]) => typeof value === "object" && value !== null && "mutateAsync" in value)
      .map(([name]) => name)
      .sort();
    expect(mutationNames).toEqual(CASES.map(([name]) => name).sort());
  });

  it.each(CASES)("%s → useUsers keshi eskiradi (isInvalidated)", async (_name, run) => {
    const { result, queryClient } = setup();
    expect(queryClient.getQueryState(MODAL_KEY)?.isInvalidated).toBe(false);
    await act(async () => {
      await run(result.current);
    });
    expect(queryClient.getQueryState(MODAL_KEY)?.isInvalidated).toBe(true);
  });

  // Kuryer / menejer tanlovlari (`useGetCouriers` → `["couriers", params]`, `useGetManagers` → `["managers", params]`)
  // ham eskiradi — superadmin yaratgan kuryer tarqatish va to'lov tanlovida staleTime kutmasdan chiqadi.
  it.each(CASES)("%s → kuryer va menejer ro'yxatlari ham eskiradi", async (_name, run) => {
    const { result, queryClient } = setup();
    const couriersKey = ["couriers", { page: 1, limit: 100 }];
    const managersKey = ["managers", { page: 1, limit: 100 }];
    queryClient.setQueryData(couriersKey, { data: { items: [] } });
    queryClient.setQueryData(managersKey, { data: { items: [] } });
    await act(async () => {
      await run(result.current);
    });
    expect(queryClient.getQueryState(couriersKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(managersKey)?.isInvalidated).toBe(true);
  });

  it("oyna ochiq (faol useUsers) bo'lsa createCourier dan keyin GET /users darhol qayta yuboriladi", async () => {
    const { result, queryClient, wrapper } = setup();
    queryClient.removeQueries({ queryKey: MODAL_KEY });
    api.get.mockResolvedValue({ data: { data: { items: [{ id: "5", name: "Eski kuryer" }] } } });
    const modal = renderHook(() => useUsers({ ...MODAL_PARAMS, role: [...MODAL_PARAMS.role] }), { wrapper });
    await waitFor(() => expect(modal.result.current.data).toHaveLength(1));
    const getsBefore = api.get.mock.calls.length;

    api.get.mockResolvedValue({
      data: { data: { items: [{ id: "5", name: "Eski kuryer" }, { id: "57", name: "Yangi kuryer" }] } },
    });
    await act(async () => {
      await result.current.createCourier.mutateAsync({ name: "Yangi kuryer", phone_number: "+998901112233", password: "1234" });
    });

    await waitFor(() => expect(modal.result.current.data?.map((u) => u.fullName)).toContain("Yangi kuryer"));
    expect(api.get.mock.calls.length).toBeGreaterThan(getsBefore);
  });
});

/**
 * 2026-10-23: o'z parolini o'zgartirgach backend boshqa barcha qurilmalarni darhol chiqaradi — profil «Sessiyalar»
 * (`queryKeys.accountSessions`) eskiradi. Parolsiz yangilash yoki boshqa xodimning paroli — o'z sessiyalariga tegmaydi.
 */
describe("o'z paroli → «Sessiyalar» (queryKeys.accountSessions) eskiradi", () => {
  const setupWithProfile = (profileId: string) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
    });
    const store = createTestStore({
      user: {
        user: { id: profileId, name: "Men", role: "admin" },
        isAuthenticated: true,
        accessToken: null,
        loading: false,
        isAppInitializing: false,
        error: null,
      },
    } as never);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Provider>
    );
    queryClient.setQueryData(queryKeys.accountSessions.mine, { active_count: 2, sessions: [] });
    const hook = renderHook(() => useUser(), { wrapper });
    return { queryClient, ...hook };
  };
  beforeEach(() => {
    api.patch.mockResolvedValue({ data: { statusCode: 200, data: { id: "7", name: "Men", role: "admin" } } });
  });
  const sessionsInvalidated = (queryClient: QueryClient) =>
    queryClient.getQueryState(queryKeys.accountSessions.mine)?.isInvalidated;

  it.each<[string, (m: Mutations) => Promise<unknown>, boolean]>([
    ["updateMyProfile { password } → eskiradi", (m) => m.updateMyProfile.mutateAsync({ password: "yangi12" }), true],
    ["updateMyProfile { name } → tegmaydi", (m) => m.updateMyProfile.mutateAsync({ name: "Men" }), false],
    ["updateUser (o'zi) { password } → eskiradi", (m) => m.updateUser.mutateAsync({ id: "7", data: { password: "yangi12" } }), true],
    ["updateUser (boshqa xodim) { password } → tegmaydi", (m) => m.updateUser.mutateAsync({ id: "263", data: { password: "yangi12" } }), false],
  ])("%s", async (_name, run, expected) => {
    const { result, queryClient } = setupWithProfile("7");
    await act(async () => {
      await run(result.current);
    });
    expect(sessionsInvalidated(queryClient)).toBe(expected);
  });
});
