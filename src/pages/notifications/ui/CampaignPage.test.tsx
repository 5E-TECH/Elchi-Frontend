import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CampaignPage from "./CampaignPage";
import { SMS_KEYS } from "../../../entities/sms";
import { shiftDay, tashkentToday } from "../../../entities/notification-campaign";

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
  text: "Chegirma 20%",
  sample_text: "Chegirma 20%\nRad etish: https://api.elchipochta.uz/sms/stop/998901111111.abc",
  encoding: "GSM-7",
  parts: 1,
  total: 3,
  recipients: 1,
  blocked_no_consent: 1,
  skipped_invalid_phone: 1,
  max_fanout: 200,
  fanout_exceeded: false,
  tariff: 175,
  estimated_cost: 175,
  scheduled_for: new Date().toISOString(),
  sms_enabled: true,
};

const TEMPLATES = [
  {
    id: "t1",
    code: "promo.autumn",
    message_class: "promo",
    lang: "uz",
    text: "Kuzgi chegirma {{discount}}",
    required_vars: ["discount"],
    provider_template_id: null,
    is_active: true,
    encoding: "GSM-7",
    parts: 1,
    needs_provider_approval: false,
  },
  {
    id: "t2",
    code: "order.delivered",
    message_class: "transactional",
    lang: "uz",
    text: "Buyurtmangiz yetkazildi",
    required_vars: [],
    provider_template_id: null,
    is_active: true,
    encoding: "GSM-7",
    parts: 1,
    needs_provider_approval: false,
  },
];

/** Jonli auditoriya javobi (namuna matn bilan so'raladi). */
const audience = (patch: Partial<typeof preview> = {}) => ({
  ...preview,
  text: "Elchi",
  sample_text: "Elchi",
  total: 430,
  recipients: 386,
  blocked_no_consent: 41,
  skipped_invalid_phone: 3,
  ...patch,
});

const HISTORY = [
  {
    id: "5",
    created_at: new Date().toISOString(),
    message_class: "transactional",
    text: "Hurmatli mijoz, 10-oktabr kuni qabul punkti 10:00 dan ishlaydi.",
    total: 86,
    queued: 86,
    blocked: 0,
    skipped: 0,
    sent: 86,
    delivered: 61,
    failed: 3,
    pending: 25,
    estimated_cost: null,
  },
];

describe("CampaignPage (sVByLMnt)", () => {
  beforeEach(() => {
    api.get.mockReset().mockImplementation((url: string) => {
      if (url.endsWith("tariffs"))
        return Promise.resolve({ data: { data: { transactional: 95, promo: 175, security: 95 } } });
      if (url.endsWith("sms/campaigns")) return Promise.resolve({ data: { data: HISTORY } });
      if (url.endsWith("sms/status")) {
        return Promise.resolve({
          data: {
            data: {
              quiet_hours: { start: 18 * 60, end: 9 * 60 },
              enabled: true,
              used_today: 80,
              daily_cap: 500,
            },
          },
        });
      }
      if (url.endsWith("sms/templates")) return Promise.resolve({ data: { data: TEMPLATES } });
      if (url === "region")
        return Promise.resolve({ data: { data: [{ id: 1, name: "Toshkent sh." }] } });
      if (url === "district")
        return Promise.resolve({
          data: { data: [{ id: 12, name: "Chilonzor tumani", region_id: 1 }] },
        });
      if (url === "markets")
        return Promise.resolve({ data: { data: { items: [{ id: 3, name: "Baraka Shop" }] } } });
      return Promise.resolve({ data: { data: [] } });
    });
    api.post
      .mockReset()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith("preview")
            ? { data: { data: preview } }
            : {
                data: {
                  data: {
                    campaign_id: "5",
                    queued: 1,
                    blocked_no_consent: 1,
                    skipped_invalid_phone: 1,
                  },
                },
              },
        ),
      );
  });

  const fill = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
    await user.type(screen.getByRole("textbox", { name: "Xabar matni" }), text);
    await user.type(
      screen.getByRole("textbox", { name: "Telefon raqamlari (har qatorda bittadan)" }),
      "+998901111111\n+998902222222\nxyz",
    );
  };

  it("an unfilled {{placeholder}} is red and blocks the review (footer explains why)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Salom {{{{discount}}");

    const varInput = screen.getByRole("textbox", { name: "discount" });
    expect(varInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeDisabled();
    expect(
      screen.getByText("Ko'rib chiqish uchun barcha o'zgaruvchilarni to'ldiring"),
    ).toBeInTheDocument();

    await user.type(varInput, "20%");
    expect(varInput).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeEnabled();
  });

  it("confirmation shows exact recipients, blocked, invalid, forecast and the FULL text; sends with Idempotency-Key", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma 20%");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });
    expect(dialog).toHaveTextContent("1 ta qabul qiluvchiga yuboriladi");
    const body = within(dialog).getByTestId("campaign-confirm");
    expect(body).toHaveTextContent("Roziligi yo'q — yuborilmaydi1 ta");
    expect(body).toHaveTextContent("Raqami noto'g'ri — o'tkazib yuboriladi1 ta");
    expect(body).toHaveTextContent("Prognoz narx175 so'm");
    expect(body).toHaveTextContent("GSM-7, har biri 1 bo'lak");
    expect(body).toHaveTextContent("Bu amalni qaytarib bo'lmaydi.");
    expect(
      within(dialog).getByText(/Rad etish: https:\/\/api\.elchipochta\.uz\/sms\/stop/),
    ).toBeInTheDocument();

    const previewBody = api.post.mock.calls[0][1];
    expect(previewBody).toMatchObject({
      message_class: "promo",
      text: "Chegirma 20%",
      segment: { phones: ["+998901111111", "+998902222222", "xyz"] },
    });

    await user.click(within(dialog).getByRole("button", { name: "Yuborish" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    const [url, body2, config] = api.post.mock.calls[1];
    expect(url).toBe("notifications/sms/campaigns");
    expect(body2).toEqual(previewBody);
    expect(config.headers["Idempotency-Key"]).toMatch(/.{8,}/);
    expect(await screen.findByText(/Navbatga qo'yildi: 1 ta/)).toBeInTheDocument();
  });

  it("each review gets a NEW Idempotency-Key; the same dialog reuses one key", async () => {
    api.post.mockImplementation((url: string) =>
      url.endsWith("preview")
        ? Promise.resolve({ data: { data: preview } })
        : Promise.reject(
            Object.assign(new Error("dup"), {
              response: { status: 409, data: { message: "Takroriy so'rov" } },
            }),
          ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");

    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    let dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });
    await user.click(within(dialog).getByRole("button", { name: "Yuborish" }));
    // 409 (takroriy kalit) — i18n xato ko'rsatiladi (xom backend matni emas), oyna yopiladi, qayta yuborilmaydi.
    expect(
      await screen.findByText(/Kampaniya qabul qilinmadi: u allaqachon yuborilgan/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Takroriy so'rov")).toBeNull();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const firstKey = api.post.mock.calls[1][2].headers["Idempotency-Key"];

    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });
    await user.click(within(dialog).getByRole("button", { name: "Yuborish" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(4));
    const secondKey = api.post.mock.calls[3][2].headers["Idempotency-Key"];
    expect(secondKey).not.toBe(firstKey);
  });

  it("cancel closes the confirmation without sending", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("over the fan-out limit the send button stays disabled", async () => {
    api.post.mockResolvedValueOnce({ data: { data: { ...preview, fanout_exceeded: true } } });
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });
    expect(within(dialog).getByText(/chegaradan \(200\) ko'p/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Yuborish" })).toBeDisabled();
  });

  it("a later scheduled time is shown with the promo quiet hours", async () => {
    api.post.mockResolvedValueOnce({
      data: {
        data: {
          ...preview,
          scheduled_for: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });
    expect(within(dialog).getByText(/da yuboriladi$/)).toBeInTheDocument();
    expect(within(dialog).getByText("Reklama taqiqi: 18:00–09:00")).toBeInTheDocument();
  });

  /** Jonli auditoriya (`text: "Elchi"`) va «Ko'rib chiqish» preview'ini ajratadi. */
  const mockPreview = (live: () => Promise<unknown>) =>
    api.post.mockImplementation((url: string, body: { text?: string }) => {
      if (url.endsWith("preview") && body?.text === "Elchi") return live();
      if (url.endsWith("preview")) return Promise.resolve({ data: { data: preview } });
      return Promise.resolve({
        data: { data: { campaign_id: "9", queued: 1, blocked_no_consent: 0, skipped_invalid_phone: 0 } },
      });
    });

  const openSegment = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("radio", { name: "Mijozlar segmenti" }));
    return screen.findByTestId("campaign-audience");
  };

  const liveCalls = () =>
    api.post.mock.calls.filter(([url, body]) => String(url).endsWith("preview") && body?.text === "Elchi");

  it("⭐ «Xabar turi» — faqat «Reklama»: xizmat xabari va tranzaksion shablonlar yo'q, so'rov `promo`", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);

    expect(screen.queryByRole("radio", { name: "Xizmat xabari" })).toBeNull();
    const kind = screen.getByRole("textbox", { name: "Xabar turi" });
    expect(kind).toHaveValue("Reklama");
    expect(kind).toHaveAttribute("readonly");
    expect(screen.getByText("Faqat reklama")).toBeInTheDocument();
    expect(screen.getByText("Xizmat xabarlari tizim hodisalaridan o'zi ketadi")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /^Shablon/ }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: "promo.autumn" })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: /order\.delivered/ })).toBeNull();
    await user.keyboard("{Escape}");

    await fill(user, "Chegirma 20%");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    await screen.findByRole("alertdialog", { name: "SMS kampaniyani yuborishni tasdiqlang" });
    expect(api.post.mock.calls[0][1]).toMatchObject({ message_class: "promo" });
  });

  it("⭐ segment: Select'lar → jonli auditoriya (debounce, namuna matn) + «Bugun qolgan: 420 / 500 · Kerak: 386 ta»", async () => {
    mockPreview(() => Promise.resolve({ data: { data: audience() } }));
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    const block = await openSegment(user);

    expect(screen.queryByRole("textbox", { name: /ID$/ })).toBeNull();
    await user.click(screen.getByRole("combobox", { name: /^Viloyat/ }));
    await user.click(await screen.findByRole("option", { name: "Toshkent sh." }));
    const district = screen.getByRole("combobox", { name: /^Tuman/ });
    await waitFor(() => expect(district).toBeEnabled());
    await user.click(district);
    await user.click(await screen.findByRole("option", { name: "Chilonzor tumani" }));
    await user.click(screen.getByRole("combobox", { name: /^Market/ }));
    await user.click(await screen.findByRole("option", { name: "Baraka Shop" }));
    await user.type(screen.getByRole("textbox", { name: "Buyurtmalar soni — dan" }), "2");

    await waitFor(() => expect(block).toHaveAttribute("data-state", "ready"));
    expect(block).toHaveTextContent("Auditoriya: 386 ta");
    expect(block).toHaveTextContent(
      "Yana 41 tasida rozilik yo'q, 3 tasining raqami noto'g'ri — ularga yuborilmaydi",
    );
    expect(block).toHaveTextContent("SMS limiti · Bugun qolgan: 420 / 500");
    expect(block).toHaveTextContent("Kerak: 386 ta");
    expect(within(block).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "80");

    // Debounce: har bosishda emas — oxirgi so'rov to'liq segment bilan, matn — namuna (yuborilmaydi).
    const last = liveCalls().at(-1)!;
    expect(last[1]).toEqual({
      message_class: "promo",
      text: "Elchi",
      segment: { region_id: "1", district_id: "12", market_id: "3", min_orders: 2 },
    });
    expect(liveCalls().length).toBeLessThan(6);
    expect(api.post.mock.calls.every(([url]) => String(url).endsWith("preview"))).toBe(true);

    // Matn yozilgach — ko'rib chiqish ochiladi, haqiqiy preview o'sha segment bilan.
    await user.type(screen.getByRole("textbox", { name: "Xabar matni" }), "Chegirma");
    const review = screen.getByRole("button", { name: "Ko'rib chiqish" });
    expect(review).toBeEnabled();
    await user.click(review);
    await screen.findByRole("alertdialog", { name: "SMS kampaniyani yuborishni tasdiqlang" });
    const reviewCall = api.post.mock.calls.find(([, body]) => body?.text === "Chegirma")!;
    expect(reviewCall[1].segment).toEqual({
      region_id: "1",
      district_id: "12",
      market_id: "3",
      min_orders: 2,
    });
  });

  it("⭐ limitdan oshsa — qizil holat, izoh va «Ko'rib chiqish» o'chiq", async () => {
    mockPreview(() => Promise.resolve({ data: { data: audience({ recipients: 450 }) } }));
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await user.type(screen.getByRole("textbox", { name: "Xabar matni" }), "Chegirma");
    const block = await openSegment(user);

    await waitFor(() => expect(block).toHaveAttribute("data-state", "limit"));
    expect(block).toHaveTextContent("Kerak: 450 ta");
    expect(within(block).getByRole("alert")).toHaveTextContent(
      "Bugungi limit yetmaydi: kerak 450 ta, qolgan 420 ta",
    );
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeDisabled();
    expect(
      screen.getByText("Bugungi SMS limiti yetmaydi — segmentni toraytiring yoki ertaga yuboring"),
    ).toBeInTheDocument();
  });

  it("0 ta va chegaradan ko'p — tushunarli holat, ko'rib chiqish o'chiq", async () => {
    let next = audience({ recipients: 0, blocked_no_consent: 0, skipped_invalid_phone: 0 });
    mockPreview(() => Promise.resolve({ data: { data: next } }));
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await user.type(screen.getByRole("textbox", { name: "Xabar matni" }), "Chegirma");
    const block = await openSegment(user);

    await waitFor(() => expect(block).toHaveAttribute("data-state", "empty"));
    expect(block).toHaveTextContent("Auditoriya: 0 ta");
    expect(block).toHaveTextContent("Bu filtrlarga mos mijoz topilmadi");
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeDisabled();

    next = audience({ recipients: 200, fanout_exceeded: true, max_fanout: 200 });
    await user.type(screen.getByRole("textbox", { name: "Buyurtmalar soni — dan" }), "3");
    await waitFor(() => expect(block).toHaveAttribute("data-state", "fanout"));
    expect(block).toHaveTextContent("Auditoriya juda katta");
    expect(block).toHaveTextContent("Bitta kampaniyada ko'pi bilan 200 ta");
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeDisabled();
  });

  it("auditoriya xatosi (server) — i18n matn va «Qayta urinish» (xom matn yo'q)", async () => {
    let fail = true;
    mockPreview(() =>
      fail
        ? Promise.reject(
            Object.assign(new Error("x"), {
              response: { status: 500, data: { message: "SMS_OPT_OUT_BASE_URL sozlanmagan" } },
            }),
          )
        : Promise.resolve({ data: { data: audience() } }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    const block = await openSegment(user);

    await waitFor(() => expect(block).toHaveAttribute("data-state", "error"));
    expect(block).toHaveTextContent("Auditoriyani hisoblab bo'lmadi");
    expect(screen.queryByText(/SMS_OPT_OUT_BASE_URL/)).toBeNull();
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeDisabled();

    fail = false;
    await user.click(within(block).getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(block).toHaveAttribute("data-state", "ready"));
    expect(block).toHaveTextContent("Auditoriya: 386 ta");
  });

  it.each([
    [409, "SMS sozlamalari to'liq emas"],
    [400, "matn, o'zgaruvchilar va filtrlarni tekshiring"],
  ])("⭐ auditoriya xatosi %s — sababi i18n matnda, «Qayta urinish» yo'q (natija o'zgarmaydi)", async (status, reason) => {
    mockPreview(() =>
      Promise.reject(
        Object.assign(new Error("x"), {
          response: { status, data: { message: "opt_out_not_configured" } },
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");
    const block = await openSegment(user);

    await waitFor(() => expect(block).toHaveAttribute("data-state", "error"));
    expect(block).toHaveTextContent("Auditoriyani hisoblab bo'lmadi");
    expect(block).toHaveTextContent(reason);
    expect(block).not.toHaveTextContent("Tarmoqni tekshirib");
    expect(within(block).queryByRole("button", { name: "Qayta urinish" })).toBeNull();
    expect(screen.queryByText(/opt_out_not_configured/)).toBeNull();
    expect(screen.getByText("Auditoriyani hisoblab bo'lmaguncha ko'rib chiqish yopiq")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeDisabled();
  });

  it("SMS holati (kvota) xatosi global xabarga chiqmaydi (`silentError`)", async () => {
    const { queryClient } = renderWithProviders(<CampaignPage />);
    await waitFor(() => expect(queryClient.getQueryCache().find({ queryKey: SMS_KEYS.status })).toBeDefined());
    expect(queryClient.getQueryCache().find({ queryKey: SMS_KEYS.status })?.meta).toEqual({ silentError: true });
  });

  it("«Raqamlar» rejimida jonli so'rov ketmaydi; tasdiq oynasida limitdan oshsa «Yuborish» o'chiq", async () => {
    api.post.mockResolvedValueOnce({ data: { data: { ...preview, recipients: 421 } } });
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");
    expect(screen.queryByTestId("campaign-audience")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });
    expect(within(dialog).getByText(/Bugungi limit yetmaydi: kerak 421 ta, qolgan 420 ta/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Yuborish" })).toBeDisabled();
    expect(liveCalls()).toHaveLength(0);
  });

  it("ko'rib chiqish xatosi (400) — i18n matn, xom backend matni ko'rsatilmaydi", async () => {
    api.post.mockRejectedValueOnce(
      Object.assign(new Error("bad"), {
        response: { status: 400, data: { message: "Kampaniya faqat reklama (message_class='promo')" } },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    expect(
      await screen.findByText("Kampaniya qabul qilinmadi — matn, o'zgaruvchilar va filtrlarni tekshiring"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/message_class/)).toBeNull();
  });

  it("«Yuborish vaqti»: Darhol tanlangan, Toshkent vaqti; «Belgilangan vaqtda» bor (KM-6)", () => {
    renderWithProviders(<CampaignPage />);
    expect(screen.getByRole("heading", { name: "Yuborish vaqti" })).toBeInTheDocument();
    expect(screen.getByText("Toshkent vaqti")).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Yuborish vaqti" });
    expect(within(group).getByRole("radio", { name: /Darhol/ })).toBeChecked();
    expect(within(group).getAllByRole("radio")).toHaveLength(2);
    expect(within(group).getByRole("radio", { name: /Belgilangan vaqtda/ })).not.toBeChecked();
    expect(screen.queryByText(/Taklif/)).toBeNull();
    expect(screen.queryByText(/Saqlangan segment|Segmentni saqlash/)).toBeNull();
  });

  it("history: table with class badge, numbers and the count badge", async () => {
    renderWithProviders(<CampaignPage />);
    const table = await screen.findByRole("table", { name: "Yuborilgan kampaniyalar" });
    expect(within(table).getByText("Xizmat xabari")).toBeInTheDocument();
    expect(within(table).getByText(/Hurmatli mijoz/)).toBeInTheDocument();
    expect(within(table).getByText("25")).toHaveClass("text-warning-fg");
    expect(within(table).getByText("3")).toHaveClass("text-danger-fg");
    expect(screen.getByText("1 ta")).toBeInTheDocument();
  });

  describe("KM-6 (2aS7PFX0): rejalashtirish va «Bekor qilish»", () => {
    const tomorrowAt = (time: string) => `${shiftDay(tashkentToday(), 1)}T${time}:00+05:00`;

    it("«Belgilangan vaqtda» — preview va yaratish `scheduled_at` (+05:00) bilan; «Rejalashtirish» → «Kampaniya rejalashtirildi»", async () => {
      api.post.mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith("preview")
            ? {
                data: {
                  data: {
                    ...preview,
                    scheduled_for: tomorrowAt("10:00"),
                    scheduled_for_tashkent: tomorrowAt("10:00"),
                    requested_at: tomorrowAt("10:00"),
                    quiet_hours_shifted: false,
                  },
                },
              }
            : {
                data: {
                  data: {
                    campaign_id: "12",
                    status: "scheduled",
                    queued: 0,
                    recipients: 1,
                    blocked_no_consent: 1,
                    skipped_invalid_phone: 1,
                    estimated_cost: 175,
                    scheduled_for: tomorrowAt("10:00"),
                    scheduled_for_tashkent: tomorrowAt("10:00"),
                    requested_at: tomorrowAt("10:00"),
                    quiet_hours_shifted: false,
                  },
                },
              },
        ),
      );
      const user = userEvent.setup();
      renderWithProviders(<CampaignPage />);
      await fill(user, "Chegirma");
      await user.click(screen.getByRole("radio", { name: /Belgilangan vaqtda/ }));
      expect(screen.getByTestId("campaign-schedule-chosen")).toHaveTextContent("Ertaga, 10:00 da yuboriladi");
      await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));

      const dialog = await screen.findByRole("alertdialog", { name: "SMS kampaniyani yuborishni tasdiqlang" });
      expect(api.post.mock.calls[0][1]).toMatchObject({ scheduled_at: tomorrowAt("10:00") });
      expect(within(dialog).getByText("Ertaga, 10:00 da yuboriladi")).toBeInTheDocument();
      expect(within(dialog).getByText(/Vaqti kelguncha kampaniyani tarixdan bekor qilish mumkin/)).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Yuborish" })).toBeNull();

      await user.click(within(dialog).getByRole("button", { name: "Rejalashtirish" }));
      await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
      const [url, body] = api.post.mock.calls[1];
      expect(url).toBe("notifications/sms/campaigns");
      expect(body).toMatchObject({ scheduled_at: tomorrowAt("10:00") });
      expect(
        await screen.findByText("Kampaniya rejalashtirildi: ertaga, 10:00 da yuboriladi. Qabul qiluvchilar (taxminan): 1 ta."),
      ).toBeInTheDocument();
    });

    it("`quiet_hours_shifted` — tasdiqda «Tungi taqiq sababli … ga surildi» va so'ralgan vaqt", async () => {
      api.post.mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith("preview")
            ? {
                data: {
                  data: {
                    ...preview,
                    scheduled_for: `${shiftDay(tashkentToday(), 2)}T09:00:00+05:00`,
                    scheduled_for_tashkent: `${shiftDay(tashkentToday(), 2)}T09:00:00+05:00`,
                    requested_at: tomorrowAt("20:00"),
                    quiet_hours_shifted: true,
                  },
                },
              }
            : { data: { data: { campaign_id: "1", queued: 0, blocked_no_consent: 0, skipped_invalid_phone: 0 } } },
        ),
      );
      const user = userEvent.setup();
      renderWithProviders(<CampaignPage />);
      await fill(user, "Chegirma");
      await user.click(screen.getByRole("radio", { name: /Belgilangan vaqtda/ }));
      await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
      const dialog = await screen.findByRole("alertdialog", { name: "SMS kampaniyani yuborishni tasdiqlang" });
      const shifted = within(dialog).getByTestId("campaign-confirm-shifted");
      expect(shifted).toHaveTextContent(/Tungi taqiq sababli .*09:00 ga surildi/);
      expect(shifted).toHaveTextContent("So'ralgan: Ertaga, 20:00. Reklama 18:00–09:00 oralig'ida yuborilmaydi.");
    });

    it("400 «… 90 kun oldinga» — tushunarli matn (xom backend matni emas)", async () => {
      api.post.mockRejectedValue({
        response: { status: 400, data: { message: "scheduled_at ko'pi bilan 90 kun oldinga" } },
      });
      const user = userEvent.setup();
      renderWithProviders(<CampaignPage />);
      await fill(user, "Chegirma");
      await user.click(screen.getByRole("radio", { name: /Belgilangan vaqtda/ }));
      await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
      expect(
        await screen.findByText("Ko'pi bilan 90 kun oldinga rejalashtirish mumkin — boshqa sanani tanlang"),
      ).toBeInTheDocument();
      expect(screen.queryByText(/scheduled_at/)).toBeNull();
    });

    const SCHEDULED_ROW = {
      ...HISTORY[0],
      id: "7",
      message_class: "promo",
      text: "Kuzgi chegirma 20%",
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      status: "scheduled",
      scheduled_at: tomorrowAt("10:00"),
      scheduled_for: tomorrowAt("10:00"),
      scheduled_for_tashkent: tomorrowAt("10:00"),
      requested_at: tomorrowAt("10:00"),
      quiet_hours_shifted: false,
      can_cancel: true,
    };
    const FAILED_ROW = {
      ...HISTORY[0],
      id: "8",
      message_class: "promo",
      text: "Bayram aksiyasi",
      status: "failed",
      last_error: "kunlik kvota tugagan",
      can_cancel: false,
    };
    const withHistory = (rows: unknown[]) => {
      const base = api.get.getMockImplementation();
      api.get.mockImplementation((url: string, ...rest: unknown[]) =>
        url.endsWith("sms/campaigns") ? Promise.resolve({ data: { data: rows } }) : base?.(url, ...rest),
      );
    };

    it("tarix: «Rejalashtirilgan» + vaqt, «Rad etildi» + sabab; «Bekor qilish» → tasdiq → POST …/7/cancel", async () => {
      withHistory([SCHEDULED_ROW, FAILED_ROW]);
      api.post.mockResolvedValue({ data: { data: { ...SCHEDULED_ROW, status: "cancelled", can_cancel: false } } });
      const user = userEvent.setup();
      renderWithProviders(<CampaignPage />);
      const table = await screen.findByRole("table", { name: "Yuborilgan kampaniyalar" });
      expect(within(table).getByText("Rejalashtirilgan")).toBeInTheDocument();
      expect(within(table).getByText("Ertaga, 10:00 da yuboriladi")).toBeInTheDocument();
      expect(within(table).getByText("Rad etildi")).toBeInTheDocument();
      expect(within(table).getByText("Sabab: kunlik kvota tugagan")).toBeInTheDocument();
      // Faqat `can_cancel` qatorda tugma bor.
      expect(within(table).getAllByRole("button", { name: "Bekor qilish" })).toHaveLength(1);

      await user.click(within(table).getByRole("button", { name: "Bekor qilish" }));
      const confirmDialog = await screen.findByRole("alertdialog", { name: "Kampaniyani bekor qilasizmi?" });
      expect(confirmDialog).toHaveTextContent("Ertaga, 10:00 da yuborilishi kerak edi");
      expect(api.post).not.toHaveBeenCalled();
      await user.click(within(confirmDialog).getByRole("button", { name: "Kampaniyani bekor qilish" }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith("notifications/sms/campaigns/7/cancel"));
      expect(await screen.findByText("Kampaniya bekor qilindi")).toBeInTheDocument();
    });

    it("bekor qilish 409 — «allaqachon boshlangan yoki rejalashtirilmagan», tarix qayta so'raladi", async () => {
      withHistory([SCHEDULED_ROW]);
      api.post.mockRejectedValue({ response: { status: 409, data: { message: "Kampaniya bekor qilinmaydi" } } });
      const user = userEvent.setup();
      renderWithProviders(<CampaignPage />);
      const table = await screen.findByRole("table", { name: "Yuborilgan kampaniyalar" });
      const historyCalls = () => api.get.mock.calls.filter(([url]) => String(url).endsWith("sms/campaigns")).length;
      const before = historyCalls();
      await user.click(within(table).getByRole("button", { name: "Bekor qilish" }));
      const confirmDialog = await screen.findByRole("alertdialog", { name: "Kampaniyani bekor qilasizmi?" });
      await user.click(within(confirmDialog).getByRole("button", { name: "Kampaniyani bekor qilish" }));
      expect(
        await screen.findByText("Bekor qilib bo'lmadi: kampaniya allaqachon boshlangan yoki rejalashtirilmagan"),
      ).toBeInTheDocument();
      await waitFor(() => expect(historyCalls()).toBeGreaterThan(before));
      expect(screen.queryByText(/Kampaniya bekor qilinmaydi/)).toBeNull();
    });
  });
});
