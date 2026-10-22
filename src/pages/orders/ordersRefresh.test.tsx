import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import Orders from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { api } from "../../shared/api/api";
import { formatTimeLocalized } from "../../shared/lib/formatDateTime";
import { ORDERS_REFRESH_INTERVAL_MS } from "./list/useOrdersRefresh";

/**
 * OR-1 — kuryer bo'lmagan rollarda «Buyurtmalar» yangilanishi (haqiqiy React Query, `api.get` soxta):
 * sarlavha («Jami N» · «Oxirgi yangilanish: HH:mm» · «Avtomatik yangilanadi»), «Yangilash» (ro'yxat + qadalgan
 * buyurtma), xato ogohlantirishi (eski qatorlar qoladi, × yopadi, «Qayta urinish»), `meta.silentError` faqat
 * ma'lumot bo'lsa, 60 s / ilovaga qaytganda.
 */

vi.mock("./list/OrderFilters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./list/OrderFilters")>()),
  default: () => null,
}));

const row = (id: string, name: string) => ({
  id,
  status: "waiting",
  total_price: 185000,
  to_be_paid: 185000,
  where_deliver: "address",
  created_at: "2026-10-15T08:00:00.000Z",
  market: { id: "31", name: "Baraka Shop" },
  customer: { id: `c${id}`, name, phone_number: "+998902146631" },
  district: { id: "1", name: "Chilonzor tumani" },
  items: [],
});

const server = {
  rows: [row("10242", "Sevara Tursunova"), row("10241", "Dilnoza Karimova")],
  fail: false,
  calls: [] as string[],
};

const serverError = () => Object.assign(new Error("Request failed with status code 500"), {
  isAxiosError: true,
  response: { status: 500, data: { message: "internal: db timeout" } },
});

let getSpy: MockInstance;

beforeEach(() => {
  server.rows = [row("10242", "Sevara Tursunova"), row("10241", "Dilnoza Karimova")];
  server.fail = false;
  server.calls = [];
  getSpy = vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    server.calls.push(url);
    if (server.fail) throw serverError();
    if (url === "orders") {
      return { data: { statusCode: 200, data: server.rows, total: server.rows.length, page: 1, limit: 10 } };
    }
    if (url === "orders/10241") return { data: { statusCode: 200, data: server.rows[1] } };
    throw new Error(`kutilmagan so'rov: ${url}`);
  });
});

afterEach(() => {
  getSpy.mockRestore();
});

const adminState = { role: { id: "1", role: "admin", region: null, name: "Admin" } } as never;

const open = (route = "/orders") => renderWithProviders(<Orders />, { route, preloadedState: adminState });

const listCalls = () => server.calls.filter((url) => url === "orders").length;

describe("Buyurtmalar — yangilanish (OR-1, kuryer bo'lmagan rollar)", () => {
  it("sarlavha: «Jami N» · «Oxirgi yangilanish: HH:mm» (dataUpdatedAt) · «Avtomatik yangilanadi»", async () => {
    const { queryClient } = open();
    expect(await screen.findByText("Sevara Tursunova")).toBeInTheDocument();
    expect(screen.getByText("Jami 2 ta buyurtma")).toBeInTheDocument();

    const updatedAt = queryClient.getQueryCache().findAll({ queryKey: ["orders"] })[0].state.dataUpdatedAt;
    const time = document.querySelector("header time") as HTMLTimeElement;
    expect(time).toHaveTextContent(formatTimeLocalized(updatedAt));
    expect(time).toHaveAttribute("dateTime", new Date(updatedAt).toISOString());
    expect(time.parentElement).toHaveTextContent(/^Oxirgi yangilanish: \d{2}:\d{2}$/);
    const auto = screen.getByText("Avtomatik yangilanadi");
    expect(auto).toHaveAttribute("title", "Har daqiqada va ilovaga qaytganingizda");
  });

  it("«Yangilash»: desktopda ghost tugma (telefonda yashirin), telefonda sarlavha yonida ikonka tugma", async () => {
    open();
    await screen.findByText("Sevara Tursunova");
    // DOM tartibi: sarlavha qatoridagi ikonka tugma, keyin amallar qatoridagi ghost tugma.
    const [icon, ghost] = screen.getAllByRole("button", { name: "Ro'yxatni yangilash" });
    expect(ghost).toHaveTextContent("Yangilash");
    expect(ghost).toHaveAttribute("data-variant", "ghost");
    expect(ghost).toHaveClass("max-md:hidden");
    expect(icon).toHaveClass("ml-auto", "md:hidden");
    expect(icon.parentElement).toContainElement(screen.getByRole("heading", { level: 1, name: "Buyurtmalar" }));
  });

  it("«Yangilash» ro'yxatni va qadalgan (raqam bo'yicha) buyurtmani birga qayta so'raydi", async () => {
    const user = userEvent.setup();
    open("/orders?orderSearch=10241");
    await screen.findByText("Sevara Tursunova");
    await waitFor(() => expect(server.calls.filter((url) => url === "orders/10241")).toHaveLength(1));
    const before = listCalls();
    await user.click(screen.getAllByRole("button", { name: "Ro'yxatni yangilash" })[0]);
    await waitFor(() => expect(listCalls()).toBe(before + 1));
    await waitFor(() => expect(server.calls.filter((url) => url === "orders/10241")).toHaveLength(2));
  });

  it("yangilash yiqilsa: eski qatorlar qoladi, «Ro'yxat yangilanmadi» (tab sonlarisiz matn), × yopadi", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Sevara Tursunova");
    server.fail = true;
    await user.click(screen.getAllByRole("button", { name: "Ro'yxatni yangilash" })[0]);

    const alert = (await screen.findByText("Ro'yxat yangilanmadi")).closest('[role="alert"]') as HTMLElement;
    expect(alert).toHaveTextContent("Ro'yxat eskirgan bo'lishi mumkin.");
    expect(alert).not.toHaveTextContent("tab sonlari");
    // Xom backend matni ko'rsatilmaydi.
    expect(screen.queryByText(/db timeout/)).not.toBeInTheDocument();
    expect(screen.getByText("Sevara Tursunova")).toBeInTheDocument();
    expect(screen.getByText("Jami 2 ta buyurtma")).toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Ogohlantirishni yopish" }));
    expect(screen.queryByText("Ro'yxat yangilanmadi")).not.toBeInTheDocument();
    expect(screen.getByText("Sevara Tursunova")).toBeInTheDocument();
    // Fokus <body> ga tushmaydi — «Yangilash» tugmasiga qaytadi.
    expect(document.activeElement).toBe(screen.getAllByRole("button", { name: "Ro'yxatni yangilash" })[0]);
  });

  it("«Qayta urinish» — muvaffaqiyatli bo'lsa ogohlantirish yo'qoladi, yangi qatorlar chiqadi", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Sevara Tursunova");
    server.fail = true;
    await user.click(screen.getAllByRole("button", { name: "Ro'yxatni yangilash" })[0]);
    const alert = (await screen.findByText("Ro'yxat yangilanmadi")).closest('[role="alert"]') as HTMLElement;

    server.fail = false;
    server.rows = [row("10250", "Javohir Toshmatov"), ...server.rows];
    await user.click(within(alert).getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("Javohir Toshmatov")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Ro'yxat yangilanmadi")).not.toBeInTheDocument());
    expect(screen.getByText("Jami 3 ta buyurtma")).toBeInTheDocument();
    // «Qayta urinish» fokusda edi — ogohlantirish yo'qolganda fokus «Yangilash» ga o'tadi.
    expect(document.activeElement).toHaveAttribute("data-orders-refresh");
  });

  it("so'rov sozlamalari: 60 s, ilovaga qaytganda; global xato xabari faqat ma'lumot bo'lmaganda", async () => {
    const user = userEvent.setup();
    const { queryClient } = open();
    await screen.findByText("Sevara Tursunova");
    const listQuery = () => queryClient.getQueryCache().findAll({ queryKey: ["orders"] })[0];
    const observer = listQuery().observers[0];
    const interval = observer.options.refetchInterval as (query: unknown) => number | false;
    expect(interval(listQuery())).toBe(ORDERS_REFRESH_INTERVAL_MS);
    expect(observer.options.refetchOnWindowFocus).toBe(true);

    server.fail = true;
    await user.click(screen.getAllByRole("button", { name: "Ro'yxatni yangilash" })[0]);
    await screen.findByText("Ro'yxat yangilanmadi");
    // Ma'lumot bor edi — global «Server xatosi» xabari chiqmaydi, sahifa ogohlantirishi yetarli.
    expect(listQuery().meta).toEqual({ silentError: true });
  });

  it("birinchi yuklash yiqilsa (keshda ma'lumot yo'q) — meta.silentError YO'Q: global xato xabari chiqadi", async () => {
    server.fail = true;
    const { queryClient } = open();
    await waitFor(() => expect(listCalls()).toBeGreaterThan(0));
    const listQuery = () => queryClient.getQueryCache().findAll({ queryKey: ["orders"] })[0];
    await waitFor(() => expect(listQuery().state.status).toBe("error"));
    expect(listQuery().meta?.silentError).not.toBe(true);
    expect(screen.queryByText("Ro'yxat yangilanmadi")).not.toBeInTheDocument();
  });

  it("ilovaga qaytganda (visibilitychange) ro'yxat qayta so'raladi — eskirgan bo'lsa", async () => {
    const { queryClient } = open();
    await screen.findByText("Sevara Tursunova");
    const before = listCalls();
    // 30 s staleTime ni chetlab — ma'lumot eskirdi.
    act(() => {
      queryClient.getQueryCache().findAll({ queryKey: ["orders"] })[0].invalidate();
    });
    const { focusManager } = await import("@tanstack/react-query");
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(listCalls()).toBeGreaterThan(before));
    focusManager.setFocused(undefined);
  });
});
