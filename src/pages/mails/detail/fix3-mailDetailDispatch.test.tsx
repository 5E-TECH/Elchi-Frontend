import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { Branch } from "../../../entities/branch";
import MailDetailPage from "./index";
import { resolveDispatchRegionId } from "./lib/dispatchRegion";

const mocks = vi.hoisted(() => ({
  getDispatchDestinations: vi.fn(),
  useMailDetail: vi.fn(),
  tableProps: { last: null as null | { canDelete?: boolean } },
  deleteFromPost: vi.fn(),
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
  useDispatchPostToBranch: () => ({ mutateAsync: vi.fn(), isPending: false, reset: vi.fn() }),
  useDeleteOrdersFromPost: () => ({ mutateAsync: mocks.deleteFromPost, isPending: false }),
}));

vi.mock("../../../entities/batch", () => ({
  useBatchRemainingDetail: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useSendTransferBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: () => undefined,
}));

vi.mock("./ui/OrdersTable", () => ({
  default: (props: {
    orders: Array<{ id: string }>;
    onToggleAll: () => void;
    canDelete?: boolean;
    onDeleteOne?: (id: string) => void;
  }) => {
    mocks.tableProps.last = props;
    return (
      <div>
        <span data-testid="orders-count">{props.orders.length}</span>
        <button type="button" onClick={props.onToggleAll}>
          test-select-all
        </button>
        {props.canDelete ? (
          <button type="button" onClick={() => props.onDeleteOne?.(props.orders[0].id)}>
            test-delete-first
          </button>
        ) : null}
      </div>
    );
  },
}));

const POST_ID = "7";
const GEO_REGION = "12";
const POST_REGION = "20";

// Tuman (Guliston) geografik jihatdan 12-viloyatda, lekin admin uni 20-viloyatga
// biriktirgan — HQ qabuli uni 20-viloyat pochtasiga joylagan.
const order = (id: string) => ({
  id,
  status: "received",
  region_id: GEO_REGION,
  where_deliver: "address",
  total_price: 100000,
  district: {
    id: "5",
    name: "Guliston",
    region_id: GEO_REGION,
    assigned_region: POST_REGION,
    region: { name: "Sirdaryo" },
  },
});

const branch = (id: string, regionId: string, name: string): Branch => ({
  id,
  name,
  type: "REGIONAL",
  status: "active",
  has_manager: true,
  manager: { id: "300", name: "Menejer" },
  manager_id: "300",
  phone_number: "+998903009002",
  region: { id: regionId, name: regionId === POST_REGION ? "Jizzax" : "Sirdaryo" },
  district: { id: "", name: "—" },
  address: "—",
  employees_count: 0,
  created_at: "2026-10-01T00:00:00.000Z",
});

const destinations = (items: Branch[]) => ({ data: items, total: items.length, page: 1, limit: 10 });

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

const renderPage = (
  preloadedState: never,
  route: string | { pathname: string; state?: unknown } = `/mails/${POST_ID}`,
) =>
  renderWithProviders(
    <Routes>
      {/* Haqiqiy ilovada ham `/mails/today` — ro'yxat, tafsilot emas. */}
      <Route path="/mails/today" element={<div data-testid="navigated-away" />} />
      <Route path="/mails/:id" element={<MailDetailPage />} />
      <Route path="*" element={<div data-testid="navigated-away" />} />
    </Routes>,
    { route, preloadedState },
  );

const selectAllAndSend = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "test-select-all" }));
  await user.click(screen.getByRole("button", { name: /Pochtani jo'natish/ }));
};

describe("resolveDispatchRegionId (fix3 LC-09)", () => {
  it("pochtaning o'z viloyati birinchi o'rinda", () => {
    expect(resolveDispatchRegionId(POST_REGION, [order("1")] as never)).toBe(POST_REGION);
  });

  it("navigatsiya holati bo'lmasa — tumanning assigned_region i", () => {
    expect(resolveDispatchRegionId("", [order("1")] as never)).toBe(POST_REGION);
    expect(
      resolveDispatchRegionId(undefined, [
        { ...order("1"), district: { id: "5", name: "X", region_id: GEO_REGION, assignedToRegion: { id: "33" } } },
      ] as never),
    ).toBe("33");
  });

  it("assigned_region ham bo'lmasa — avvalgidek geografik viloyat", () => {
    expect(
      resolveDispatchRegionId("", [
        { ...order("1"), district: { id: "5", name: "X", region_id: GEO_REGION } },
      ] as never),
    ).toBe(GEO_REGION);
    expect(resolveDispatchRegionId("", [])).toBe("");
  });
});

describe("MailDetailPage — qayta biriktirilgan tuman pochtasi (fix3 LC-09)", () => {
  beforeEach(() => {
    mocks.tableProps.last = null;
    mocks.useMailDetail.mockImplementation((postId: string) => ({
      data: postId ? { data: { allOrdersByPostId: [order("101"), order("102")] } } : undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn().mockResolvedValue({ data: { data: { allOrdersByPostId: [] } } }),
    }));
    mocks.getDispatchDestinations.mockResolvedValue(
      destinations([branch("15", GEO_REGION, "Eski viloyat filiali"), branch("21", POST_REGION, "Yangi viloyat filiali")]),
    );
  });

  it("ro'yxatdan kelganda pochtaning viloyati bo'yicha filiallar chiqadi", async () => {
    const user = userEvent.setup();
    renderPage(stateFor("registrator", "HQ"), {
      pathname: `/mails/${POST_ID}`,
      state: { fromTab: "today", fallbackRegionId: POST_REGION, fallbackRegionName: "Yangi viloyat" },
    });

    await selectAllAndSend(user);

    await waitFor(() =>
      expect(mocks.getDispatchDestinations).toHaveBeenCalledWith({ region_id: POST_REGION }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Yangi viloyat filiali")).toBeInTheDocument();
    expect(within(dialog).queryByText("Eski viloyat filiali")).not.toBeInTheDocument();
  });

  it("to'g'ridan-to'g'ri havolada (holatsiz) tumanning assigned_region i ishlatiladi", async () => {
    const user = userEvent.setup();
    renderPage(stateFor("superadmin"));

    await selectAllAndSend(user);

    await waitFor(() =>
      expect(mocks.getDispatchDestinations).toHaveBeenCalledWith({ region_id: POST_REGION }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("MailDetailPage — savat: buyurtmani pochtadan o'chirish (yokjwjXG)", () => {
  const refetch = vi.fn();
  const detail = (post: { id: string; status: string } | undefined, orders = [order("101"), order("102")]) => {
    mocks.useMailDetail.mockImplementation((postId: string) => ({
      data: postId ? { data: { allOrdersByPostId: orders, ...(post !== undefined ? { post } : {}) } } : undefined,
      isLoading: false,
      isError: false,
      refetch,
    }));
  };

  beforeEach(() => {
    mocks.deleteFromPost.mockReset();
    refetch.mockReset().mockResolvedValue({ data: { data: { allOrdersByPostId: [order("102")] } } });
  });

  it.each([
    ["superadmin", { id: POST_ID, status: "new" }, true],
    ["superadmin", { id: POST_ID, status: "on_the_road" }, false],
    ["superadmin", undefined, false],
    ["admin", { id: POST_ID, status: "new" }, false],
  ] as const)("%s, pochta %j — savat ko'rinishi: %s", (role, post, expected) => {
    detail(post as never);
    renderPage(stateFor(role));
    expect(mocks.tableProps.last?.canDelete).toBe(expected);
  });

  it("⭐ savat → sabab majburiy → POST /post/delete { post_id, order_ids, reason }; /post/cancel EMAS", async () => {
    const user = userEvent.setup();
    detail({ id: POST_ID, status: "new" });
    mocks.deleteFromPost.mockResolvedValue({ post_id: POST_ID, deleted: ["101"], skipped: [], post_deleted: false });
    renderPage(stateFor("superadmin"));

    await user.click(screen.getByRole("button", { name: "test-delete-first" }));
    const dialog = screen.getByRole("alertdialog", { name: "1 ta buyurtmani pochtadan o'chirish" });
    expect(within(dialog).getByText("Buyurtma pochtadan butunlay o'chiriladi, qaytarib bo'lmaydi.")).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Ha, o'chirish" });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/^Sabab/), "ab");
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/^Sabab/), "c — market qaytarib oldi");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(mocks.deleteFromPost).toHaveBeenCalledWith({
      post_id: POST_ID,
      order_ids: ["101"],
      reason: "abc — market qaytarib oldi",
    });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(refetch).toHaveBeenCalled();
    expect(await screen.findByText("1 ta buyurtma pochtadan o'chirildi")).toBeInTheDocument();
  });

  it("409 — backend sababi oynada, oyna ochiq qoladi", async () => {
    const user = userEvent.setup();
    detail({ id: POST_ID, status: "new" });
    mocks.deleteFromPost.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { statusCode: 409, message: "#101 — buyurtma kuryer qo'lida" } },
    });
    renderPage(stateFor("superadmin"));

    await user.click(screen.getByRole("button", { name: "test-delete-first" }));
    const dialog = screen.getByRole("alertdialog");
    await user.type(within(dialog).getByLabelText(/^Sabab/), "Xato qo'shilgan");
    await user.click(within(dialog).getByRole("button", { name: "Ha, o'chirish" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("#101 — buyurtma kuryer qo'lida");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("backend hech narsani o'chirmasa (deleted: []) — «o'chirildi» emas, ogohlantirish", async () => {
    const user = userEvent.setup();
    detail({ id: POST_ID, status: "new" });
    mocks.deleteFromPost.mockResolvedValue({ post_id: POST_ID, deleted: [], skipped: ["101"], post_deleted: false });
    renderPage(stateFor("superadmin"));

    await user.click(screen.getByRole("button", { name: "test-delete-first" }));
    const dialog = screen.getByRole("alertdialog");
    await user.type(within(dialog).getByLabelText(/^Sabab/), "Xato qo'shilgan");
    await user.click(within(dialog).getByRole("button", { name: "Ha, o'chirish" }));

    expect(await screen.findByText("Hech bir buyurtma o'chirilmadi")).toBeInTheDocument();
    expect(screen.getByText("1 tasi o'chirilmadi")).toBeInTheDocument();
    expect(screen.queryByText(/pochtadan o'chirildi/)).toBeNull();
  });

  it("tanlanganlarni birdaniga; oxirgisi o'chsa (post_deleted) ro'yxatga qaytadi", async () => {
    const user = userEvent.setup();
    detail({ id: POST_ID, status: "new" });
    mocks.deleteFromPost.mockResolvedValue({ post_id: POST_ID, deleted: ["101", "102"], skipped: [], post_deleted: true });
    renderPage(stateFor("superadmin"));

    expect(screen.queryByTestId("mail-delete-selected")).toBeNull();
    await user.click(screen.getByRole("button", { name: "test-select-all" }));
    await user.click(
      within(screen.getByTestId("mail-delete-selected")).getByRole("button", { name: "Tanlanganlarni o'chirish" }),
    );
    const dialog = screen.getByRole("alertdialog", { name: "2 ta buyurtmani pochtadan o'chirish" });
    await user.type(within(dialog).getByLabelText(/^Sabab/), "Pochta bekor qilindi");
    await user.click(within(dialog).getByRole("button", { name: "Ha, o'chirish" }));

    expect(mocks.deleteFromPost).toHaveBeenCalledWith(
      expect.objectContaining({ post_id: POST_ID, order_ids: ["101", "102"] }),
    );
    expect(await screen.findByTestId("navigated-away")).toBeInTheDocument();
  });
});

describe("MailDetailPage — sarlavha: pochta holati serverdan, rolga qarab maketdagidek (4YZcTTDQ)", () => {
  const POST = {
    id: POST_ID,
    status: "sent",
    courier_id: "119",
    courier: { id: "119", name: "Buxaro Courier", phone_number: "+998901190119" },
    createdAt: "2026-10-01T08:00:00.000Z",
  };
  const withPost = (post: Record<string, unknown> | undefined, orderStatus = "received") =>
    mocks.useMailDetail.mockImplementation((postId: string) => ({
      data: postId
        ? { data: { allOrdersByPostId: [{ ...order("101"), status: orderStatus }], ...(post ? { post } : {}) } }
        : undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
  const sub = () => screen.getByTestId("mail-detail-sub");

  it.each([
    ["new", "Yangi"],
    ["sent", "Jo'natilgan"],
    ["received", "Qabul qilingan"],
    ["canceled_received", "Qaytarilgan"],
  ])("deep-link (state'siz): post.status=%s — badge «%s»", (status, label) => {
    withPost({ ...POST, status });
    renderPage(stateFor("superadmin"));
    expect(screen.getByTestId("mail-post-status")).toHaveTextContent(label);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sirdaryo buyurtmalari");
  });

  it("superadmin: izohda «Pochta №7 · 1 ta buyurtma mavjud» — kuryer maketda yo'q", () => {
    withPost(POST);
    renderPage(stateFor("superadmin"));
    expect(sub()).toHaveTextContent(/^Pochta №7 · 1 ta buyurtma mavjud$/);
    expect(screen.queryByText(/Buxaro Courier/)).toBeNull();
    expect(screen.queryByTestId("mail-read-only")).toBeNull();
  });

  it("eski pochta: holat + «Faqat o'qish», izohda eski buyurtmalar soni (`superadmin-mails-detail-old`)", () => {
    withPost({ ...POST, status: "received" });
    renderPage(stateFor("superadmin"), { pathname: `/mails/${POST_ID}`, state: { fromTab: "old", view: "old" } });
    expect(screen.getByTestId("mail-post-status")).toHaveTextContent("Qabul qilingan");
    expect(screen.getByTestId("mail-read-only")).toHaveTextContent("Faqat o'qish");
    expect(screen.getByRole("button", { name: /Eski pochtalar/ })).toBeInTheDocument();
    expect(sub()).toHaveTextContent(/^Pochta №7 · 1 ta eski buyurtma mavjud$/);
  });

  it("kuryer: badge yo'q, eski pochtada ham (`courier-mails-detail-receive`, `-old`)", () => {
    withPost(POST, "on the road");
    renderPage(stateFor("courier"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sirdaryo buyurtmalari");
    expect(screen.queryByTestId("mail-post-status")).toBeNull();
    expect(sub()).toHaveTextContent(/^Pochta №7 · 1 ta buyurtma mavjud$/);
  });

  it("kuryer, eski pochta — «Faqat o'qish» ham yo'q", () => {
    withPost({ ...POST, status: "received" });
    renderPage(stateFor("courier"), { pathname: `/mails/${POST_ID}`, state: { fromTab: "old", view: "old" } });
    expect(screen.queryByTestId("mail-post-status")).toBeNull();
    expect(screen.queryByTestId("mail-read-only")).toBeNull();
  });

  it("kuryer, rad etilgan pochta — izoh oldida qizil ikonka (`courier-mails-detail-refused`)", () => {
    withPost(undefined);
    renderPage(stateFor("courier"), { pathname: `/mails/${POST_ID}`, state: { fromTab: "refused", type: "refused" } });
    expect(screen.queryByTestId("mail-post-status")).toBeNull();
    expect(sub().querySelector("svg.lucide-circle-x")).not.toBeNull();
    // Maket matni: «Pochta №2476 · 5 ta rad etilgan buyurtma» («mavjud» siz).
    expect(sub()).toHaveTextContent(/^Pochta №7 · 0 ta rad etilgan buyurtma$/);
  });

  it("menejer (qabul): sarlavhada pochta raqami, izohda viloyat · sana · soni (`manager-mails-detail-receive`)", () => {
    withPost({ ...POST, status: "new" }, "on the road");
    renderPage(stateFor("manager", "REGIONAL"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Pochta №7$/);
    expect(screen.getByTestId("mail-post-status")).toHaveTextContent("Yangi");
    expect(sub()).toHaveTextContent(/^Sirdaryo · 01\.10\.2026, \d{2}:00 · 1 ta buyurtma$/);
  });

  it("menejer, rad etilgan pochta: «Pochta №7», izohda «N ta rad etilgan buyurtma» (`manager-mails-detail-refused-receive`)", () => {
    withPost(undefined);
    renderPage(stateFor("manager", "HQ"), { pathname: `/mails/${POST_ID}`, state: { fromTab: "refused", type: "refused" } });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Pochta №7$/);
    expect(screen.getByTestId("mail-post-status")).toHaveTextContent("Rad etilgan");
    expect(sub()).toHaveTextContent(/^0 ta rad etilgan buyurtma$/);
  });

  it("menejer, eski pochta — adminniki kabi (`admin-mails-old-detail`)", () => {
    withPost({ ...POST, status: "received" });
    renderPage(stateFor("manager", "REGIONAL"), { pathname: `/mails/${POST_ID}`, state: { fromTab: "old", view: "old" } });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sirdaryo buyurtmalari");
    expect(screen.getByTestId("mail-read-only")).toBeInTheDocument();
  });

  it("eski backend (post yo'q) — badge chizilmaydi, sahifa avvalgidek", () => {
    withPost(undefined);
    renderPage(stateFor("superadmin"));
    expect(screen.queryByTestId("mail-post-status")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sirdaryo buyurtmalari");
  });

  it("«← Bugungi pochtalar» — ro'yxatga qaytaradi", async () => {
    const user = userEvent.setup();
    withPost({ ...POST, status: "new" });
    renderPage(stateFor("superadmin"));
    await user.click(screen.getByRole("button", { name: /Bugungi pochtalar/ }));
    expect(await screen.findByTestId("navigated-away")).toBeInTheDocument();
  });
});
