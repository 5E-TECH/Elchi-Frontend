import { onlineManager } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SystemOpsPage from "./index";
import { HEALTH_SERVICE_KEYS } from "./lib/systemHealth";
import i18n from "../../i18n";
import { renderWithProviders } from "../../test/test-utils";
import { expectNoRawBackendText, mockEnvelope, mockRejection } from "../../test/mockEnvelope";

const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: { get: (...a: unknown[]) => apiGetMock(...a) },
}));

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
  other,
}: {
  health?: () => Promise<unknown>;
  other?: (url: string) => Promise<unknown> | undefined;
} = {}) => {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "health/readiness") return health();
    return other?.(url) ?? Promise.resolve(mockEnvelope({}));
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
    expect(screen.getByText("Tizim holati — xizmatlar va AI")).toBeInTheDocument();
    expect(screen.getByText("Xizmatlar holati va AI sozlamalari.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ops vositalari/ })).toHaveAttribute("href", "/ops?tab=system");
  });

  it("tartib: kirish → Tizim holati → AI holati; KPI va token tekshiruvi yo'q (F2NzXpMv)", async () => {
    renderWithProviders(<SystemOpsPage />);
    await screen.findByText("Hamma xizmatlar ishlayapti");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent).slice(0, 3)).toEqual([
      "Tizim holati — xizmatlar va AI",
      "Tizim holati",
      "AI holati",
    ]);
    expect(screen.queryByText("Analitika KPI")).toBeNull();
    expect(screen.queryByText("Token orqali tekshirish")).toBeNull();
    expect(apiGetMock).not.toHaveBeenCalledWith("analytics/kpi", expect.anything());
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
    // Hali birorta muvaffaqiyatli tekshiruv bo'lmagan — «—» emas, alohida matn.
    expect(within(card).getByText("Muvaffaqiyatli tekshiruv hali bo'lmagan")).toBeInTheDocument();
    expect(within(card).queryByText(/Oxirgi muvaffaqiyatli tekshiruv/)).toBeNull();
    expect(screen.queryByText(/Gateway Timeout upstream/)).toBeNull();

    await user.click(within(card).getByRole("button", { name: "Qayta urinish" }));
    expect(await within(card).findByText("Hamma xizmatlar ishlayapti")).toBeInTheDocument();
    expect(attempt).toBe(2);
    // Tugma yo'qoldi — fokus `<body>` ga emas, kartaga o'tadi.
    await waitFor(() => expect(card).toHaveFocus());
  });

  it("muvaffaqiyatdan keyin «Yangilash» xato bersa: xato holati, «Oxirgi muvaffaqiyatli tekshiruv: <vaqt>»", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    mockApi({
      health: () => {
        attempt += 1;
        return attempt === 1
          ? Promise.resolve(readiness())
          : Promise.reject({ response: { status: 504, data: { message: "Gateway Timeout upstream" } } });
      },
    });
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    await within(card).findByText("Hamma xizmatlar ishlayapti");
    await user.click(within(card).getByRole("button", { name: "Yangilash" }));
    expect(await within(card).findByText("Tizim holatini olib bo'lmadi")).toBeInTheDocument();
    expect(within(card).getByText(/^Oxirgi muvaffaqiyatli tekshiruv: .*\d{2}:\d{2}$/)).toBeInTheDocument();
    expect(within(card).getByText("Xato kodi: 504")).toBeInTheDocument();
    expect(within(card).queryByText("Hamma xizmatlar ishlayapti")).toBeNull();
  });

  it.each([
    ["HTML (SPA fallback)", "<!doctype html><html><body>app</body></html>"],
    ["bo'sh `services`", { status: "ok", services: [] }],
  ])("200, lekin %s — xato holati, kod ham, «tekshirildi» vaqti ham yo'q", async (_name, data) => {
    mockApi({ health: () => Promise.resolve({ status: 200, data, config: {} }) });
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    expect(await within(card).findByText("Tizim holatini olib bo'lmadi")).toBeInTheDocument();
    expect(within(card).getByText("Muvaffaqiyatli tekshiruv hali bo'lmagan")).toBeInTheDocument();
    expect(within(card).queryByText(/Xato kodi/)).toBeNull();
    expect(within(card).queryByText(/tekshirildi/)).toBeNull();
  });

  it("oflayn (so'rov kutib turibdi): cheksiz skelet emas — «Internet aloqasi yo'q»", async () => {
    onlineManager.setOnline(false);
    try {
      renderWithProviders(<SystemOpsPage />);
      const card = healthCard();
      expect(await within(card).findByText("Internet aloqasi yo'q")).toBeInTheDocument();
      expect(card).not.toHaveAttribute("aria-busy");
      expect(within(card).queryByText(/tekshirilmoqda…/)).toBeNull();
      expect(within(card).queryByRole("status", { name: "Tizim holati tekshirilmoqda" })).toBeNull();
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("`services` siz 503 — xato holati («Xato kodi: 503»)", async () => {
    mockApi({ health: () => Promise.resolve({ status: 503, data: { message: "Service Unavailable" }, config: {} }) });
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    expect(await within(card).findByText("Tizim holatini olib bo'lmadi")).toBeInTheDocument();
    expect(within(card).getByText("Xato kodi: 503")).toBeInTheDocument();
    expect(screen.queryByText("Service Unavailable")).toBeNull();
  });

  it("ro'yxat qo'lda yopilgan, keyin daraja o'zgarsa (qisman → asosiy) — yana ochiq (maket qoidasi)", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    mockApi({
      health: () => {
        attempt += 1;
        return Promise.resolve(
          attempt === 1
            ? readiness({ SEARCH: { status: "down", latency_ms: 1502, error: "Timeout has occurred" } })
            : readiness({ ORDER: { status: "down", latency_ms: 38, error: "x" } }),
        );
      },
    });
    renderWithProviders(<SystemOpsPage />);
    const card = healthCard();
    await within(card).findByText("1 ta xizmat javob bermayapti");
    await user.click(within(card).getByRole("button", { name: /Xizmatlar ro'yxatini yashirish/ }));
    expect(within(card).getByRole("button", { name: /Xizmatlar ro'yxati/ })).toHaveAttribute("aria-expanded", "false");

    await user.click(within(card).getByRole("button", { name: "Yangilash" }));
    expect(await within(card).findByText("Asosiy xizmat ishlamayapti: Buyurtmalar")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /Xizmatlar ro'yxati/ })).toHaveAttribute("aria-expanded", "true");
    expect(within(card).getByRole("table")).toBeInTheDocument();
  });

  it("ishlamayotgan yo'q, lekin ulanmagan bor: yashil «Ulangan xizmatlar ishlayapti»; bitta — «xizmati», ikkita — «xizmatlari»", async () => {
    mockApi({ health: () => Promise.resolve(readiness({ AI: { status: "unknown", error: "client not registered" } })) });
    const first = renderWithProviders(<SystemOpsPage />);
    let card = healthCard();
    expect(await within(card).findByText("Ulangan xizmatlar ishlayapti")).toBeInTheDocument();
    expect(card).toHaveAttribute("data-health-level", "ok");
    expect(
      within(card).getByText("14 ta xizmatdan 13 tasi so'rovlarga javob bermoqda, AI xizmati bu muhitda ulanmagan."),
    ).toBeInTheDocument();
    expect(within(card).getByText("Noma'lum: 1")).toBeInTheDocument();
    first.unmount();

    mockApi({
      health: () =>
        Promise.resolve(
          readiness({
            SEARCH: { status: "unknown", error: "client not registered" },
            AI: { status: "unknown", error: "client not registered" },
          }),
        ),
    });
    renderWithProviders(<SystemOpsPage />);
    card = healthCard();
    expect(
      await within(card).findByText(
        "14 ta xizmatdan 12 tasi so'rovlarga javob bermoqda, qidiruv va AI xizmatlari bu muhitda ulanmagan.",
      ),
    ).toBeInTheDocument();
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

  it("so'rov rad etildi (403): o'z matnimiz, xom backend matni yo'q", async () => {
    mockApi({ health: () => Promise.reject(mockRejection(403)) });
    renderWithProviders(<SystemOpsPage />);
    expect(await screen.findByText("Tizim holatini olib bo'lmadi")).toBeInTheDocument();
    expectNoRawBackendText();
  });

  describe("ru/en matnlar", () => {
    afterEach(async () => {
      await i18n.changeLanguage("uz");
    });

    it("en: bitta xizmat — ko'plik xatosi yo'q («1 services» emas), gap o'rtasida bosh harf yo'q", async () => {
      await i18n.changeLanguage("en");
      mockApi({
        health: () =>
          Promise.resolve(readiness({ NOTIFICATION: { status: "down", latency_ms: 212, error: "reported degraded" } })),
      });
      renderWithProviders(<SystemOpsPage />);
      const card = screen.getByRole("region", { name: "System health" });
      expect(await within(card).findByText("Services not responding: 1")).toBeInTheDocument();
      expect(within(card).getByText("13 of 14 services are running. Actions related to notifications may fail.")).toBeInTheDocument();
      expect(within(card).getByText(/^Services: 14 · checked /)).toBeInTheDocument();
      expect(card.textContent).not.toMatch(/\b1 services\b|\b1 supporting services\b/);
    });

    it("en: asosiy + bitta yordamchi — «Supporting services also down: 1.»", async () => {
      await i18n.changeLanguage("en");
      mockApi({
        health: () =>
          Promise.resolve(
            readiness({
              ORDER: { status: "down", latency_ms: 38, error: "x" },
              SEARCH: { status: "down", latency_ms: 30, error: "reported down" },
            }),
          ),
      });
      renderWithProviders(<SystemOpsPage />);
      const card = screen.getByRole("region", { name: "System health" });
      expect(
        await within(card).findByText(
          "Creating orders, changing their status and selling don't work. Other services responding: 12. Supporting services also down: 1.",
        ),
      ).toBeInTheDocument();
    });

    it("ru: yordamchi xizmatlar nomi gap o'rtasida kichik harf bilan", async () => {
      await i18n.changeLanguage("ru");
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
      const card = screen.getByRole("region", { name: "Состояние системы" });
      expect(
        await within(card).findByText(
          "Работают 12 из 14. Действия, связанные с разделами «уведомления и поиск», могут завершаться ошибкой.",
        ),
      ).toBeInTheDocument();
    });
  });
});
