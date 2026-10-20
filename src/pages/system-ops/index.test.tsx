import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SystemOpsPage from "./index";
import { HEALTH_SERVICE_KEYS } from "./lib/systemHealth";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: { get: (...a: unknown[]) => apiGetMock(...a) },
}));

/** `analytics-service` KPI konverti (backend `origin/main`). */
const KPI = {
  statusCode: 200,
  message: "KPI stats",
  data: {
    averageOrderValue: 236400,
    averageFulfillmentHours: 18.4,
    onTimeRate: 82.6,
    cancellationRate: 7.5,
    courierEfficiency: 12.4,
    marketRating: [],
    marketRatingMeta: {},
    degraded: false,
    failed_parts: [],
  },
};

type Probe = { status: string; latency_ms?: number; error?: string };

/**
 * api-gateway `GET /health/readiness` (backend `origin/main`, `HealthController.readiness`): konvertsiz tana,
 * hammasi ok — HTTP 200, aks holda 503 (axios `validateStatus` bilan javob sifatida keladi).
 */
const readiness = (overrides: Record<string, Probe> = {}, latency = 19) => {
  const services = HEALTH_SERVICE_KEYS.map((service) => ({
    service,
    latency_ms: latency,
    ...(overrides[service] ?? { status: "ok" }),
  }));
  const allOk = services.every((s) => s.status === "ok");
  return {
    status: allOk ? 200 : 503,
    data: { status: allOk ? "ok" : "degraded", timestamp: "2026-10-21T09:15:00.000Z", services },
  };
};

const mockApi = ({
  health = () => Promise.resolve(readiness()),
  kpi = () => Promise.resolve({ data: KPI }),
  other,
}: {
  health?: () => Promise<unknown>;
  kpi?: () => Promise<unknown>;
  other?: (url: string) => Promise<unknown> | undefined;
} = {}) => {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "health/readiness") return health();
    if (url === "analytics/kpi") return kpi();
    return other?.(url) ?? Promise.resolve({ data: {} });
  });
};

const healthCard = () => screen.getByRole("region", { name: "Tizim holati" });

describe("SystemOps page", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    mockApi();
  });

  it("kirish kartasi maket matni bilan; «← Ops vositalari» havolasi", () => {
    renderWithProviders(<SystemOpsPage />);
    expect(screen.getByText("Tizim — xizmatlar va analitika")).toBeInTheDocument();
    expect(
      screen.getByText("Xizmatlar holati, AI sozlamalari, analitika ko'rsatkichlari va QR-token tekshirish."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ops vositalari/ })).toHaveAttribute("href", "/ops?tab=system");
  });

  it("tartib: kirish → Tizim holati → SLA + KPI → Token tekshirish", async () => {
    renderWithProviders(<SystemOpsPage />);
    await screen.findByText("Hamma xizmatlar ishlayapti");
    await screen.findByText("236 400 so'm");
    const wanted = [
      "Tizim — xizmatlar va analitika",
      "Tizim holati",
      "O'z vaqtida (SLA)",
      "Analitika KPI",
      "Token orqali tekshirish",
    ];
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent ?? "")
      .filter((text) => wanted.includes(text));
    expect(headings).toEqual(wanted);
  });

  it("readiness: `health/readiness` so'raladi, 200 va 503 javob deb qabul qilinadi; liveness so'ralmaydi", async () => {
    renderWithProviders(<SystemOpsPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith("health/readiness", expect.anything()));
    const config = apiGetMock.mock.calls.find(([url]) => url === "health/readiness")?.[1] as {
      validateStatus: (status: number) => boolean;
    };
    expect(config.validateStatus(200)).toBe(true);
    expect(config.validateStatus(503)).toBe(true);
    expect(config.validateStatus(500)).toBe(false);
    expect(config.validateStatus(504)).toBe(false);
    expect(apiGetMock.mock.calls.some(([url]) => url === "health")).toBe(false);
  });

  it("hammasi ishlayapti: badge, xulosa, sanoqlar; ro'yxat yopiq, ochilsa 14 xizmat jadvalda", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    expect(await within(card).findByText("Hamma xizmatlar ishlayapti")).toBeInTheDocument();
    expect(within(card).getByText("Ishlayapti")).toBeInTheDocument();
    expect(within(card).getByText(/^14 ta xizmat · .+ tekshirildi$/)).toBeInTheDocument();
    expect(
      within(card).getByText("14 ta xizmatdan 14 tasi so'rovlarga javob bermoqda · o'rtacha javob 19 ms"),
    ).toBeInTheDocument();
    expect(within(card).getByText("Ishlayapti: 14")).toBeInTheDocument();
    expect(within(card).getByText("Ishlamayapti: 0")).toBeInTheDocument();
    expect(within(card).queryByText(/Noma'lum/)).toBeNull();

    const toggle = within(card).getByRole("button", { name: /Xizmatlar ro'yxati/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(card).queryByRole("table")).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName(/Xizmatlar ro'yxatini yashirish/);
    const table = within(card).getByRole("table", { name: "Xizmatlar holati" });
    expect(within(table).getAllByRole("row")).toHaveLength(15);
    expect(within(table).getByText("Foydalanuvchilar va kirish")).toBeInTheDocument();
    expect(within(table).getByText("IDENTITY · asosiy")).toBeInTheDocument();
    expect(within(table).getByText("CATALOG")).toBeInTheDocument();
  });

  it("qisman (503, yordamchi xizmatlar): warning, maket matni, ro'yxat ochiq, xom xato matni chiqmaydi", async () => {
    mockApi({
      health: () =>
        Promise.resolve(
          readiness({
            NOTIFICATION: { status: "down", latency_ms: 212, error: "reported degraded" },
            SEARCH: { status: "down", latency_ms: 1502, error: "Timeout has occurred" },
          }),
        ),
    });
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    expect(await within(card).findByText("2 ta xizmat javob bermayapti")).toBeInTheDocument();
    expect(within(card).getByText("Qisman ishlayapti")).toBeInTheDocument();
    expect(
      within(card).getByText(
        "14 ta xizmatdan 12 tasi ishlayapti. Bildirishnomalar va qidiruv bilan bog'liq amallar xato berishi mumkin.",
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText("Ishlamayapti: 2")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /Xizmatlar ro'yxatini yashirish/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    const rows = within(within(card).getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Bildirishnomalar va Telegram bot");
    expect(rows[0]).toHaveTextContent("Ishlamayapti");
    expect(rows[0]).toHaveTextContent("212 ms");
    expect(rows[0]).toHaveTextContent("Xizmat o'zini nosoz deb bildirdi");
    expect(rows[0]).toHaveTextContent("Bot tokeni yoki bog'liq tizim tekshiruvdan o'tmagan bo'lishi mumkin");
    expect(rows[1]).toHaveTextContent("Qidiruv");
    expect(rows[1]).toHaveTextContent("1 502 ms");
    expect(rows[1]).toHaveTextContent("Javob kutilgan vaqtda kelmadi");
    expect(rows[1]).toHaveTextContent("1,5 soniyadan oshdi");
    expect(rows[2]).toHaveTextContent("Foydalanuvchilar va kirish");
    expect(screen.queryByText(/reported degraded|Timeout has occurred/)).toBeNull();
  });

  it("S1 asosiy xizmat (Order) ishlamayapti: danger, maket matni; AI ulanmagan — «Noma'lum»", async () => {
    mockApi({
      health: () =>
        Promise.resolve(
          readiness({
            ORDER: { status: "down", latency_ms: 38, error: "Internal error: ECONNREFUSED 10.0.0.4" },
            AI: { status: "unknown", error: "client not registered" },
          }),
        ),
    });
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    expect(await within(card).findByText("Asosiy xizmat ishlamayapti: Buyurtmalar")).toBeInTheDocument();
    expect(
      within(card).getByText(
        "Buyurtma yaratish, holatini o'zgartirish va sotish ishlamaydi. Qolgan 12 ta xizmat javob bermoqda, AI xizmati bu muhitda ulanmagan.",
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText("Ishlayapti: 12")).toBeInTheDocument();
    expect(within(card).getByText("Ishlamayapti: 1")).toBeInTheDocument();
    expect(within(card).getByText("Noma'lum: 1")).toBeInTheDocument();
    const rows = within(within(card).getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Buyurtmalar");
    expect(rows[0]).toHaveTextContent("ORDER · asosiy");
    expect(rows[0]).toHaveTextContent("Xizmat xato qaytardi");
    expect(rows[0]).toHaveTextContent("Batafsil sabab server jurnalida");
    expect(rows[1]).toHaveTextContent("AI buyurtma");
    expect(rows[1]).toHaveTextContent("Noma'lum");
    expect(rows[1]).toHaveTextContent("—");
    expect(rows[1]).toHaveTextContent("Xizmat ulanmagan");
    expect(rows[1]).toHaveTextContent("Bu muhitda AI xizmati sozlanmagan");
    expect(screen.queryByText(/ECONNREFUSED|client not registered/)).toBeNull();
  });

  it("bir nechta asosiy xizmat + yordamchi xizmat ishlamayapti: ko'plik sarlavha, ta'sirlar va qo'shimcha izoh", async () => {
    mockApi({
      health: () =>
        Promise.resolve(
          readiness({
            ORDER: { status: "down", latency_ms: 40, error: "x" },
            FINANCE: { status: "down", latency_ms: 1500, error: "Timeout has occurred" },
            SEARCH: { status: "down", latency_ms: 30, error: "reported down" },
          }),
        ),
    });
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    expect(await within(card).findByText("Asosiy xizmatlar ishlamayapti: Buyurtmalar, Moliya va kassa")).toBeInTheDocument();
    expect(
      within(card).getByText(
        "Buyurtma yaratish, holatini o'zgartirish va sotish ishlamaydi. To'lovlar, kassa va balans amallari ishlamaydi. Qolgan 11 ta xizmat javob bermoqda. Yordamchi xizmatlardan 1 tasi ham ishlamayapti.",
      ),
    ).toBeInTheDocument();
    // Yordamchi (Qidiruv) xizmati — «Bog'liq tizim…» izohi (bot izohi faqat Bildirishnomalarda).
    expect(within(card).getByText("Bog'liq tizim tekshiruvdan o'tmagan bo'lishi mumkin")).toBeInTheDocument();
  });

  it("hech biri javob bermayapti: «Hech bir xizmat javob bermayapti» va maket izohi", async () => {
    const all = Object.fromEntries(
      HEALTH_SERVICE_KEYS.map((key) => [key, { status: "down", latency_ms: 1500, error: "Timeout has occurred" }]),
    );
    mockApi({ health: () => Promise.resolve(readiness(all)) });
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    expect(await within(card).findByText("Hech bir xizmat javob bermayapti")).toBeInTheDocument();
    expect(
      within(card).getByText(
        "Barcha 14 ta xizmat 1,5 soniya ichida javob bermadi. Odatda bu ichki xabarlar navbati yoki server to'xtaganini bildiradi.",
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText("Ishlayapti: 0")).toBeInTheDocument();
    expect(within(card).getByText("Ishlamayapti: 14")).toBeInTheDocument();
  });

  it("yuklanish: «tekshirilmoqda…», «Tekshirilmoqda» tugmasi o'chiq, ro'yxat skeleti", () => {
    mockApi({ health: () => new Promise(() => {}) });
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    expect(within(card).getByText("14 ta xizmat · tekshirilmoqda…")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Tekshirilmoqda" })).toBeDisabled();
    expect(within(card).getByRole("status", { name: "Tizim holati tekshirilmoqda" })).toBeInTheDocument();
    expect(card).toHaveAttribute("aria-busy", "true");
  });

  it("xato (504): «Noma'lum», «Tizim holatini olib bo'lmadi», «Xato kodi: 504»; «Qayta urinish» qayta so'raydi", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    mockApi({
      health: () => {
        attempt += 1;
        return attempt === 1
          ? Promise.reject({ response: { status: 504, data: { message: "Gateway Timeout upstream" } } })
          : Promise.resolve(readiness());
      },
    });
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    expect(await within(card).findByText("Tizim holatini olib bo'lmadi")).toBeInTheDocument();
    expect(within(card).getByText("Noma'lum")).toBeInTheDocument();
    expect(within(card).getByText("Xato kodi: 504")).toBeInTheDocument();
    expect(within(card).getByText("Oxirgi muvaffaqiyatli tekshiruv: —")).toBeInTheDocument();
    expect(screen.queryByText(/Gateway Timeout upstream/)).toBeNull();

    await user.click(within(card).getByRole("button", { name: "Qayta urinish" }));
    expect(await within(card).findByText("Hamma xizmatlar ishlayapti")).toBeInTheDocument();
    expect(attempt).toBe(2);
  });

  it("`services` siz 503 — xato holati («Xato kodi: 503»)", async () => {
    mockApi({ health: () => Promise.resolve({ status: 503, data: { message: "Service Unavailable" }, config: {} }) });
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    expect(await within(card).findByText("Tizim holatini olib bo'lmadi")).toBeInTheDocument();
    expect(within(card).getByText("Xato kodi: 503")).toBeInTheDocument();
    expect(screen.queryByText("Service Unavailable")).toBeNull();
  });

  it("«Yangilash» readiness'ni qayta so'raydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    await within(card).findByText("Hamma xizmatlar ishlayapti");
    const calls = () => apiGetMock.mock.calls.filter(([url]) => url === "health/readiness").length;
    expect(calls()).toBe(1);
    await user.click(within(card).getByRole("button", { name: "Yangilash" }));
    await waitFor(() => expect(calls()).toBe(2));
  });

  it("KPI: SLA gauge, bekor qilish darajasi, o'rtacha qiymat va vaqt; kuryer — o'rtacha buyurtma soni (D3)", async () => {
    renderWithProviders(<SystemOpsPage />);

    expect(
      await screen.findByRole("img", { name: "O'z vaqtida yetkazish (SLA): 82,6% — 24 soat ichida yetkazilgan buyurtmalar ulushi" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Yaxshi · 70% va undan yuqori")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bekor qilish darajasi 7,5%" })).toBeInTheDocument();
    expect(screen.getByText("236 400 so'm")).toBeInTheDocument();
    expect(screen.getByText("18 soat 24 daq")).toBeInTheDocument();
    expect(screen.getByText("O'rtacha 12,4 ta buyurtma")).toBeInTheDocument();
    expect(screen.queryByText("12,4%")).toBeNull();
    expect(screen.getByText("Ma'lumot yo'q — reyting hali hisoblanmagan")).toBeInTheDocument();
  });

  it("KPI xatosi: danger ogohlantirish, xom matn yo'q; «Qayta urinish» qayta yuklaydi", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    mockApi({
      kpi: () => {
        attempt += 1;
        return attempt === 1
          ? Promise.reject({ response: { status: 500, data: { message: "analytics RPC timeout (raw)" } } })
          : Promise.resolve({ data: KPI });
      },
    });
    renderWithProviders(<SystemOpsPage />);
    const title = await screen.findByText("Analitika ko'rsatkichlarini olib bo'lmadi");
    const alert = title.closest<HTMLElement>("[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert).toHaveTextContent("Analitika xizmati javob bermadi.");
    expect(screen.queryByText(/analytics RPC timeout/)).toBeNull();
    expect(screen.getByRole("region", { name: "Analitika KPI" })).toBeInTheDocument();

    await user.click(within(alert as HTMLElement).getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("236 400 so'm")).toBeInTheDocument();
  });

  it("types scan token and clicks Tekshirish — calls api.get with scan/t1 and lists the result fields", async () => {
    const user = userEvent.setup();
    mockApi({
      other: (url) =>
        url === "scan/t1"
          ? Promise.resolve({
              data: { type: "batch", data: { id: "124", status: "RECEIVED", qr_code_token: "BTB-7F3K29QX", orders: [{}, {}] } },
            })
          : undefined,
    });
    renderWithProviders(<SystemOpsPage />);

    await user.type(screen.getByRole("searchbox", { name: "Token" }), "t1");
    await user.click(screen.getByRole("button", { name: "Tekshirish" }));

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith("scan/t1"));
    const result = await screen.findByRole("status", { name: "Natija" });
    expect(within(result).getByText("Paket")).toBeInTheDocument();
    expect(within(result).getByText("Qabul qilingan")).toBeInTheDocument();
    expect(within(result).getByText("BTB-7F3K29QX")).toBeInTheDocument();
    expect(within(result).getByText("2 ta")).toBeInTheDocument();
    // Xom JSON chiqmaydi.
    expect(screen.queryByText(/"type"/)).toBeNull();
  });

  it("404 — «Topilmadi»", async () => {
    const user = userEvent.setup();
    mockApi({
      other: (url) =>
        url.startsWith("scan/") ? Promise.reject({ response: { status: 404, data: { message: "Topilmadi" } } }) : undefined,
    });
    renderWithProviders(<SystemOpsPage />);

    await user.type(screen.getByRole("searchbox", { name: "Token" }), "nope");
    await user.click(screen.getByRole("button", { name: "Tekshirish" }));

    expect(await screen.findByText("Bu token bo'yicha buyurtma, paket yoki pochta topilmadi.")).toBeInTheDocument();
  });
});
