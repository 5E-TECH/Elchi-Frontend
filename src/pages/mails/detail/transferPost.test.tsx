import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Branch } from "../../../entities/branch";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import MailDetailPage from "./index";

/**
 * Eski pochta → «Filialga o'tkazish»: HQ pochtani adashib Samarqanddagi 1-filialga jo'natgan, u hali qabul
 * qilmagan — superadmin/admin pochtani shu viloyatning boshqa filialiga o'tkazadi
 * (`POST branches/posts/:id/reassign`). Ro'yxatda faqat shu viloyatning boshqa faol filiallari.
 */
const mocks = vi.hoisted(() => ({
  getDispatchDestinations: vi.fn(),
  useMailDetail: vi.fn(),
  reassign: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  getDispatchDestinations: mocks.getDispatchDestinations,
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({
    useGetRefusedMailsCourierByPostId: () => ({ data: undefined, isLoading: false, isError: false }),
  }),
  useMailDetail: mocks.useMailDetail,
  useReceivePost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReceiveCanceledPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReturnCanceledOrders: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDispatchPostToBranch: () => ({ mutateAsync: vi.fn(), isPending: false, reset: vi.fn() }),
  useDeleteOrdersFromPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReassignPostToBranch: () => ({ mutateAsync: mocks.reassign, isPending: false }),
}));

vi.mock("../../../entities/batch", () => ({
  useBatchRemainingDetail: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useSendTransferBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: () => undefined,
}));

vi.mock("./ui/OrdersTable", () => ({
  default: (props: { orders: Array<{ id: string }> }) => <span data-testid="orders-count">{props.orders.length}</span>,
}));

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const POST_ID = "7";
const SAMARQAND = "14";

const order = (id: string, status = "on the road") => ({
  id,
  status,
  region_id: SAMARQAND,
  where_deliver: "address",
  total_price: 100000,
  district: { id: "1401", name: "Urgut", region_id: SAMARQAND, region: { name: "Samarqand" } },
});

const SENT_POST = {
  id: POST_ID,
  status: "sent",
  courier_id: "0",
  branch_id: "31",
  region_id: SAMARQAND,
  region: { id: SAMARQAND, name: "Samarqand" },
  createdAt: "2026-11-02T08:00:00.000Z",
};

const branch = (id: string, name: string, regionId = SAMARQAND, hasManager = true): Branch => ({
  id,
  name,
  type: "REGIONAL",
  status: "active",
  has_manager: hasManager,
  manager: hasManager ? { id: "300", name: "Menejer" } : null,
  manager_id: hasManager ? "300" : undefined,
  phone_number: "+998903009002",
  region: { id: regionId, name: regionId === SAMARQAND ? "Samarqand" : "Buxoro" },
  district: { id: "", name: "—" },
  address: "—",
  employees_count: 0,
  created_at: "2026-10-01T00:00:00.000Z",
});

const DESTINATIONS = [
  branch("31", "Samarqand 1"),
  branch("32", "Samarqand 2"),
  branch("33", "Kattaqo'rg'on", SAMARQAND, false),
  branch("40", "Buxoro filiali", "15"),
];

const withPost = (post: Record<string, unknown>, orders = [order("101"), order("102")]) =>
  mocks.useMailDetail.mockImplementation((postId: string) => ({
    data: postId ? { data: { allOrdersByPostId: orders, post } } : undefined,
    isLoading: false,
    isError: false,
    refetch: mocks.refetch,
  }));

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

const OLD_VIEW = { pathname: `/mails/${POST_ID}`, state: { fromTab: "old", view: "old" } };

const renderPage = (role: string, route: string | { pathname: string; state?: unknown } = OLD_VIEW, branchType?: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/mails/:id" element={<MailDetailPage />} />
    </Routes>,
    { route, preloadedState: stateFor(role, branchType) },
  );

const transferButton = () => screen.queryByRole("button", { name: /Filialga o'tkazish/ });

describe("Eski pochta → «Filialga o'tkazish»", () => {
  beforeEach(() => {
    mocks.getDispatchDestinations.mockReset().mockResolvedValue({ data: DESTINATIONS, total: 4, page: 1, limit: 10 });
    mocks.reassign.mockReset().mockResolvedValue({ statusCode: 200 });
    mocks.refetch.mockReset().mockResolvedValue({});
    withPost(SENT_POST);
  });

  it.each(["superadmin", "admin"])(
    "%s: faqat shu viloyatning boshqa filiallari; tanlab «O'tkazish» — pochta 2-filialga o'tadi",
    async (role) => {
      const user = userEvent.setup();
      renderPage(role);
      await user.click(transferButton() as HTMLElement);

      expect(mocks.getDispatchDestinations).toHaveBeenCalledWith({ region_id: SAMARQAND });
      const dialog = await screen.findByRole("dialog", { name: "Pochtani boshqa filialga o'tkazish" });
      expect(
        within(dialog).getByText(
          "Pochta hozir «Samarqand 1» filialiga jo'natilgan, hali qabul qilinmagan. Pochta va undagi 2 ta buyurtma tanlangan filialga o'tadi.",
        ),
      ).toBeInTheDocument();
      const group = within(dialog).getByRole("group", { name: "Shu viloyatdagi boshqa faol filiallar" });
      expect(within(group).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual([
        expect.stringContaining("Samarqand 2"),
        expect.stringContaining("Kattaqo'rg'on"),
      ]);
      expect(within(group).getByRole("radio", { name: /Kattaqo'rg'on/ })).toBeDisabled();
      expect(within(dialog).queryByText("Samarqand 1", { selector: "span" })).toBeNull();
      expect(within(dialog).queryByText("Buxoro filiali")).toBeNull();

      const submit = within(dialog).getByRole("button", { name: "O'tkazish" });
      expect(submit).toBeDisabled();
      await user.click(within(group).getByRole("radio", { name: /Samarqand 2/ }));
      await user.click(submit);

      await waitFor(() => expect(mocks.reassign).toHaveBeenCalledWith({ postId: POST_ID, destinationBranchId: "32" }));
      expect(await screen.findByText("Pochta Samarqand 2 filialiga o'tkazildi.")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(mocks.refetch).toHaveBeenCalled();
    },
  );

  it("backend rad etsa (qabul qilingan) — backend matni ko'rinadi, oyna ochiq qoladi", async () => {
    mocks.reassign.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          statusCode: 409,
          message:
            "Pochtadagi 1 ta buyurtma filialda qabul qilingan yoki yo'lda emas: #102. Qabul qilina boshlagan pochtani boshqa filialga o'tkazib bo'lmaydi. Hech narsa o'tkazilmadi",
        },
      },
    });
    const user = userEvent.setup();
    renderPage("admin");
    await user.click(transferButton() as HTMLElement);
    const dialog = await screen.findByRole("dialog", { name: "Pochtani boshqa filialga o'tkazish" });
    await user.click(within(dialog).getByRole("radio", { name: /Samarqand 2/ }));
    await user.click(within(dialog).getByRole("button", { name: "O'tkazish" }));

    expect(await screen.findByText(/Qabul qilina boshlagan pochtani boshqa filialga o'tkazib bo'lmaydi/)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Pochtani boshqa filialga o'tkazish" })).toBeInTheDocument();
    expect(mocks.refetch).not.toHaveBeenCalled();
  });

  it("viloyatda boshqa faol filial yo'q — xabar, oyna ochilmaydi", async () => {
    mocks.getDispatchDestinations.mockResolvedValue({ data: [branch("31", "Samarqand 1")], total: 1, page: 1, limit: 10 });
    const user = userEvent.setup();
    renderPage("superadmin");
    await user.click(transferButton() as HTMLElement);
    expect(await screen.findByText("Bu viloyatda boshqa faol filial yo'q.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each([
    ["registrator (HQ)", "registrator", OLD_VIEW, SENT_POST, "HQ"],
    ["menejer", "manager", OLD_VIEW, SENT_POST, "REGIONAL"],
    ["qabul qilingan pochta", "admin", OLD_VIEW, { ...SENT_POST, status: "received" }, undefined],
    ["kuryer pochtasi", "admin", OLD_VIEW, { ...SENT_POST, courier_id: "119", branch_id: null }, undefined],
    ["eski bo'lmagan (ish) ko'rinishi", "admin", `/mails/${POST_ID}`, { ...SENT_POST, status: "new" }, undefined],
  ])("tugma yo'q: %s", (_label, role, route, post, branchType) => {
    withPost(post as Record<string, unknown>);
    renderPage(role, route, branchType);
    expect(transferButton()).toBeNull();
  });

  it("tugma yo'q: filial qabul qila boshlagan (bittasi «kutilmoqda»)", () => {
    withPost(SENT_POST, [order("101"), order("102", "waiting")]);
    renderPage("admin");
    expect(transferButton()).toBeNull();
  });

  it("tugma yo'q: pochtada yo'ldagi buyurtma qolmagan (hammasi qabul qilingan)", () => {
    withPost(SENT_POST, [order("101", "waiting")]);
    renderPage("admin");
    expect(transferButton()).toBeNull();
  });
});
