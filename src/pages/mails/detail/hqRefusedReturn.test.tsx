import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import type { CanceledPostActionResult } from "../../../entities/mails";
import { renderWithProviders } from "../../../test/test-utils";
import MailDetailPage from "./index";

/**
 * HQ: rad etilgan pochtani qisman qabul qilish va «Filialga qaytarish» (haqiqiy `OrdersTable` bilan).
 *
 * HQ qabul qiluvchisi (admin, superadmin, HQ menejeri / registratori) faqat tanlanganlarni qabul qiladi — qolganlari
 * shu pochtada qoladi, hech narsa o'zi qaytmaydi. Pochtani filial jo'natgan bo'lsa (`post.branch` — HQ emas),
 * tanlanganlarni tasdiq oynasi orqali o'sha filialga qaytaradi (`POST post/cancel/return/:id`). Pochta bo'shasa —
 * kelingan ro'yxatga qaytiladi. Filial menejeri (kuryer pochtasi) — avvalgidek.
 */

const mocks = vi.hoisted(() => ({
  useMailDetail: vi.fn(),
  useRefused: vi.fn(),
  receive: vi.fn(),
  returnOrders: vi.fn(),
  refetchDetail: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock("../../../shared/api/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/api/api")>()),
  api: { get: mocks.apiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({ useGetRefusedMailsCourierByPostId: mocks.useRefused }),
  useMailDetail: mocks.useMailDetail,
  useReceivePost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRequestOrderReturn: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReceiveCanceledPost: () => ({ mutateAsync: mocks.receive, isPending: false }),
  useReturnCanceledOrders: () => ({ mutateAsync: mocks.returnOrders, isPending: false }),
  useDeleteOrdersFromPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDispatchPostToBranch: () => ({ mutateAsync: vi.fn(), isPending: false, reset: vi.fn() }),
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  getDispatchDestinations: vi.fn(),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({ useOrderQrScanner: () => undefined }));

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const POST_ID = "7";
const HQ_BRANCH_ID = "1";

const order = (id: string) => ({
  id,
  status: "cancelled (sent)",
  createdAt: "2026-10-05T09:14:00.000Z",
  updatedAt: "2026-10-05T09:14:00.000Z",
  where_deliver: "address",
  total_price: 100000,
  customer: { id: `c${id}`, name: `Mijoz ${id}`, phone_number: "+998914521830" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Urgut", region_id: "14", region: { name: "Samarqand" } },
});

/** `GET post/orders/:id` dagi pochta: jo'natgan filial `branch`, qabul joyi `branch_id` (HQ). */
const BRANCH_SENT_POST = {
  id: POST_ID,
  status: "canceled",
  courier_id: "300",
  courier: null,
  branch_id: HQ_BRANCH_ID,
  branch: { id: "14", name: "Samarqand filiali" },
};
/** HQ kuryeri olib kelgan pochta — jo'natuvchi filial HQ'ning o'zi. */
const HQ_COURIER_POST = {
  ...BRANCH_SENT_POST,
  courier_id: "93",
  courier: { id: "93", name: "HQ kuryeri" },
  branch: { id: HQ_BRANCH_ID, name: "Toshkent HQ" },
};

const result = (overrides: Partial<CanceledPostActionResult>): CanceledPostActionResult => ({
  orderIds: [],
  remainingOrderIds: [],
  requeuedPostIds: [],
  groupedPostIds: [POST_ID],
  postStatus: "canceled",
  postClosed: false,
  branchId: HQ_BRANCH_ID,
  returnBranchId: null,
  ...overrides,
});

const stateFor = (role: string, branchType?: string) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: {
      user: {
        id: `${role}-1`,
        role,
        ...(branchType ? { branch: { id: "1", type: branchType } } : {}),
      },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

/** Rad etilgan qatorlar — `post/orders/rejected/:id`; pochtaning o'zi — yordamchi `post/orders/:id?view=current`. */
const setup = (
  rows: string[] | (() => string[]),
  post: Record<string, unknown> | null = BRANCH_SENT_POST,
  metaError = false,
) => {
  mocks.useRefused.mockImplementation((postId: string) => ({
    data: postId ? { data: (typeof rows === "function" ? rows() : rows).map(order) } : undefined,
    isLoading: false,
    isError: false,
  }));
  mocks.useMailDetail.mockImplementation((postId: string) => ({
    data:
      postId && !metaError
        ? { data: { allOrdersByPostId: [], ...(post ? { post } : {}) } }
        : undefined,
    isLoading: false,
    isError: Boolean(postId) && metaError,
    error: null,
    refetch: mocks.refetchDetail,
  }));
};

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

const renderPage = (role: string, branchType?: string, navState: Record<string, unknown> = {}) =>
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
      <Route path="/mails/refused" element={<div data-testid="refused-list" />} />
    </Routes>,
    {
      route: {
        pathname: `/mails/${POST_ID}`,
        state: { fromTab: "refused", type: "refused", ...navState },
      },
      preloadedState: stateFor(role, branchType),
    },
  );

const selectRow = (user: ReturnType<typeof userEvent.setup>, id: string) =>
  user.click(screen.getByRole("checkbox", { name: `№${id} ni tanlash` }));

const returnButton = () => screen.queryByRole("button", { name: /^Filialga qaytarish/ });

describe("MailDetailPage — HQ: rad etilgan pochtani qisman qabul qilish", () => {
  beforeEach(() => {
    mocks.receive.mockReset();
    mocks.returnOrders.mockReset();
    mocks.refetchDetail.mockReset();
    mocks.apiGet.mockReset().mockResolvedValue({ data: { data: { items: [order("900")] } } });
  });

  it("15 dan 1 tasi kabi: qabul qilinganlar yashiriladi, qolganlari shu sahifada, hech qayerga o'tilmaydi", async () => {
    const user = userEvent.setup();
    setup(["101", "102", "103"]);
    mocks.receive.mockResolvedValue(
      result({ orderIds: ["101"], remainingOrderIds: ["102", "103"] }),
    );
    renderPage("registrator", "HQ");

    await selectRow(user, "101");
    await user.click(screen.getByRole("button", { name: "Pochtani qabul qilish — 1 ta" }));

    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({
        postId: POST_ID,
        payload: { order_ids: ["101"] },
      }),
    );
    expect(
      await screen.findByText("1 ta buyurtma qabul qilindi. 2 tasi shu pochtada qoldi."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "№101 ni tanlash" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "№102 ni tanlash" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "№103 ni tanlash" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(`/mails/${POST_ID}`);
    expect(mocks.returnOrders).not.toHaveBeenCalled();
  });

  it("pochta yopilsa (hammasi qabul qilindi) — xabar va «Rad etilgan pochtalar» ro'yxatiga qaytiladi", async () => {
    const user = userEvent.setup();
    setup(["101", "102"]);
    mocks.receive.mockResolvedValue(
      result({
        orderIds: ["101", "102"],
        remainingOrderIds: [],
        postStatus: "canceled_received",
        postClosed: true,
      }),
    );
    renderPage("admin");

    await user.click(screen.getByRole("checkbox", { name: "Barcha buyurtmalarni tanlash" }));
    await user.click(screen.getByRole("button", { name: "Pochtani qabul qilish — 2 ta" }));

    expect(await screen.findByTestId("refused-list")).toBeInTheDocument();
    expect(
      screen.getByText(
        "2 ta buyurtma qabul qilindi. Pochta yopildi — undagi barcha buyurtmalar qabul qilindi yoki filialga qaytarildi.",
      ),
    ).toBeInTheDocument();
  });

  it("eski javob (`post_closed` yo'q) — avvalgi matn; pochta bo'shasa ham viloyat zaxirasi ochilmaydi, o'chiq so'rov qayta so'ralmaydi", async () => {
    const user = userEvent.setup();
    let rows = ["101"];
    setup(() => rows);
    mocks.receive.mockImplementation(async () => {
      rows = [];
      return result({
        orderIds: ["101"],
        remainingOrderIds: null,
        postStatus: null,
        postClosed: null,
      });
    });
    renderPage("registrator", "HQ", { fallbackRegionId: "14", fallbackRegionName: "Samarqand" });

    await selectRow(user, "101");
    await user.click(screen.getByRole("button", { name: "Pochtani qabul qilish — 1 ta" }));

    expect(
      await screen.findByText("Rad etilgan pochta muvaffaqiyatli qabul qilindi."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /ni tanlash$/ })).toBeNull();
    expect(mocks.apiGet).not.toHaveBeenCalled();
    expect(mocks.refetchDetail).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent(`/mails/${POST_ID}`);
  });

  it("HQ ogohlantirishi va tanlov izohi: ikkala amal, tanlanmaganlar pochtada qoladi", async () => {
    const user = userEvent.setup();
    setup(["101", "102"]);
    renderPage("registrator", "HQ");

    expect(screen.getByRole("note")).toHaveTextContent(
      "«Pochtani qabul qilish» yoki «Filialga qaytarish» tugmasini bosing. Tanlanmagan buyurtmalar shu pochtada qoladi.",
    );
    await selectRow(user, "101");
    expect(
      screen.getByText(
        "Qabul qilish va qaytarish faqat tanlangan buyurtmalarga qo'llanadi — qolganlari shu pochtada qoladi",
      ),
    ).toBeInTheDocument();
  });
});

describe("MailDetailPage — HQ: «Filialga qaytarish»", () => {
  beforeEach(() => {
    mocks.receive.mockReset();
    mocks.returnOrders.mockReset();
  });

  it.each([
    ["registrator", "HQ"],
    ["admin", undefined],
    ["manager", "HQ"],
  ])(
    "%s (%s): filial jo'natgan pochtada ikkinchi (secondary) tugma, faqat tanlov bilan faol",
    async (role, branchType) => {
      const user = userEvent.setup();
      setup(["101", "102"]);
      renderPage(role, branchType);

      // Yordamchi so'rov — faqat pochtaning o'zi uchun, `view=current`.
      expect(mocks.useMailDetail).toHaveBeenCalledWith(
        POST_ID,
        expect.objectContaining({ view: "current", silentError: true }),
      );
      const button = screen.getByRole("button", { name: "Filialga qaytarish — 0 ta" });
      expect(button).toBeDisabled();
      await selectRow(user, "102");
      expect(screen.getByRole("button", { name: "Filialga qaytarish — 1 ta" })).toBeEnabled();
      // Asosiy amal o'zgarmagan va bitta.
      expect(screen.getByRole("button", { name: "Pochtani qabul qilish — 1 ta" })).toBeEnabled();
    },
  );

  it("HQ kuryeri olib kelgan pochta (jo'natuvchi filial — HQ): qaytarish tugmasi yo'q", () => {
    setup(["101"], HQ_COURIER_POST);
    renderPage("registrator", "HQ");

    expect(
      screen.getByRole("button", { name: "Pochtani qabul qilish — 0 ta" }),
    ).toBeInTheDocument();
    expect(returnButton()).toBeNull();
    expect(screen.getByRole("note")).not.toHaveTextContent("Filialga qaytarish");
    expect(screen.getByRole("note")).toHaveTextContent(
      "Tanlanmagan buyurtmalar shu pochtada qoladi.",
    );
  });

  it("pochta ma'lumoti yuklanmasa — sahifa ishlaydi, xato holati yo'q, faqat qaytarish tugmasi yo'q", () => {
    setup(["101", "102"], null, true);
    renderPage("admin");

    expect(screen.getByRole("checkbox", { name: "№101 ni tanlash" })).toBeInTheDocument();
    expect(screen.queryByText("Ma'lumotlarni yuklab bo'lmadi")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Pochtani qabul qilish — 0 ta" }),
    ).toBeInTheDocument();
    expect(returnButton()).toBeNull();
  });

  it("filial (REGIONAL) menejeri: qaytarish yo'q, qabul — avvalgi matn bilan, sahifada qoladi", async () => {
    const user = userEvent.setup();
    setup(["101", "102"]);
    mocks.receive.mockResolvedValue(
      result({ orderIds: ["101"], postStatus: "canceled_received", postClosed: true }),
    );
    renderPage("manager", "REGIONAL");

    // Filial menejeriga yordamchi so'rov yuborilmaydi.
    expect(mocks.useMailDetail.mock.calls.every(([postId]) => postId === "")).toBe(true);
    expect(returnButton()).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Mos buyurtmalar ro'yxatda avtomatik tanlanadi, so'ng «Pochtani qabul qilish» tugmasini bosing.",
    );
    expect(screen.getByRole("note")).not.toHaveTextContent("shu pochtada qoladi");

    await selectRow(user, "101");
    await user.click(screen.getByRole("button", { name: "Pochtani qabul qilish — 1 ta" }));

    expect(
      await screen.findByText("Rad etilgan pochta muvaffaqiyatli qabul qilindi."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(`/mails/${POST_ID}`);
  });

  it("tasdiq oynasi: HQ → filial, oqibatlar; faqat tanlangan `order_ids` yuboriladi, qaytarilganlar yashiriladi", async () => {
    const user = userEvent.setup();
    setup(["101", "102", "103"]);
    mocks.returnOrders.mockResolvedValue(
      result({
        orderIds: ["102"],
        remainingOrderIds: ["101", "103"],
        requeuedPostIds: ["88"],
        returnBranchId: "14",
      }),
    );
    renderPage("registrator", "HQ");

    await selectRow(user, "102");
    await user.click(screen.getByRole("button", { name: "Filialga qaytarish — 1 ta" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: "Buyurtmalarni filialga qaytarish",
    });
    expect(within(dialog).getByText("HQ")).toBeInTheDocument();
    expect(within(dialog).getByText("Samarqand filiali")).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      "1 ta buyurtma «Samarqand filiali» filialiga qaytadi — filial ularni «Rad etilgan pochtalar» bo'limidan qabul qiladi",
    );
    expect(dialog).toHaveTextContent("Tanlanmagan 2 ta buyurtma shu pochtada qoladi");
    expect(mocks.returnOrders).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Qaytarish" }));

    await waitFor(() =>
      expect(mocks.returnOrders).toHaveBeenCalledWith({
        postId: POST_ID,
        payload: { order_ids: ["102"] },
      }),
    );
    expect(
      await screen.findByText("1 ta buyurtma «Samarqand filiali» filialiga qaytarildi."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("checkbox", { name: "№102 ni tanlash" })).toBeNull(),
    );
    expect(screen.getByRole("checkbox", { name: "№101 ni tanlash" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(`/mails/${POST_ID}`);
    expect(mocks.receive).not.toHaveBeenCalled();
  });

  it("bekor qilinsa — so'rov yo'q, tanlov saqlanadi", async () => {
    const user = userEvent.setup();
    setup(["101", "102"]);
    renderPage("admin");

    await selectRow(user, "101");
    await user.click(screen.getByRole("button", { name: "Filialga qaytarish — 1 ta" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.returnOrders).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Filialga qaytarish — 1 ta" })).toBeEnabled();
  });

  it("backend rad etsa (409) — xabar oyna ichida, oyna ochiq qoladi", async () => {
    const user = userEvent.setup();
    setup(["101", "102"]);
    mocks.returnOrders.mockRejectedValue({
      response: { status: 409, data: { message: "Buyurtma №101 shu orada qabul qilingan" } },
    });
    renderPage("admin");

    await selectRow(user, "101");
    await user.click(screen.getByRole("button", { name: "Filialga qaytarish — 1 ta" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Qaytarish" }));

    expect(
      await within(dialog).findByText("Buyurtma №101 shu orada qabul qilingan"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "№101 ni tanlash" })).toBeInTheDocument();
  });

  it("oxirgi buyurtmalar qaytarilsa — pochta yopildi, ro'yxatga qaytiladi", async () => {
    const user = userEvent.setup();
    setup(["101"]);
    mocks.returnOrders.mockResolvedValue(
      result({
        orderIds: ["101"],
        remainingOrderIds: [],
        postStatus: "canceled_received",
        postClosed: true,
      }),
    );
    renderPage("superadmin");

    await selectRow(user, "101");
    await user.click(screen.getByRole("button", { name: "Filialga qaytarish — 1 ta" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Pochtada buyurtma qolmaydi — pochta yopiladi");
    await user.click(within(dialog).getByRole("button", { name: "Qaytarish" }));

    expect(await screen.findByTestId("refused-list")).toBeInTheDocument();
    expect(
      screen.getByText(
        "1 ta buyurtma «Samarqand filiali» filialiga qaytarildi. Pochta yopildi — undagi barcha buyurtmalar qabul qilindi yoki filialga qaytarildi.",
      ),
    ).toBeInTheDocument();
  });
});

/** Ega qarori 2026-11-09: rad etilgan pochtada ham qidiruv (takroriy telefonlar bannerisiz); kuryerda yo'q. */
describe("MailDetailPage — rad etilgan pochtada qidiruv", () => {
  const searchbox = () => screen.getByRole("searchbox", { name: "Pochtadagi buyurtmalarni qidirish" });
  const rowIds = () =>
    within(screen.getByRole("table"))
      .queryAllByRole("checkbox", { name: /^№\d+ ni tanlash$/ })
      .map((box) => box.getAttribute("aria-label")?.replace(/^№(\d+) ni tanlash$/, "$1"));

  beforeEach(() => {
    mocks.receive.mockReset();
    mocks.returnOrders.mockReset();
    mocks.refetchDetail.mockReset();
    mocks.apiGet.mockReset().mockResolvedValue({ data: { data: { items: [order("900")] } } });
  });

  it("HQ: № bo'yicha topadi, «Ko'rinayotganlarni tanlash» → faqat topilgan qabul qilinadi; banner yo'q", async () => {
    const user = userEvent.setup();
    setup(["101", "102", "103"]);
    mocks.receive.mockResolvedValue(result({ orderIds: ["103"], remainingOrderIds: ["101", "102"] }));
    renderPage("registrator", "HQ");

    // Hamma qatorda bir xil raqam — rad etilgan pochtada takroriy telefonlar banneri chiqmaydi.
    expect(screen.queryByTestId("mail-duplicate-phones")).toBeNull();
    await user.type(searchbox(), "103");
    await waitFor(() => expect(rowIds()).toEqual(["103"]));
    expect(screen.getByTestId("mail-search-status")).toHaveTextContent("«103» bo'yicha 1 ta buyurtma topildi");

    await user.click(
      within(screen.getByRole("region", { name: "Tanlangan buyurtmalar" })).getByRole("button", {
        name: "Ko'rinayotganlarni tanlash (1)",
      }),
    );
    expect(returnButton()).toHaveAccessibleName("Filialga qaytarish — 1 ta");
    await user.click(screen.getByRole("button", { name: "Pochtani qabul qilish — 1 ta" }));
    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith({ postId: POST_ID, payload: { order_ids: ["103"] } }),
    );
  });

  it("filial (REGIONAL) menejeri: kuryer qaytargan pochtada ham qidiruv bor", async () => {
    const user = userEvent.setup();
    setup(["101", "102"]);
    renderPage("manager", "REGIONAL");

    await user.type(searchbox(), "Mijoz 102");
    await waitFor(() => expect(rowIds()).toEqual(["102"]));
  });

  it("kuryer (faqat o'qish): qidiruv yo'q", () => {
    setup(["101", "102"]);
    renderPage("courier", "REGIONAL");
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
