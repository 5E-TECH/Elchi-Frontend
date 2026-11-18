import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { HealthCard } from "./HealthCard";
import { HEALTH_SERVICE_KEYS } from "../lib/systemHealth";
import { renderWithProviders } from "../../../test/test-utils";
import { expectNoRawBackendText, expectRequestBody, mockEnvelope, mockRejection } from "../../../test/mockEnvelope";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../../shared/api/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    post: (...a: unknown[]) => apiPostMock(...a),
  },
}));

const BOT_URL = "health/notification-bot";
const RECHECK_URL = "health/notification-bot/recheck";
const GENERIC_HINT = "Bot tokeni yoki bog'liq tizim tekshiruvdan o'tmagan bo'lishi mumkin";

/** `GET /health/readiness` — NOTIFICATION `reported degraded` (oFfOWGuo: ochiq readiness sababni bermaydi). */
const readiness = (notification: "reported" | "ok" = "reported") => {
  const services = HEALTH_SERVICE_KEYS.map((service) => ({
    service,
    latency_ms: 19,
    ...(service === "NOTIFICATION" && notification === "reported"
      ? { status: "down", error: "reported degraded", error_kind: "reported" }
      : { status: "ok" }),
  }));
  const allOk = notification === "ok";
  return {
    status: allOk ? 200 : 503,
    data: { status: allOk ? "ok" : "degraded", timestamp: "2026-11-17T09:15:00.000Z", services },
  };
};

/** api-gateway `GET /health/notification-bot` (BOT-DIAG-BE) — konvertsiz `NotificationBotHealthResponseDto`. */
const botBody = (bot: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  status: bot.healthy === true ? "ok" : "degraded",
  bot: {
    enabled: true,
    mode: "off",
    healthy: false,
    username: null,
    reason: "getMe o'tmadi",
    checked_at: "2026-11-16T09:05:00.000Z",
    error_kind: "network",
    error_status: null,
    error_text: "Telegram getMe failed (0): fetch failed (ENOTFOUND)",
    restart_required: false,
    ...bot,
  },
  timestamp: "2026-11-17T09:15:01.000Z",
  ...extra,
});

const mockApi = ({
  health = () => Promise.resolve(readiness()),
  bot = () => Promise.resolve({ data: botBody() }),
}: {
  health?: () => Promise<unknown>;
  bot?: () => Promise<unknown>;
} = {}) => {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "health/readiness") return health();
    if (url === BOT_URL) return bot();
    return Promise.resolve(mockEnvelope({}));
  });
};

const card = () => screen.getByRole("region", { name: "Tizim holati" });
const findPanel = () => screen.findByRole("region", { name: "Telegram bot holati" });
const notificationRow = () =>
  within(within(card()).getByRole("table")).getAllByRole("row").find((row) => row.textContent?.includes("NOTIFICATION"))!;
const botCalls = () => apiGetMock.mock.calls.filter(([url]) => url === BOT_URL).length;
const readinessCalls = () => apiGetMock.mock.calls.filter(([url]) => url === "health/readiness").length;

describe("HealthCard — Telegram bot nosozligi sababi (BOT-DIAG-FE)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    mockApi();
  });

  it("token rad etildi (401): aniq sabab, keyingi qadam, vaqt; tugma o'rniga «Qayta ishga tushirish kerak»", async () => {
    mockApi({
      bot: () =>
        Promise.resolve({
          data: botBody({
            error_kind: "token_rejected",
            error_status: 401,
            error_text: "Telegram getMe failed (401): Unauthorized",
            restart_required: true,
          }),
        }),
    });
    renderWithProviders(<HealthCard />);
    const panel = await findPanel();
    expect(within(panel).getByText("Telegram bot tokeni rad etildi (401)")).toBeInTheDocument();
    expect(
      within(panel).getByText(/BotFather'dan yangi token oling, serverdagi \.env\.production fayliga yozing/),
    ).toBeInTheDocument();
    expect(within(panel).getByText("Telegram getMe failed (401): Unauthorized")).toBeInTheDocument();
    expect(within(panel).getByText(/^Oxirgi tekshiruv: .*\d{2}:\d{2}$/)).toBeInTheDocument();
    expect(within(panel).getByText("Qayta ishga tushirish kerak")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Qayta tekshirish" })).toBeNull();

    // Jadval qatorida ham umumiy matn o'rniga aniq sabab.
    const row = notificationRow();
    expect(row).toHaveTextContent("Telegram bot tokeni rad etildi (401)");
    expect(row).toHaveTextContent("Xizmat o'zini nosoz deb bildirdi");
    expect(row).not.toHaveTextContent(GENERIC_HINT);
  });

  it.each([
    [
      "network",
      { error_kind: "network" },
      "Server Telegram'ga ulana olmayapti",
      "Server internetini tekshiring. Tarmoq tiklangach bot 5 daqiqa ichida o'zi tiklanadi.",
    ],
    [
      "timeout",
      { error_kind: "timeout", error_text: "Telegram getMe failed (0): timeout" },
      "Server Telegram'ga ulana olmayapti",
      "Telegram belgilangan vaqtda javob bermadi. Tarmoq tiklangach bot 5 daqiqa ichida o'zi tiklanadi.",
    ],
    [
      "telegram_error 429",
      { error_kind: "telegram_error", error_status: 429, error_text: "Telegram getMe failed (429): Too Many Requests" },
      "Telegram xato qaytardi (429)",
      "So'rovlar juda ko'p — biroz kutib, qayta tekshiring.",
    ],
    [
      "telegram_error 502",
      { error_kind: "telegram_error", error_status: 502, error_text: "Telegram getMe failed (502): Bad Gateway" },
      "Telegram xato qaytardi (502)",
      "Nosozlik Telegram tomonida — odatda o'zi tiklanadi. Birozdan keyin qayta tekshiring.",
    ],
    [
      "unknown",
      { error_kind: "unknown", error_text: "TypeError: x is not a function" },
      "Kutilmagan xato",
      "Bot tekshiruvi kutilmagan xato bilan tugadi. Texnik sababni dasturchiga yuboring.",
    ],
  ])("%s: sarlavha, izoh, texnik sabab va «Qayta tekshirish»", async (_name, bot, title, text) => {
    mockApi({ bot: () => Promise.resolve({ data: botBody(bot) }) });
    renderWithProviders(<HealthCard />);
    const panel = await findPanel();
    expect(within(panel).getByText(title)).toBeInTheDocument();
    expect(within(panel).getByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeInTheDocument();
    expect(within(panel).getByText("Texnik sabab:", { exact: false })).toBeInTheDocument();
    expect(within(panel).getByText(/^Oxirgi tekshiruv: /)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Qayta tekshirish" })).toBeEnabled();
    expect(notificationRow()).toHaveTextContent(title);
  });

  it("tekshiruv hali bo'lmagan (`healthy: null`): «Tekshiruv hali tugamagan», vaqt qatori yo'q, qayta tekshirsa bo'ladi", async () => {
    mockApi({
      bot: () =>
        Promise.resolve({
          data: botBody({ healthy: null, checked_at: null, error_kind: null, error_text: null }),
        }),
    });
    renderWithProviders(<HealthCard />);
    const panel = await findPanel();
    expect(within(panel).getByText("Tekshiruv hali tugamagan")).toBeInTheDocument();
    expect(within(panel).queryByText(/Oxirgi tekshiruv/)).toBeNull();
    expect(within(panel).queryByText(/Texnik sabab/)).toBeNull();
    expect(within(panel).getByRole("button", { name: "Qayta tekshirish" })).toBeInTheDocument();
  });

  it("konvertli javob (`{ statusCode, message, data }`) ham tushuniladi", async () => {
    mockApi({ bot: () => Promise.resolve(mockEnvelope(botBody({ error_kind: "timeout" }))) });
    renderWithProviders(<HealthCard />);
    const panel = await findPanel();
    expect(within(panel).getByText("Server Telegram'ga ulana olmayapti")).toBeInTheDocument();
  });

  it.each([404, 405, 403, 503])(
    "endpoint %s bilan rad etsa (backend deploy qilinmagan / ruxsat / xizmat javobsiz) — umumiy matn jimgina qoladi",
    async (status) => {
      mockApi({ bot: () => Promise.reject(mockRejection(status)) });
      renderWithProviders(<HealthCard />);
      await within(card()).findByText("1 ta xizmat javob bermayapti");
      await waitFor(() => expect(botCalls()).toBe(1));
      expect(notificationRow()).toHaveTextContent("Xizmat o'zini nosoz deb bildirdi");
      expect(notificationRow()).toHaveTextContent(GENERIC_HINT);
      expect(screen.queryByRole("region", { name: "Telegram bot holati" })).toBeNull();
      expectNoRawBackendText();
      // Qayta urinilmaydi (bir so'rov) va global xabar chiqmaydi.
      expect(botCalls()).toBe(1);
    },
  );

  it("bot sog' (NOTIFICATION boshqa sabab bilan nosoz) yoki eski xizmat (`error_kind` yo'q) — qo'shimcha blok yo'q", async () => {
    mockApi({ bot: () => Promise.resolve({ data: botBody({ healthy: true, error_kind: null, username: "elchi_bot" }) }) });
    const { unmount } = renderWithProviders(<HealthCard />);
    await waitFor(() => expect(botCalls()).toBe(1));
    await within(card()).findByText("1 ta xizmat javob bermayapti");
    expect(screen.queryByRole("region", { name: "Telegram bot holati" })).toBeNull();
    expect(notificationRow()).toHaveTextContent(GENERIC_HINT);
    unmount();

    apiGetMock.mockClear();
    mockApi({ bot: () => Promise.resolve({ data: botBody({ error_kind: null, error_text: null }) }) });
    renderWithProviders(<HealthCard />);
    await waitFor(() => expect(botCalls()).toBe(1));
    expect(screen.queryByRole("region", { name: "Telegram bot holati" })).toBeNull();
    expect(notificationRow()).toHaveTextContent(GENERIC_HINT);
  });

  it("NOTIFICATION ishlayapti — bot holati so'ralmaydi", async () => {
    mockApi({ health: () => Promise.resolve(readiness("ok")) });
    renderWithProviders(<HealthCard />);
    await within(card()).findByText("Hamma xizmatlar ishlayapti");
    expect(botCalls()).toBe(0);
  });

  it("«Yangilash» bot holatini ham qayta o'qiydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HealthCard />);
    await findPanel();
    expect(botCalls()).toBe(1);
    await user.click(within(card()).getByRole("button", { name: "Yangilash" }));
    await waitFor(() => expect(botCalls()).toBe(2));
  });

  it("«Qayta tekshirish» → POST (tanasiz), yuklanish; bot tiklansa — xabar, readiness qayta o'qiladi, blok yo'qoladi", async () => {
    const user = userEvent.setup();
    let resolvePost: (value: unknown) => void = () => {};
    apiPostMock.mockImplementation(() => new Promise((resolve) => (resolvePost = resolve)));
    renderWithProviders(<HealthCard />);
    const panel = await findPanel();
    const before = readinessCalls();

    // Bot tiklangach readiness ham «hammasi ishlayapti» qaytaradi.
    mockApi({
      health: () => Promise.resolve(readiness("ok")),
      bot: () => Promise.resolve({ data: botBody({ healthy: true, error_kind: null, username: "elchi_bot" }) }),
    });
    await user.click(within(panel).getByRole("button", { name: "Qayta tekshirish" }));
    expectRequestBody(apiPostMock, RECHECK_URL, undefined);
    expect(within(panel).getByRole("button", { name: /Tekshirilmoqda/ })).toHaveAttribute("aria-busy", "true");

    resolvePost({
      data: botBody({ healthy: true, error_kind: null, error_text: null, username: "elchi_bot" }, { rechecked: true }),
    });
    expect(await screen.findByText("Bot ishlayapti")).toBeInTheDocument();
    expect(screen.getByText("Telegram @elchi_bot botini tasdiqladi")).toBeInTheDocument();
    await waitFor(() => expect(readinessCalls()).toBeGreaterThan(before));
    expect(await within(card()).findByText("Hamma xizmatlar ishlayapti")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Telegram bot holati" })).toBeNull();
  });

  it("«Qayta tekshirish» natijasi hali ham nosoz — ogohlantirish va blok yangi sabab bilan", async () => {
    const user = userEvent.setup();
    apiPostMock.mockResolvedValue({
      data: botBody(
        { error_kind: "telegram_error", error_status: 502, error_text: "Telegram getMe failed (502): Bad Gateway" },
        { rechecked: true },
      ),
    });
    renderWithProviders(<HealthCard />);
    const panel = await findPanel();
    expect(within(panel).getByText("Server Telegram'ga ulana olmayapti")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Qayta tekshirish" }));
    expect(await screen.findByText("Bot hali ham tekshiruvdan o'tmadi")).toBeInTheDocument();
    expect(await within(panel).findByText("Telegram xato qaytardi (502)")).toBeInTheDocument();
    expect(within(panel).getByText("Telegram getMe failed (502): Bad Gateway")).toBeInTheDocument();
  });

  it("«Qayta tekshirish» 503 — backend matni (o'zbekcha) notify.error bilan; blok joyida qoladi", async () => {
    const user = userEvent.setup();
    apiPostMock.mockRejectedValue(
      mockRejection(503, "Bildirishnoma xizmati javob bermadi — bot holatini hozir bilib bo'lmaydi."),
    );
    renderWithProviders(<HealthCard />);
    const panel = await findPanel();
    await user.click(within(panel).getByRole("button", { name: "Qayta tekshirish" }));
    expect(await screen.findByText("Qayta tekshirib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Bildirishnoma xizmati javob bermadi — bot holatini hozir bilib bo'lmaydi.")).toBeInTheDocument();
    expect(within(panel).getByText("Server Telegram'ga ulana olmayapti")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Qayta tekshirish" })).toBeEnabled();
  });

  it.each([
    [429, "So'rovlar juda ko'p — biroz kutib, qayta urinib ko'ring."],
    [403, "Birozdan keyin qayta urinib ko'ring."],
  ])("«Qayta tekshirish» %s — o'z matnimiz, xom backend matni chiqmaydi", async (status, description) => {
    const user = userEvent.setup();
    apiPostMock.mockRejectedValue(mockRejection(status));
    renderWithProviders(<HealthCard />);
    const panel = await findPanel();
    await user.click(within(panel).getByRole("button", { name: "Qayta tekshirish" }));
    expect(await screen.findByText("Qayta tekshirib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expectNoRawBackendText();
  });
});
