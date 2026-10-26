import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CampaignPage from "./CampaignPage";

/**
 * sdNGqCBa — SMS kampaniya: «Buyurtmalar soni» «dan – gacha» (`segment.max_orders`, teskari oraliq so'ralmaydi) va
 * «Saqlangan segment» (`audience_segment_id` — `segment` O'RNIGA; faqat mijoz shartli segmentlar; backend 400
 * `segment_not_customer_only` / 404 — aniq matn). Hech narsa yuborilmaydi — `api` mock.
 */
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../../shared/api/api", () => ({ api }));

const preview = {
  message_class: "promo",
  text: "Chegirma",
  sample_text: "Chegirma\nRad etish: https://api.elchipochta.uz/sms/stop/x",
  encoding: "GSM-7",
  parts: 1,
  total: 430,
  recipients: 386,
  blocked_no_consent: 41,
  skipped_invalid_phone: 3,
  max_fanout: 5000,
  fanout_exceeded: false,
  tariff: 175,
  estimated_cost: 386 * 175,
  scheduled_for: new Date().toISOString(),
  sms_enabled: true,
};

/** `GET notifications/audience/segments` — ikkala kanal uchun bitta jadval. */
const SEGMENTS = [
  {
    id: "11",
    name: "Toshkent — faol mijozlar (2–10)",
    description: "Kuzgi aksiya",
    audience: {
      include_customers: true,
      segment: { region_id: "1", min_orders: 2, max_orders: 10 },
    },
    last_total: 120,
    last_counted_at: null,
  },
  {
    id: "12",
    name: "Kuryerlar va mijozlar",
    description: null,
    audience: { roles: ["courier"], include_customers: true, confirm_all_customers: true },
    last_total: 900,
    last_counted_at: null,
  },
  {
    id: "13",
    name: "Hamma",
    description: null,
    audience: { broadcast: true },
    last_total: 5000,
    last_counted_at: null,
  },
];

const httpError = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error("x"), { response: { status, data } });

const RANGE_TEXT = "Buyurtmalar soni: «dan» «gacha» dan katta bo'lmasligi kerak (teskari oraliq)";

describe("CampaignPage — «gacha» va saqlangan segment (sdNGqCBa)", () => {
  let live: (body: Record<string, unknown>) => Promise<unknown>;

  beforeEach(() => {
    live = () => Promise.resolve({ data: { data: { ...preview, text: "Elchi", sample_text: "Elchi" } } });
    api.get.mockReset().mockImplementation((url: string) => {
      if (url.endsWith("tariffs"))
        return Promise.resolve({ data: { data: { transactional: 95, promo: 175, security: 95 } } });
      if (url.endsWith("sms/status")) {
        return Promise.resolve({
          data: {
            data: { quiet_hours: { start: 18 * 60, end: 9 * 60 }, enabled: true, used_today: 80, daily_cap: 500 },
          },
        });
      }
      if (url === "notifications/audience/segments") return Promise.resolve({ data: { data: { items: SEGMENTS } } });
      if (url === "region") return Promise.resolve({ data: { data: [{ id: 1, name: "Toshkent sh." }] } });
      return Promise.resolve({ data: { data: [] } });
    });
    api.post.mockReset().mockImplementation((url: string, body: Record<string, unknown>) => {
      if (url.endsWith("preview") && body?.text === "Elchi") return live(body);
      if (url.endsWith("preview")) return Promise.resolve({ data: { data: preview } });
      return Promise.resolve({
        data: { data: { campaign_id: "9", queued: 386, blocked_no_consent: 41, skipped_invalid_phone: 3 } },
      });
    });
  });

  const openSegment = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("radio", { name: "Mijozlar segmenti" }));
    return screen.findByTestId("campaign-audience");
  };
  const liveCalls = () =>
    api.post.mock.calls.filter(([url, body]) => String(url).endsWith("preview") && body?.text === "Elchi");

  it("⭐ «gacha» → `segment.max_orders`; teskari oraliq — xato maydon ostida, so'rov ketmaydi, ko'rib chiqish yopiq", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await user.type(screen.getByRole("textbox", { name: "Xabar matni" }), "Chegirma");
    const block = await openSegment(user);

    await user.type(screen.getByRole("textbox", { name: "Buyurtmalar soni — dan" }), "2");
    await user.type(screen.getByRole("textbox", { name: "Buyurtmalar soni — gacha" }), "10");
    await waitFor(() => expect(block).toHaveAttribute("data-state", "ready"));
    await waitFor(() =>
      expect(liveCalls().at(-1)![1]).toEqual({
        message_class: "promo",
        text: "Elchi",
        segment: { min_orders: 2, max_orders: 10 },
      }),
    );

    // «dan» 20 > «gacha» 10 — backend matni bilan bir xil ma'no, so'rov yuborilmaydi.
    const before = liveCalls().length;
    const from = screen.getByRole("textbox", { name: "Buyurtmalar soni — dan" });
    await user.clear(from);
    await user.type(from, "20");
    expect(await screen.findByText("«dan» «gacha» dan katta bo'lmasligi kerak (teskari oraliq)")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Buyurtmalar soni — gacha" })).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(block).toHaveAttribute("data-state", "error"));
    expect(block).toHaveTextContent(RANGE_TEXT);
    expect(within(block).queryByRole("button", { name: "Qayta urinish" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeDisabled();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(liveCalls().length).toBe(before);
  });

  it("⭐ backend 400 «teskari oraliq» (ko'rib chiqishda) — aniq i18n matn, xom matn yo'q", async () => {
    api.post.mockImplementation((url: string, body: Record<string, unknown>) => {
      if (url.endsWith("preview") && body?.text === "Elchi") return live(body);
      return Promise.reject(
        httpError(400, { message: "segment: min_orders max_orders dan katta bo'lmasligi kerak (teskari oraliq)" }),
      );
    });
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await user.type(screen.getByRole("textbox", { name: "Xabar matni" }), "Chegirma");
    const block = await openSegment(user);
    await waitFor(() => expect(block).toHaveAttribute("data-state", "ready"));
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    expect(await screen.findByText(RANGE_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(/min_orders/)).toBeNull();
  });

  it("⭐ saqlangan segment: faqat mijoz shartlilari; tanlansa `audience_segment_id` (segmentsiz), shart filtrlarga ko'chadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await user.type(screen.getByRole("textbox", { name: "Xabar matni" }), "Chegirma");
    const block = await openSegment(user);
    expect(
      screen.getByText("Faqat mijoz shartli segmentlar chiqadi; tanlangan shart SMS formasiga ko'chiriladi"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /^Saqlangan segment/ }));
    expect(await screen.findByRole("option", { name: /Toshkent — faol mijozlar/ })).toBeInTheDocument();
    // Xodimli va «Hamma» segmentlari SMS'ga yaramaydi — ro'yxatda yo'q.
    expect(screen.queryByRole("option", { name: /Kuryerlar va mijozlar/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /^Hamma/ })).toBeNull();
    await user.click(screen.getByRole("option", { name: /Toshkent — faol mijozlar/ }));

    expect(
      await screen.findByText("«Toshkent — faol mijozlar (2–10)» segmenti qo'llandi — filtrni o'zgartirsangiz, tanlov bekor bo'ladi"),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Buyurtmalar soni — dan" })).toHaveValue("2");
    expect(screen.getByRole("textbox", { name: "Buyurtmalar soni — gacha" })).toHaveValue("10");
    await waitFor(() =>
      expect(liveCalls().at(-1)![1]).toEqual({ message_class: "promo", text: "Elchi", audience_segment_id: "11" }),
    );
    await waitFor(() => expect(block).toHaveAttribute("data-state", "ready"));

    // Ko'rib chiqish va yuborish — o'sha `audience_segment_id`, `segment` YO'Q (ikkalasi birga — backend 400).
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "SMS kampaniyani yuborishni tasdiqlang" });
    const reviewBody = api.post.mock.calls.find(([, body]) => body?.text === "Chegirma")![1];
    expect(reviewBody.audience_segment_id).toBe("11");
    expect(reviewBody).not.toHaveProperty("segment");
    await user.click(within(dialog).getByRole("button", { name: "Yuborish" }));
    await waitFor(() =>
      expect(api.post.mock.calls.some(([url]) => url === "notifications/sms/campaigns")).toBe(true),
    );
    const sendBody = api.post.mock.calls.find(([url]) => url === "notifications/sms/campaigns")![1];
    expect(sendBody.audience_segment_id).toBe("11");
    expect(sendBody).not.toHaveProperty("segment");
  });

  it("filtr qo'lda o'zgarsa — saqlangan segment tanlovi bekor, endi `segment` yuboriladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await openSegment(user);
    await user.click(screen.getByRole("combobox", { name: /^Saqlangan segment/ }));
    await user.click(await screen.findByRole("option", { name: /Toshkent — faol mijozlar/ }));
    await waitFor(() => expect(liveCalls().at(-1)![1]).toHaveProperty("audience_segment_id", "11"));

    const to = screen.getByRole("textbox", { name: "Buyurtmalar soni — gacha" });
    await user.clear(to);
    await user.type(to, "5");
    await waitFor(() =>
      expect(liveCalls().at(-1)![1]).toEqual({
        message_class: "promo",
        text: "Elchi",
        segment: { region_id: "1", min_orders: 2, max_orders: 5 },
      }),
    );
    expect(screen.getByRole("combobox", { name: /^Saqlangan segment/ })).toHaveTextContent(
      "Tanlanmagan — filtrlar bo'yicha",
    );
  });

  it.each([
    [
      "400 segment_not_customer_only (reason)",
      httpError(400, { message: "Saqlangan segment mijozlarni nishonlamaydi", reason: "segment_not_customer_only" }),
      "Bu saqlangan segmentda xodimlar bor yoki mijozlar yo'q — SMS kampaniya faqat mijozlarga",
    ],
    [
      "400 xodim rollari (gateway reason'ni tushirgan)",
      httpError(400, {
        message:
          "Saqlangan segmentda xodim rollari / broadcast bor — SMS reklama kampaniyasi faqat mijozlar segmenti bilan",
      }),
      "Xodimlarga SMS — «Xabar yuborish» → «Auditoriya» orqali",
    ],
    [
      "404 Segment topilmadi",
      httpError(404, { message: "Segment topilmadi" }),
      "Saqlangan segment topilmadi — o'chirilgan bo'lishi mumkin. Boshqasini tanlang",
    ],
  ])("⭐ %s — aniq matn auditoriya blokida va pastda, «Qayta urinish» yo'q", async (_name, error, text) => {
    const live0 = live;
    live = (body) => (body.audience_segment_id ? Promise.reject(error) : live0(body));
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await user.type(screen.getByRole("textbox", { name: "Xabar matni" }), "Chegirma");
    const block = await openSegment(user);
    await user.click(screen.getByRole("combobox", { name: /^Saqlangan segment/ }));
    await user.click(await screen.findByRole("option", { name: /Toshkent — faol mijozlar/ }));

    await waitFor(() => expect(block).toHaveAttribute("data-state", "error"));
    expect(block).toHaveTextContent(text);
    expect(within(block).queryByRole("button", { name: "Qayta urinish" })).toBeNull();
    expect(screen.queryByText(/segment_not_customer_only|nishonlamaydi|broadcast bor/)).toBeNull();
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeDisabled();
  });
});
