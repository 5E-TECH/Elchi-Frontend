import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import type { RequestOrderReturnResult } from "../../../entities/mails";
import { renderWithProviders } from "../../../test/test-utils";
import MailDetailPage from "./index";

/**
 * Filial menejeri: «Bu buyurtma kelmagan — qaytarish so'rovi» (ega qarori 2026-11-04; haqiqiy `OrdersTable` bilan).
 *
 * HQ filialga jo'natgan o'tkazma pochtasi (kuryersiz — `courier_id` yo'q yoki `'0'`), hali qabul qilinmagan (`sent`),
 * manzili — menejerning o'z filiali (`post.branch_id`). Kuryerdagi bilan bir xil: tasdiq oynasi →
 * `useRequestOrderReturn` (`POST post/:id/orders/:orderId/return-request`); qator ro'yxatdan chiqadi, izohga tushadi;
 * qabul qilinadigan buyurtma qolmasa — kelingan ro'yxatga qaytiladi. Boshqa filial menejeri, registrator, qabul
 * qilingan pochta — tugma yo'q; kuryer — o'zgarmagan.
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
const OWN_BRANCH = "15";
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

/** HQ → filial o'tkazma pochtasi: kuryersiz (`'0'`), manzil — menejer filiali. */
const TRANSFER_POST = { id: POST_ID, status: "sent", courier_id: "0", branch_id: OWN_BRANCH };

const stateFor = (role: string, { id = `${role}-1`, branchId = OWN_BRANCH, branchType = "REGIONAL" } = {}) =>
  ({
    role: { id, role, region: null, name: role },
    user: {
      // `branchId: ""` — filial turi ma'lum, id'si yo'q (manzil filialni solishtirib bo'lmaydi).
      user: { id, role, branch: branchId ? { id: branchId, type: branchType } : { type: branchType } },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;
const manager = (branchId = OWN_BRANCH) => stateFor("manager", { id: "522", branchId });

/** `GET post/orders/:id?view=current` — qatorlar har renderda funksiyadan (so'rovdan keyingi holatni berish uchun). */
const setup = (rows: () => Row[], post: Record<string, unknown> | null = TRANSFER_POST) => {
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
      <Route path="/mails/old" element={<div data-testid="old-list" />} />
    </Routes>,
    { route: { pathname: `/mails/${POST_ID}`, state }, preloadedState },
  );

const requestButton = (id: string) => screen.queryByRole("button", { name: `№${id} kelmagan — qaytarish so'rovi` });
const anyRequestButton = () => screen.queryAllByRole("button", { name: /kelmagan — qaytarish so'rovi/ });
const checkbox = (id: string) => screen.queryByRole("checkbox", { name: `№${id} ni tanlash` });

describe("MailDetailPage — filial menejeri: «Bu buyurtma kelmagan — qaytarish so'rovi»", () => {
  beforeEach(() => {
    mocks.requestReturn.mockReset();
    mocks.receive.mockReset().mockResolvedValue({ statusCode: 200, data: [] });
    mocks.refetchDetail.mockReset().mockResolvedValue({ data: undefined });
    mocks.useRefused.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mocks.scanner = null;
  });

  it("o'z filialiga o'tkazmada har yo'ldagi qatorda tugma; so'rovi borlar ro'yxatda yo'q, izohda sanaladi", () => {
    setup(() => [order("101"), order("102"), order("103", { return_requested: true })]);
    renderPage(manager());

    const button = requestButton("101");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveTextContent("Kelmagan — qaytarish");
    expect(requestButton("102")).toBeInTheDocument();
    expect(checkbox("101")).toBeInTheDocument();

    // So'rovi bor — tanlanmaydi, tugmasi yo'q, izohda.
    expect(requestButton("103")).toBeNull();
    expect(checkbox("103")).toBeNull();
    // Menejer: so'rov HQ ro'yxatiga tushadi (filialning o'z «Qaytarish»ida yo'q) — izoh shuni aytadi.
    expect(screen.getByTestId("mail-requested-notice")).toHaveTextContent(
      "1 ta buyurtma uchun qaytarish so'rovi yuborilgan: №103 — HQ ko'rib chiqadi",
    );
    expect(screen.getByTestId("mail-requested-notice")).not.toHaveTextContent("«Qaytarish»da ko'rib chiqiladi");
    expect(screen.getByRole("region", { name: "Pochtadagi buyurtmalar" })).toHaveTextContent("2 ta");
    // Skaner ro'yxatida u bor (QR'i skanerlansa — ro'yxatga qaytadi).
    expect(mocks.scanner?.orders.map((item) => item.id)).toEqual(["101", "102", "103"]);
  });

  it("`courier_id` umuman yo'q o'tkazma ham — menejer filialiga bo'lsa tugma bor", () => {
    setup(() => [order("101")], { id: POST_ID, status: "sent", branch_id: OWN_BRANCH });
    renderPage(manager());
    expect(requestButton("101")).toBeInTheDocument();
  });

  it("tasdiq: «filialingizga kelmagan»; shu buyurtma uchun so'rov, qator yashiriladi, xabar, izohga tushadi", async () => {
    const user = userEvent.setup();
    let rows = [order("101"), order("102")];
    setup(() => rows);
    mocks.requestReturn.mockImplementation(async () => {
      // Serverda: buyurtma yo'lda qoladi, so'rov belgisi bilan.
      rows = [order("101", { return_requested: true }), order("102")];
      return result({ orderId: "101", remainingReceivable: 1 });
    });
    renderPage(manager());

    await user.click(requestButton("101")!);
    const dialog = await screen.findByRole("alertdialog", { name: "Buyurtma kelmadimi?" });
    expect(checkbox("101")).not.toBeChecked();
    expect(dialog).toHaveTextContent(
      "№101 filialingizga kelmagan deb belgilanadi va qaytarish so'rovi yuboriladi.",
    );
    expect(dialog).toHaveTextContent("№101 · Mijoz 101");
    expect(dialog).toHaveTextContent(
      "So'rovni HQ ko'rib chiqadi — tasdiqlansa buyurtma HQ omboriga qaytadi (filialingiz «Qaytarish» bo'limida ko'rinmaydi)",
    );
    expect(dialog).not.toHaveTextContent("So'rov «Qaytarish» bo'limiga tushadi");
    expect(dialog).toHaveTextContent("Qolgan 1 ta buyurtmani odatdagidek qabul qilasiz");
    expect(mocks.requestReturn).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "So'rov yuborish" }));

    await waitFor(() => expect(mocks.requestReturn).toHaveBeenCalledWith({ postId: POST_ID, orderId: "101" }));
    expect(mocks.requestReturn).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("№101 uchun qaytarish so'rovi yuborildi")).toBeInTheDocument();
    await waitFor(() => expect(checkbox("101")).toBeNull());
    expect(checkbox("102")).toBeInTheDocument();
    expect(mocks.refetchDetail).toHaveBeenCalled();
    expect(screen.getByTestId("mail-requested-notice")).toHaveTextContent(
      "1 ta buyurtma uchun qaytarish so'rovi yuborilgan: №101 — HQ ko'rib chiqadi",
    );
    expect(screen.getByTestId("location")).toHaveTextContent(`/mails/${POST_ID}`);
  });

  it("qabul — faqat qabul qilinadiganlar (so'rovi bor buyurtma yuborilmaydi)", async () => {
    const user = userEvent.setup();
    setup(() => [order("101"), order("102"), order("103", { return_requested: true })]);
    renderPage(manager());

    await user.click(screen.getByRole("button", { name: "Barchasini tanlash" }));
    await user.click(screen.getByRole("button", { name: "Pochtani qabul qilish — 2 ta" }));

    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["101", "102"] } }),
    );
  });

  it("oxirgi qabul qilinadigan buyurtma — so'rovdan keyin kelingan ro'yxatga qaytiladi", async () => {
    const user = userEvent.setup();
    setup(() => [order("101"), order("103", { return_requested: true })]);
    mocks.requestReturn.mockResolvedValue(result({ orderId: "101", remainingReceivable: 0 }));
    renderPage(manager());

    await user.click(requestButton("101")!);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Qabul qilinadigan buyurtma qolmaydi — pochtalar ro'yxatiga qaytasiz");
    await user.click(within(dialog).getByRole("button", { name: "So'rov yuborish" }));

    expect(await screen.findByTestId("today-list")).toBeInTheDocument();
    expect(screen.getByText("Pochtada qabul qilinadigan buyurtma qolmadi.")).toBeInTheDocument();
  });

  it("QR'i skanerlab qayta olingan buyurtma kutib tursa — oxirgi boshqasiga so'rovdan keyin ham sahifada qolinadi", async () => {
    const user = userEvent.setup();
    const reclaimed = order("103", { return_requested: true });
    setup(() => [order("101"), reclaimed]);
    // Serverda №103 hali so'rovli (qabul qilinmagan) — `remaining_receivable` uni sanamaydi: 0.
    mocks.requestReturn.mockResolvedValue(result({ orderId: "101", remainingReceivable: 0 }));
    renderPage(manager());

    act(() => {
      mocks.scanner?.onMatch(reclaimed, "103", "keyboard");
    });
    expect(checkbox("103")).toBeChecked();

    await user.click(requestButton("101")!);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Qolgan 1 ta buyurtmani odatdagidek qabul qilasiz");
    await user.click(within(dialog).getByRole("button", { name: "So'rov yuborish" }));

    expect(await screen.findByText("№101 uchun qaytarish so'rovi yuborildi")).toBeInTheDocument();
    expect(screen.queryByText("Pochtada qabul qilinadigan buyurtma qolmadi.")).toBeNull();
    expect(screen.queryByTestId("today-list")).toBeNull();
    expect(screen.getByTestId("location")).toHaveTextContent(`/mails/${POST_ID}`);
    // Qayta olingan №103 tanlangan holda qoladi — qabul qilinadi.
    expect(checkbox("103")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Pochtani qabul qilish — 1 ta" }));
    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["103"] } }),
    );
  });

  it("so'rov avval yuborilgan (`already_requested`) — info xabar, qator baribir chiqadi", async () => {
    const user = userEvent.setup();
    setup(() => [order("101"), order("102")]);
    mocks.requestReturn.mockResolvedValue(result({ orderId: "101", alreadyRequested: true, remainingReceivable: 1 }));
    renderPage(manager());

    await user.click(requestButton("101")!);
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "So'rov yuborish" }));

    expect(await screen.findByText("№101 uchun qaytarish so'rovi avval yuborilgan")).toBeInTheDocument();
    await waitFor(() => expect(checkbox("101")).toBeNull());
  });

  it("so'rovi bor buyurtmaning QR'i skanerlansa — ro'yxatga qaytib tanlanadi, qabulga ketadi", async () => {
    const user = userEvent.setup();
    const requested = order("103", { return_requested: true });
    setup(() => [order("101"), requested]);
    renderPage(manager());
    expect(checkbox("103")).toBeNull();

    act(() => {
      mocks.scanner?.onMatch(requested, "103", "keyboard");
    });

    expect(checkbox("103")).toBeChecked();
    expect(screen.queryByTestId("mail-requested-notice")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Pochtani qabul qilish — 1 ta" }));
    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["103"] } }),
    );
  });

  it("ko'rinmaydi: boshqa filial menejeri, filiali noma'lum menejer, registrator, kuryer pochtasi, qabul qilingan pochta", () => {
    // Boshqa filialning o'tkazmasi (havola orqali ochilgan): qabul ro'yxati avvalgidek, «kelmagan» yo'q, so'rovi bor
    // buyurtma ham ajratilmaydi.
    setup(() => [order("101"), order("103", { return_requested: true })]);
    const foreign = renderPage(manager("16"));
    expect(checkbox("101")).toBeInTheDocument();
    expect(checkbox("103")).toBeInTheDocument();
    expect(anyRequestButton()).toHaveLength(0);
    expect(screen.queryByTestId("mail-requested-notice")).toBeNull();
    foreign.unmount();

    setup(() => [order("101")]);
    const unknownBranch = renderPage(manager(""));
    expect(checkbox("101")).toBeInTheDocument();
    expect(anyRequestButton()).toHaveLength(0);
    unknownBranch.unmount();

    setup(() => [order("101")], { id: POST_ID, status: "sent", courier_id: "0" });
    const noBranch = renderPage(manager());
    expect(anyRequestButton()).toHaveLength(0);
    noBranch.unmount();

    // Ikkalasi ham bo'sh (menejer filiali yo'q, pochtada `branch_id` yo'q): "" === "" — mos deb olinmaydi.
    setup(() => [order("101"), order("103", { return_requested: true })], {
      id: POST_ID,
      status: "sent",
      courier_id: "0",
    });
    const bothEmpty = renderPage(manager(""));
    expect(checkbox("101")).toBeInTheDocument();
    expect(anyRequestButton()).toHaveLength(0);
    expect(screen.queryByTestId("mail-requested-notice")).toBeNull();
    bothEmpty.unmount();

    setup(() => [order("101")]);
    const registrator = renderPage(stateFor("registrator"));
    expect(anyRequestButton()).toHaveLength(0);
    registrator.unmount();

    // Kuryer pochtasi (filial menejeri kuryer posilkalarini qabul qilmaydi) — o'zgarmagan.
    setup(() => [order("101")], { ...TRANSFER_POST, courier_id: COURIER_ID });
    const courierPost = renderPage(manager());
    expect(anyRequestButton()).toHaveLength(0);
    courierPost.unmount();

    // Qisman qabul qilingan (RECEIVED) o'tkazmadagi qolib ketgan yo'ldagi qator (fix3b) — qabul qayta ochiladi,
    // «kelmagan» yo'q.
    setup(() => [order("101"), order("102", { status: "waiting" })], { ...TRANSFER_POST, status: "received" });
    renderPage(manager(), { fromTab: "old", view: "old" });
    expect(checkbox("101")).toBeInTheDocument();
    expect(anyRequestButton()).toHaveLength(0);
  });

  it("kuryer — o'zgarmagan: o'z pochtasida tugma bor, «kuryer» tasdiq matni", async () => {
    const user = userEvent.setup();
    setup(() => [order("101"), order("102")], { id: POST_ID, status: "sent", courier_id: COURIER_ID });
    renderPage(stateFor("courier", { id: COURIER_ID }));

    await user.click(requestButton("101")!);
    const dialog = await screen.findByRole("alertdialog", { name: "Buyurtma kelmadimi?" });
    expect(dialog).toHaveTextContent("№101 sizga kelmagan deb belgilanadi va qaytarish so'rovi yuboriladi.");
    expect(dialog).toHaveTextContent(
      "So'rov «Qaytarish» bo'limiga tushadi — tasdiqlangach buyurtma u kelgan omborga qaytadi",
    );
    expect(dialog).not.toHaveTextContent("HQ ko'rib chiqadi");
  });

  it("kuryer — o'zgarmagan: izohda «Qaytarish»da ko'rib chiqiladi", () => {
    setup(() => [order("101"), order("103", { return_requested: true })], {
      id: POST_ID,
      status: "sent",
      courier_id: COURIER_ID,
    });
    renderPage(stateFor("courier", { id: COURIER_ID }));
    expect(screen.getByTestId("mail-requested-notice")).toHaveTextContent(
      "1 ta buyurtma uchun qaytarish so'rovi yuborilgan: №103 — «Qaytarish»da ko'rib chiqiladi",
    );
  });

  describe("telefon (< 768)", () => {
    const original = window.matchMedia;
    beforeEach(() => {
      window.matchMedia = ((query: string) => ({
        matches: query.includes("max-width: 767px"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as typeof window.matchMedia;
    });
    afterEach(() => {
      window.matchMedia = original;
    });

    it("kartaning ostida to'liq kenglikda «Bu buyurtma kelmagan — qaytarish so'rovi» → tasdiq oynasi", async () => {
      const user = userEvent.setup();
      setup(() => [order("101"), order("102")]);
      renderPage(manager());

      const button = screen.getByRole("button", { name: "№101: bu buyurtma kelmagan — qaytarish so'rovi" });
      expect(button).toHaveTextContent(/^Bu buyurtma kelmagan — qaytarish so'rovi$/);
      expect(button).toHaveClass("w-full");
      expect(requestButton("101")).toBeNull();

      await user.click(button);
      expect(await screen.findByRole("alertdialog", { name: "Buyurtma kelmadimi?" })).toBeInTheDocument();
    });
  });
});
