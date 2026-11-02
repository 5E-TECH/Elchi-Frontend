import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import { OrderMeta } from "../../../widgets/order-meta";
import ScanPostDetail from "../../scan/ui/ScanPostDetail";
import { mailArrivalState } from "../../scan/model/scanPickers";
import MailDetailPage from "./index";

/**
 * vaICniE4 (backend #618): `GET post/orders/:id` qabul qilingan pochtaga sukut bo'yicha `view=all` beradi (sobiq
 * a'zolar ham). Haqiqiy `useMailDetail` va so'rov bilan: holatsiz kirish yo'llari (buyurtma sahifasidagi «Pochta»
 * havolasi, skanerdagi «Pochtani ochish», skaner tanlovi — `mailArrivalState`) aniq `view=current` so'raydi va faqat
 * joriy buyurtmalarni ko'rsatadi; eski pochta (tarix) — server sukuti.
 */

const apiGet = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/api/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/api/api")>()),
  api: { get: apiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({ useOrderQrScanner: () => undefined }));

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const POST_ID = "78";
const DETAIL_URL = `post/orders/${POST_ID}`;

const row = (id: string, history?: { in_post_now: boolean; current_post_id?: string | null }) => ({
  id,
  status: "received",
  createdAt: "2026-10-05T09:14:00.000Z",
  updatedAt: "2026-10-05T09:14:00.000Z",
  where_deliver: "address",
  total_price: 100000,
  region_id: "12",
  customer: { id: `c${id}`, name: `Mijoz ${id}`, phone_number: "+998914521830" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Guliston", region_id: "12", region: { name: "Sirdaryo" } },
  ...history,
});

const POST = { id: POST_ID, status: "received", courier_id: "0", region_id: "12", region: { id: "12", name: "Sirdaryo" } };
const totals = (home: number) => ({
  homeOrders: { homeOrders: home, homeOrdersTotalPrice: home * 100000 },
  centerOrders: { centerOrders: 0, centerOrdersTotalPrice: 0 },
});
/** `view=current` — faqat hozir pochtadagilar (avvalgi shakl). */
const CURRENT_BODY = { allOrdersByPostId: [row("101")], post: POST, ...totals(1) };
/** Server sukuti (`view=all`) — sobiq a'zo №102 ham, boshqa pochtada. */
const ALL_BODY = {
  allOrdersByPostId: [row("101", { in_post_now: true }), row("102", { in_post_now: false, current_post_id: "88" })],
  post: POST,
  view: "all",
  history_incomplete: false,
  ...totals(2),
};

const ORDER = {
  id: "95",
  where_deliver: "center",
  market: { id: "m7", name: "Kimdur Kimdur", phone_number: "+998992222222" },
  courier_id: "93",
  post_id: POST_ID,
  holder_type: "COURIER",
  holder_courier_id: "93",
  branch: { id: "1", name: "HQ Toshkent" },
};

const adminState = {
  role: { id: "1", role: "admin", region: null, name: "Admin" },
  user: {
    user: { id: "1", role: "admin" },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const detailCalls = () => apiGet.mock.calls.filter(([url]) => url === DETAIL_URL);

const renderApp = (route: string | { pathname: string; state?: unknown }) =>
  renderWithProviders(
    <Routes>
      <Route path="/orders/edit/:id" element={<OrderMeta order={ORDER} role="admin" canOpenMails />} />
      <Route
        path="/scan/:token"
        element={<ScanPostDetail data={{ statusCode: 200, data: { id: POST_ID, order_quantity: 1, post_total_price: 100000 } }} />}
      />
      <Route path="/mails/:id" element={<MailDetailPage />} />
    </Routes>,
    { route, preloadedState: adminState },
  );

/** Faqat joriy №101 ro'yxatda, sobiq a'zo №102 — yo'q. */
const expectOnlyCurrentOrders = async () => {
  expect(await screen.findByRole("checkbox", { name: "№101 ni tanlash" })).toBeInTheDocument();
  expect(screen.queryByText("Mijoz 102")).not.toBeInTheDocument();
  expect(screen.getByTestId("mail-detail-sub")).toHaveTextContent(/1 ta buyurtma/);
};

describe("MailDetailPage — view=current amal rejimlarida, eski pochtada server sukuti (vaICniE4)", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string, config?: { params?: { view?: string } }) => {
      if (url === DETAIL_URL) {
        const body = config?.params?.view === "current" ? CURRENT_BODY : ALL_BODY;
        return Promise.resolve({ data: { statusCode: 200, message: "ok", data: body } });
      }
      if (url.startsWith("users/")) {
        return Promise.resolve({ data: { statusCode: 200, data: { id: "93", name: "Xorazm Courier", phone_number: "+998970000090" } } });
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  });

  it("admin holatsiz /mails/:id (qabul qilingan pochta) — view=current, faqat joriy buyurtmalar", async () => {
    renderApp(`/mails/${POST_ID}`);

    await expectOnlyCurrentOrders();
    expect(detailCalls()).toEqual([[DETAIL_URL, { params: { view: "current" } }]]);
  });

  it("buyurtma sahifasidagi «Pochta #78» havolasi — view=current", async () => {
    const user = userEvent.setup();
    renderApp("/orders/edit/95");

    const link = screen.getByTestId("meta-post").querySelector("a");
    expect(link).not.toBeNull();
    await user.click(link!);

    await expectOnlyCurrentOrders();
    expect(detailCalls()).toEqual([[DETAIL_URL, { params: { view: "current" } }]]);
  });

  it("skanerlangan pochta → «Pochtani ochish» — view=current", async () => {
    const user = userEvent.setup();
    renderApp(`/scan/PST-${POST_ID}`);

    await user.click(screen.getByRole("link", { name: "Pochtani ochish" }));

    await expectOnlyCurrentOrders();
    expect(detailCalls()).toEqual([[DETAIL_URL, { params: { view: "current" } }]]);
  });

  it("skaner tanlovi (`mailArrivalState`, jo'natish / qabul) — view=current", async () => {
    renderApp({
      pathname: `/mails/${POST_ID}`,
      state: mailArrivalState({ id: POST_ID, regionId: "12", regionName: "Sirdaryo", orders: 1 }, "send"),
    });

    await expectOnlyCurrentOrders();
    expect(detailCalls()).toEqual([[DETAIL_URL, { params: { view: "current" } }]]);
  });

  it("eski pochta (tarix) — view'siz (server sukuti), sobiq a'zo ham ko'rinadi", async () => {
    renderApp({ pathname: `/mails/${POST_ID}`, state: { fromTab: "old", view: "old" } });

    expect(await screen.findByText("Mijoz 102")).toBeInTheDocument();
    expect(screen.getByText("Mijoz 101")).toBeInTheDocument();
    expect(screen.getByTestId("mail-read-only")).toBeInTheDocument();
    await waitFor(() => expect(detailCalls()).toEqual([[DETAIL_URL]]));
  });
});
