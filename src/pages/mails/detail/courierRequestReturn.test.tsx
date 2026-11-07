import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import type { RequestOrderReturnResult } from "../../../entities/mails";
import { renderWithProviders } from "../../../test/test-utils";
import MailDetailPage from "./index";

/**
 * Kuryer: «Bu buyurtma kelmagan — qaytarish so'rovi» (ega qarori 2026-11-03, BeePost kabi; haqiqiy `OrdersTable` bilan).
 *
 * Faqat kuryer, o'z jo'natilgan (`sent`) pochtasida, yo'ldagi va so'rovi yo'q qatorlarda. Tasdiq oynasi →
 * `useRequestOrderReturn` (`POST post/:id/orders/:orderId/return-request`); qator ro'yxatdan chiqadi, xabar, qayta
 * so'rov; qabul qilinadigan buyurtma qolmasa — kelingan ro'yxatga qaytiladi. So'rovi bor buyurtmalar qabul
 * qilinadiganlarda (tanlov, qabul) yo'q — karta izohida; QR'i skanerlansa — ro'yxatga qaytib tanlanadi.
 */

type Row = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  where_deliver: string;
  total_price: number;
  return_requested?: boolean;
  customer: { id: string; name: string; phone_number: string };
  market: { id: string; name: string };
  district: { id: string; name: string; region_id: string; region: { name: string } };
};

type ScannerOptions = {
  orders: Array<{ id: string }>;
  onMatch: (order: { id: string }, raw: string, source: "keyboard" | "camera") => void;
  onMissing: (raw: string, source: "keyboard" | "camera") => void;
};

const mocks = vi.hoisted(() => ({
  useMailDetail: vi.fn(),
  useRefused: vi.fn(),
  requestReturn: vi.fn(),
  receive: vi.fn(),
  refetchDetail: vi.fn(),
  scanner: null as null | ScannerOptions,
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({ useGetRefusedMailsCourierByPostId: mocks.useRefused }),
  useMailDetail: mocks.useMailDetail,
  useReceivePost: () => ({ mutateAsync: mocks.receive, isPending: false }),
  useRequestOrderReturn: () => ({ mutateAsync: mocks.requestReturn, isPending: false }),
  useReceiveCanceledPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReturnCanceledOrders: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteOrdersFromPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDispatchPostToBranch: () => ({ mutateAsync: vi.fn(), isPending: false, reset: vi.fn() }),
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  getDispatchDestinations: vi.fn(),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: (options: ScannerOptions) => {
    mocks.scanner = options;
  },
}));

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const POST_ID = "7";
const COURIER_ID = "500";

const order = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  status: "on the road",
  createdAt: "2026-10-05T09:14:00.000Z",
  updatedAt: "2026-10-05T09:14:00.000Z",
  where_deliver: "address",
  total_price: 185000,
  customer: { id: `c${id}`, name: `Mijoz ${id}`, phone_number: "+998914521830" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Guliston", region_id: "12", region: { name: "Sirdaryo" } },
  ...over,
});

const SENT_POST = { id: POST_ID, status: "sent", courier_id: COURIER_ID };

const stateFor = (role: string, id = `${role}-1`, branchType = "REGIONAL") =>
  ({
    role: { id, role, region: null, name: role },
    user: {
      user: { id, role, branch: { id: "15", type: branchType } },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;
const courier = () => stateFor("courier", COURIER_ID);

/** `GET post/orders/:id?view=current` — qatorlar har renderda funksiyadan (so'rovdan keyingi holatni berish uchun). */
const setup = (rows: () => Row[], post: Record<string, unknown> | null = SENT_POST) => {
  mocks.useMailDetail.mockImplementation((postId: string) => ({
    data: postId ? { data: { allOrdersByPostId: rows(), ...(post ? { post } : {}) } } : undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mocks.refetchDetail,
  }));
};

const result = (over: Partial<RequestOrderReturnResult> = {}): RequestOrderReturnResult => ({
  orderId: "101",
  postId: POST_ID,
  returnRequested: true,
  alreadyRequested: false,
  remainingReceivable: 1,
  ...over,
});

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

const renderPage = (preloadedState: never, state: Record<string, unknown> = { fromTab: "today" }) =>
  renderWithProviders(
    <Routes>
      <Route
        path="/mails/:id"
        element={
          <>
            <MailDetailPage />
            <LocationProbe />
          </>
        }
      />
      <Route path="/mails/today" element={<div data-testid="today-list" />} />
      <Route path="/mails/refused" element={<div data-testid="refused-list" />} />
      <Route path="/mails/old" element={<div data-testid="old-list" />} />
    </Routes>,
    { route: { pathname: `/mails/${POST_ID}`, state }, preloadedState },
  );

const requestButton = (id: string) => screen.queryByRole("button", { name: `№${id} kelmagan — qaytarish so'rovi` });
const anyRequestButton = () => screen.queryAllByRole("button", { name: /kelmagan — qaytarish so'rovi/ });
const checkbox = (id: string) => screen.queryByRole("checkbox", { name: `№${id} ni tanlash` });

describe("MailDetailPage — kuryer: «Bu buyurtma kelmagan — qaytarish so'rovi»", () => {
  beforeEach(() => {
    mocks.requestReturn.mockReset();
    mocks.receive.mockReset().mockResolvedValue({ statusCode: 200, data: [] });
    mocks.refetchDetail.mockReset().mockResolvedValue({ data: undefined });
    mocks.useRefused.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mocks.scanner = null;
  });

  it("o'z jo'natilgan pochtasida har yo'ldagi qatorda tugma; so'rovi borlar ro'yxatda yo'q, izohda sanaladi", () => {
    const rows = [
      order("101"),
      order("102"),
      order("103", { return_requested: true }),
      order("104", { return_requested: true }),
    ];
    setup(() => rows);
    renderPage(courier());

    const button = requestButton("101");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveTextContent("Kelmadi");
    expect(button).toHaveTextContent("Kelmagan — qaytarish");
    expect(requestButton("102")).toBeInTheDocument();
    // Tugma qator amallarida, chop etishdan oldin.
    const actions = button!.closest("td")!;
    expect(within(actions).getByRole("button", { name: "№101 yorlig'ini chop etish" })).toBeInTheDocument();
    expect(actions.firstElementChild?.firstElementChild).toBe(button);

    // So'rovi borlar — tanlanmaydi, tugmasi yo'q, izohda.
    expect(requestButton("103")).toBeNull();
    expect(checkbox("103")).toBeNull();
    expect(checkbox("104")).toBeNull();
    expect(screen.getByTestId("mail-requested-notice")).toHaveTextContent(
      "2 ta buyurtma uchun qaytarish so'rovi yuborilgan: №103, №104 — «Qaytarish»da ko'rib chiqiladi",
    );
    expect(screen.getByRole("region", { name: "Pochtadagi buyurtmalar" })).toHaveTextContent("2 ta");
    // Skaner ro'yxatida ular bor (QR'i skanerlansa — ro'yxatga qaytadi).
    expect(mocks.scanner?.orders.map((item) => item.id)).toEqual(["101", "102", "103", "104"]);
  });

  it("«Barchasini tanlash» va qabul faqat qabul qilinadiganlarga (so'rovi borlar yuborilmaydi)", async () => {
    const user = userEvent.setup();
    setup(() => [order("101"), order("102"), order("103", { return_requested: true })]);
    renderPage(courier());

    await user.click(screen.getByRole("button", { name: "Barchasini tanlash" }));
    await user.click(screen.getByRole("button", { name: "Pochtani qabul qilish — 2 ta" }));

    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["101", "102"] } }),
    );
  });

  it("ko'rinmaydi: xodim (menejer qabul), boshqa kuryerning pochtasi, `courier_id` siz pochta, eski va rad etilgan pochta", () => {
    setup(() => [order("101"), order("102")]);
    const manager = renderPage(stateFor("manager"));
    expect(checkbox("101")).toBeInTheDocument();
    expect(anyRequestButton()).toHaveLength(0);
    manager.unmount();

    setup(() => [order("101")], { ...SENT_POST, courier_id: "999" });
    const foreign = renderPage(courier());
    expect(checkbox("101")).toBeInTheDocument();
    expect(anyRequestButton()).toHaveLength(0);
    foreign.unmount();

    setup(() => [order("101")], { id: POST_ID, status: "sent" });
    const noCourier = renderPage(courier());
    expect(anyRequestButton()).toHaveLength(0);
    noCourier.unmount();

    // Qabul qilingan pochtadagi qolib ketgan yo'ldagi qator (fix3b) — qabul qayta ochiladi, «kelmagan» yo'q.
    setup(() => [order("101"), order("102", { status: "waiting" })], { ...SENT_POST, status: "received" });
    const old = renderPage(courier(), { fromTab: "old", view: "old" });
    expect(checkbox("101")).toBeInTheDocument();
    expect(anyRequestButton()).toHaveLength(0);
    old.unmount();

    mocks.useMailDetail.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useRefused.mockImplementation((postId: string) => ({
      data: postId ? { data: [order("201", { status: "cancelled (sent)" })] } : undefined,
      isLoading: false,
      isError: false,
    }));
    renderPage(courier(), { fromTab: "refused", type: "refused" });
    expect(screen.getByText("Rad etilgan pochtani filial qabul qiladi.")).toBeInTheDocument();
    expect(anyRequestButton()).toHaveLength(0);
  });

  it("tasdiq: buyurtma ma'lumoti va oqibatlar; shu buyurtma uchun so'rov, qator yashiriladi, xabar, izohga tushadi", async () => {
    const user = userEvent.setup();
    let rows = [order("101"), order("102")];
    setup(() => rows);
    mocks.requestReturn.mockImplementation(async () => {
      // Serverda: buyurtma yo'lda qoladi, so'rov belgisi bilan.
      rows = [order("101", { return_requested: true }), order("102")];
      return result({ orderId: "101", remainingReceivable: 1 });
    });
    renderPage(courier());

    await user.click(requestButton("101")!);
    const dialog = await screen.findByRole("alertdialog", { name: "Buyurtma kelmadimi?" });
    // Tugma bosilishi qatorni tanlamaydi.
    expect(checkbox("101")).not.toBeChecked();
    expect(dialog).toHaveTextContent("№101 sizga kelmagan deb belgilanadi va qaytarish so'rovi yuboriladi.");
    expect(dialog).toHaveTextContent("№101 · Mijoz 101");
    expect(dialog).toHaveTextContent("Guliston · Baraka Shop");
    expect(dialog.textContent?.replace(/\s/g, " ")).toMatch(/185 000 so'm/);
    expect(dialog).toHaveTextContent(
      "So'rov «Qaytarish» bo'limiga tushadi — tasdiqlangach buyurtma u kelgan omborga qaytadi",
    );
    expect(dialog).toHaveTextContent("Buyurtma qabul qilinmaydi va bu ro'yxatdan chiqadi");
    expect(dialog).toHaveTextContent("Qolgan 1 ta buyurtmani odatdagidek qabul qilasiz");
    expect(mocks.requestReturn).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "So'rov yuborish" }));

    await waitFor(() => expect(mocks.requestReturn).toHaveBeenCalledWith({ postId: POST_ID, orderId: "101" }));
    expect(mocks.requestReturn).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("№101 uchun qaytarish so'rovi yuborildi")).toBeInTheDocument();
    await waitFor(() => expect(checkbox("101")).toBeNull());
    expect(requestButton("101")).toBeNull();
    expect(checkbox("102")).toBeInTheDocument();
    expect(mocks.refetchDetail).toHaveBeenCalled();
    expect(screen.getByTestId("mail-requested-notice")).toHaveTextContent(
      "1 ta buyurtma uchun qaytarish so'rovi yuborilgan: №101",
    );
    expect(screen.getByTestId("location")).toHaveTextContent(`/mails/${POST_ID}`);
  });

  it("bekor qilinsa — so'rov yo'q, qator joyida va tanlanmagan", async () => {
    const user = userEvent.setup();
    setup(() => [order("101"), order("102")]);
    renderPage(courier());

    await user.click(requestButton("101")!);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.requestReturn).not.toHaveBeenCalled();
    expect(checkbox("101")).not.toBeChecked();
    expect(requestButton("101")).toBeInTheDocument();
  });

  it("backend rad etsa (409) — xabar oyna ichida, oyna ochiq, qator joyida", async () => {
    const user = userEvent.setup();
    setup(() => [order("101"), order("102")]);
    mocks.requestReturn.mockRejectedValue({
      response: {
        status: 409,
        data: { message: "Buyurtma #101 holati o'zgardi (qabul qilingan yoki so'rov allaqachon yuborilgan) — sahifani yangilang" },
      },
    });
    renderPage(courier());

    await user.click(requestButton("101")!);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "So'rov yuborish" }));

    expect(await within(dialog).findByText(/Buyurtma #101 holati o'zgardi/)).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(checkbox("101")).toBeInTheDocument();
  });

  it("oxirgi qabul qilinadigan buyurtma — oynada «qolmaydi», so'rovdan keyin ro'yxatga qaytiladi (xabar bilan)", async () => {
    const user = userEvent.setup();
    setup(() => [order("101"), order("103", { return_requested: true })]);
    mocks.requestReturn.mockResolvedValue(result({ orderId: "101", remainingReceivable: 0 }));
    renderPage(courier());

    await user.click(requestButton("101")!);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Qabul qilinadigan buyurtma qolmaydi — pochtalar ro'yxatiga qaytasiz");
    await user.click(within(dialog).getByRole("button", { name: "So'rov yuborish" }));

    expect(await screen.findByTestId("today-list")).toBeInTheDocument();
    expect(screen.getByText("№101 uchun qaytarish so'rovi yuborildi")).toBeInTheDocument();
    expect(screen.getByText("Pochtada qabul qilinadigan buyurtma qolmadi.")).toBeInTheDocument();
  });

  it("so'rov avval yuborilgan bo'lsa (`already_requested`) — info xabar, qator baribir chiqadi", async () => {
    const user = userEvent.setup();
    setup(() => [order("101"), order("102")]);
    mocks.requestReturn.mockResolvedValue(result({ orderId: "101", alreadyRequested: true, remainingReceivable: 1 }));
    renderPage(courier());

    await user.click(requestButton("101")!);
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "So'rov yuborish" }));

    expect(await screen.findByText("№101 uchun qaytarish so'rovi avval yuborilgan")).toBeInTheDocument();
    await waitFor(() => expect(checkbox("101")).toBeNull());
    expect(screen.getByTestId("location")).toHaveTextContent(`/mails/${POST_ID}`);
  });

  it("so'rovi bor buyurtmaning QR'i skanerlansa — bloklanmaydi: to'g'ridan qabul qilinadi (`scan: true`), izohdan chiqadi", async () => {
    const requested = order("103", { return_requested: true });
    setup(() => [order("101"), requested]);
    mocks.receive.mockResolvedValue({ statusCode: 200, data: [], received_order_ids: ["103"], post_status: "sent" });
    renderPage(courier());
    expect(checkbox("103")).toBeNull();

    act(() => {
      mocks.scanner?.onMatch(requested, "103", "keyboard");
    });

    // Skan-qabul (2026-11-07): tanlanmaydi — faqat shu buyurtma qabulga ketadi, qolganlari (№101) tegilmaydi.
    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["103"], scan: true } }),
    );
    expect(mocks.receive).toHaveBeenCalledTimes(1);
    expect(checkbox("103")).toBeNull();
    expect(screen.queryByTestId("mail-requested-notice")).toBeNull();
    expect(await screen.findByText("№103 qabul qilindi · 1 ta qoldi")).toBeInTheDocument();
    expect(checkbox("101")).not.toBeChecked();
  });
});
