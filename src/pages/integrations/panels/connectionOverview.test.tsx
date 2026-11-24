import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { notify } from "../../../shared/lib/notify";
import ConnectionOverview from "./ConnectionOverview";
import ConnectionSettlement from "./ConnectionSettlement";
import { renderWithProviders } from "../../../test/test-utils";
import type { Connection } from "../useConnections";
import type { ConnectionMetrics } from "../../../entities/integrations/metrics";

/**
 * UMUMIY HOLAT — "Bu ulanish qalay?" savoliga BITTA ekranda javob.
 *
 * Qulflanadigan qoidalar:
 *   • o'lchanmagan qiymat "—", hech qachon `0`; "—" ning sababi so'rov
 *     holatiga qarab aytiladi (yuklanmoqda / xato / server bermayapti);
 *   • status xaritasi yo'q ulanishda "Nomuvofiqlik" raqami chiqmaydi;
 *   • COD oynasi (butun vaqt) 24 soatlik raqamlardan AJRALIB ko'rinadi;
 *   • "Yopilmagan qarz" — Hisob-kitob tabi bilan AYNI manba va AYNI raqam;
 *   • har raqam o'z tabiga olib boradi, yashirin tabga esa havola yo'q;
 *   • "Aloqani sinash" — Ish rejimidagi AYNI amal va AYNI nom.
 *
 * ⚠️ `getByRole` / `toHaveAccessibleName` ISHLATILMAYDI: antd v6 CSS-in-JS
 * jsdom'da yaroqsiz selektor chiqaradi (`div,,,container >.ant-card-head`) va
 * a11y hisoblash uslublarni o'qiyotganda `SyntaxError` beradi. Tugmalar
 * `aria-label` atributi bo'yicha topiladi — natija ayni, uslublar o'qilmaydi.
 */

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
vi.mock("../../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

const integration = {
  uid: "integration:7",
  kind: "integration",
  id: "7",
  name: "Elchi",
  role: "carrier",
  category: "cargo",
  is_active: true,
  subtitle: "",
  raw: { slug: "elchi", base_url: "https://api.elchi.uz", auth_type: "api_key", last_sync_at: null },
} as unknown as Connection;

const partner = {
  uid: "partner:2",
  kind: "partner",
  id: "2",
  name: "BeePost",
  role: "source",
  category: "marketplace",
  is_active: true,
  subtitle: "",
  raw: { webhook_url: "https://beepost.uz/api/v1/elchi/webhook" },
} as unknown as Connection;

const metrics = (over: Partial<ConnectionMetrics> = {}): ConnectionMetrics => ({
  uid: "integration:7",
  kind: "integration",
  id: "7",
  events: 10,
  delivered: 9,
  failed: 1,
  queued: 0,
  success_rate: 90,
  avg_ms: 120,
  last_event_at: null,
  shipments: { total: 12, delivered: 9, failed: 2, mismatch: 1 },
  webhooks: { success: 30, failed: 1, invalid_signature: 3 },
  // `debt` ATAYLAB boshqa — UI uni ishlatmasligi kerak (bitta manba).
  cod: { dispatched: 15_000_000, collected: 9_000_000, remitted: 4_000_000, debt: 999 },
  ...over,
});

/** Hisob-kitob tabi ham shu javobni o'qiydi — `numeric` satr ko'rinishida. */
const BALANCE = { integration_id: "7", outstanding_amount: "5000000.00", outstanding_count: 3 };

const okGet = (url: string) =>
  Promise.resolve(
    String(url).includes("receivable-balance")
      ? { data: { statusCode: 200, data: BALANCE } }
      : { data: { statusCode: 200, data: { items: [], pagination: { total: 0, page: 1, limit: 20 } } } },
  );

/** Banner tugmasi — amallar qatoridan, matn bo'yicha. */
const bannerButton = (text: RegExp) => {
  const actions = screen.queryByTestId("ovw-actions");
  if (!actions) return null;
  return within(actions).queryByText(text)?.closest("button") ?? null;
};

/** Plitka tugmasi — `aria-label` "Yorliq: qiymat. Tab ochish" shaklida. */
const tile = (block: HTMLElement, label: string) =>
  block.querySelector<HTMLButtonElement>(`button[aria-label^="${label}:"]`);
const tileLabel = (block: HTMLElement, label: string) => tile(block, label)?.getAttribute("aria-label") ?? "";
const tileLabels = (block: HTMLElement) =>
  Array.from(block.querySelectorAll("button[aria-label]")).map((b) => b.getAttribute("aria-label") ?? "");

describe("ConnectionOverview — posilka / webhook / COD bloklari", () => {
  beforeEach(() => {
    apiPostMock.mockReset();
    apiGetMock.mockReset();
    apiGetMock.mockImplementation(okGet);
  });

  it("uch blok, har birida OYNA yorlig'i: 24 soat va butun vaqt", async () => {
    renderWithProviders(<ConnectionOverview connection={integration} metrics={metrics()} onFix={vi.fn()} />);

    const shipments = screen.getByTestId("ovw-shipments");
    const webhooks = screen.getByTestId("ovw-webhooks");
    const cod = screen.getByTestId("ovw-cod");

    expect(within(shipments).getByText("oxirgi 24 soat")).toBeInTheDocument();
    expect(within(webhooks).getByText("oxirgi 24 soat")).toBeInTheDocument();
    expect(within(cod).getByText("COD (butun vaqt)")).toBeInTheDocument();
    expect(within(cod).getByText("butun vaqt")).toBeInTheDocument();
    // COD 24 soatlik raqamlarga bog'liq emasligi matn bilan aytiladi.
    expect(within(cod).getByText(/24 soatlik raqamlarga bog'liq emas/)).toBeInTheDocument();

    expect(tileLabel(shipments, "Jami")).toMatch(/^Jami: 12\./);
    expect(tileLabel(shipments, "Yetkazildi")).toMatch(/^Yetkazildi: 9\./);
    expect(tileLabel(shipments, "Yiqilgan")).toMatch(/^Yiqilgan: 2\./);
    expect(tileLabel(shipments, "Nomuvofiqlik")).toMatch(/^Nomuvofiqlik: 1\./);

    expect(tileLabel(webhooks, "Qo'llanildi")).toMatch(/: 30\./);
    expect(tileLabel(webhooks, "Rad etildi")).toMatch(/: 1\./);
    expect(tileLabel(webhooks, "Imzo xato")).toMatch(/: 3\./);

    expect(tileLabel(cod, "Bizga to'langan")).toMatch(/4\s000\s000 so'm/);
    await waitFor(() => expect(tileLabel(cod, "Yopilmagan qarz")).toMatch(/5\s000\s000 so'm/));
  });

  it("⭐ status xaritasi yo'q (`mismatch: null`) — Nomuvofiqlik raqami UMUMAN chiqmaydi", () => {
    renderWithProviders(
      <ConnectionOverview
        connection={integration}
        metrics={metrics({ shipments: { total: 5, delivered: 5, failed: 0, mismatch: null } })}
        onFix={vi.fn()}
      />,
    );
    const shipments = screen.getByTestId("ovw-shipments");
    expect(within(shipments).queryByText("Nomuvofiqlik")).not.toBeInTheDocument();
    expect(tileLabels(shipments)).toHaveLength(3);
  });

  it("⭐ ESKI backend (bloklar yo'q) — raqamlar \"—\", hech qayerda 0 emas, sababi yozilgan", () => {
    // Qarz qoldig'i ham hali kelmagan — u ham "—" bo'lishi kerak.
    apiGetMock.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(
      <ConnectionOverview
        connection={integration}
        metrics={metrics({ shipments: null, webhooks: null, cod: null })}
        onFix={vi.fn()}
      />,
    );
    for (const id of ["ovw-shipments", "ovw-webhooks", "ovw-cod"]) {
      const block = screen.getByTestId(id);
      const names = tileLabels(block);
      expect(names.length, id).toBeGreaterThan(0);
      for (const name of names) {
        expect(name, `${id}: ${name}`).toMatch(/: —\./);
      }
      expect(within(block).getByText(/hali o'lchanmaydi/), id).toBeInTheDocument();
      expect(within(block).queryByText(/so'm/), id).not.toBeInTheDocument();
    }
  });

  it("⭐ hodisa YO'Q ulanishda o'ng ustun bo'sh emas — posilka va COD bloklari \"—\" bilan", () => {
    apiGetMock.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<ConnectionOverview connection={integration} metrics={undefined} onFix={vi.fn()} />);

    expect(screen.getByText("24 soatda hodisa bo'lmagan")).toBeInTheDocument();
    const shipments = screen.getByTestId("ovw-shipments");
    const cod = screen.getByTestId("ovw-cod");
    expect(tileLabel(shipments, "Jami")).toMatch(/^Jami: —\./);
    expect(tileLabel(cod, "Yopilmagan qarz")).toMatch(/^Yopilmagan qarz: —\./);
    expect(screen.getByTestId("ovw-webhooks")).toBeInTheDocument();
  });

  it("⭐ metrika YUKLANAYOTGANDA \"server bermayapti\" deyilmaydi; XATODA — yuklab bo'lmadi", () => {
    apiGetMock.mockImplementation(() => new Promise(() => {}));
    const { unmount } = renderWithProviders(
      <ConnectionOverview connection={integration} metrics={undefined} metricsState="loading" onFix={vi.fn()} />,
    );
    expect(screen.queryByText(/hali o'lchanmaydi/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Metrikani yuklab bo'lmadi/)).not.toBeInTheDocument();
    unmount();

    renderWithProviders(
      <ConnectionOverview connection={integration} metrics={undefined} metricsState="error" onFix={vi.fn()} />,
    );
    expect(screen.queryByText(/hali o'lchanmaydi/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Metrikani yuklab bo'lmadi/).length).toBeGreaterThan(0);
  });

  it("⭐ \"Yopilmagan qarz\" Hisob-kitob tabidagi raqam bilan AYNI (bitta manba)", async () => {
    renderWithProviders(
      <>
        <ConnectionOverview connection={integration} metrics={metrics()} onFix={vi.fn()} />
        <div data-testid="settlement-tab">
          <ConnectionSettlement connection={integration} />
        </div>
      </>,
    );
    const cod = screen.getByTestId("ovw-cod");
    await waitFor(() => expect(tileLabel(cod, "Yopilmagan qarz")).toMatch(/5\s000\s000 so'm/));
    const overviewDebt = /: (.+)\. /.exec(tileLabel(cod, "Yopilmagan qarz"))?.[1];
    expect(overviewDebt).toBeTruthy();

    // Bo'linmas probellar (uz-UZ raqam formati) ikkala tomonda bir xil normallashtiriladi.
    const norm = (text: string) => text.replace(/\s+/g, " ").trim();
    const settlement = screen.getByTestId("settlement-tab");
    await waitFor(() =>
      expect(
        within(settlement).getAllByText((_, el) => norm(el?.textContent ?? "") === norm(overviewDebt!)).length,
      ).toBeGreaterThan(0),
    );
    // Metrika endpointidagi boshqa `cod.debt` (999) hech qayerda chiqmaydi.
    expect(screen.queryByText(/999 so'm/)).not.toBeInTheDocument();
    // Ikkalasi AYNI endpointni o'qiydi.
    const balanceCalls = apiGetMock.mock.calls.filter(([url]) => String(url).includes("receivable-balance"));
    expect(new Set(balanceCalls.map(([url]) => url))).toEqual(new Set(["integrations/7/receivable-balance"]));
  });

  it("har raqam o'z TABIGA olib boradi (fixTab naqshi)", async () => {
    const onFix = vi.fn();
    renderWithProviders(<ConnectionOverview connection={integration} metrics={metrics()} onFix={onFix} />);

    // `fireEvent` — `userEvent` pointer-events uchun uslublarni o'qib, yuqoridagi
    // jsdom selektor xatosiga uriladi.
    fireEvent.click(tile(screen.getByTestId("ovw-shipments"), "Yiqilgan")!);
    expect(onFix).toHaveBeenLastCalledWith("shipments");
    fireEvent.click(tile(screen.getByTestId("ovw-webhooks"), "Imzo xato")!);
    expect(onFix).toHaveBeenLastCalledWith("log");
    fireEvent.click(tile(screen.getByTestId("ovw-cod"), "Yopilmagan qarz")!);
    expect(onFix).toHaveBeenLastCalledWith("settlement");
  });

  it("yashirin tab — uning bloki ham, havolasi ham chiqmaydi", () => {
    renderWithProviders(
      <ConnectionOverview
        connection={integration}
        metrics={metrics()}
        onFix={vi.fn()}
        hiddenTabs={new Set(["shipments", "settlement"])}
      />,
    );
    expect(screen.queryByTestId("ovw-shipments")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ovw-cod")).not.toBeInTheDocument();
    expect(screen.getByTestId("ovw-webhooks")).toBeInTheDocument();
    // Qarz qoldig'i ham so'ralmaydi — blok yo'q.
    expect(apiGetMock.mock.calls.some(([url]) => String(url).includes("receivable-balance"))).toBe(false);
  });

  it("hamkor: kiruvchi webhook va COD bloki yo'q (webhookni biz yuboramiz, daftar ularda)", () => {
    renderWithProviders(
      <ConnectionOverview
        connection={partner}
        metrics={metrics({ uid: "partner:2", kind: "partner", id: "2" })}
        onFix={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ovw-shipments")).toBeInTheDocument();
    expect(screen.queryByTestId("ovw-webhooks")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ovw-cod")).not.toBeInTheDocument();
  });
});

describe("ConnectionOverview — banner amallari", () => {
  beforeEach(() => {
    apiPostMock.mockReset();
    apiGetMock.mockReset();
    apiGetMock.mockImplementation(okGet);
  });

  /**
   * Dizayn v2: alohida «Tuzatish» banner tugmasi o'rniga yetishmagan majburiy qatorning o'zida aniq fe'lli
   * tugma (maket «Webhook manzilini kiritish»). Chuqur havola xulqi o'sha — tuzatiladigan tab ochiladi.
   */
  it("yetishmagan qatordagi tugma chuqur havola bo'lib qolgan («API manzilini kiritish» → Sozlamalar)", async () => {
    const onFix = vi.fn();
    const broken = { ...integration, raw: { slug: "elchi" } } as unknown as Connection;
    renderWithProviders(<ConnectionOverview connection={broken} metrics={metrics()} onFix={onFix} />);
    const checklist = screen.getByTestId("ovw-checklist");
    await userEvent.click(within(checklist).getByText("API manzilini kiritish").closest("button")!);
    expect(onFix).toHaveBeenCalledWith("settings");
  });

  it("\"Yangilash\" bosilganda onRefresh chaqiriladi", async () => {
    const onRefresh = vi.fn();
    renderWithProviders(
      <ConnectionOverview connection={integration} metrics={metrics()} onFix={vi.fn()} onRefresh={onRefresh} />,
    );
    await userEvent.click(bannerButton(/Yangilash/)!);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("⭐ \"Aloqani sinash\" — haqiqiy healthcheck, natija xabar bilan; `ok: false` xato deb ko'rsatiladi", async () => {
    // `notify` haqiqiy — xabar `UiHost` dagi `<Toaster />` da ham chiziladi.
    const success = vi.spyOn(notify, "success");
    const error = vi.spyOn(notify, "error");
    renderWithProviders(<ConnectionOverview connection={integration} metrics={metrics()} onFix={vi.fn()} />);
    const ping = bannerButton(/Aloqani sinash/)!;
    expect(ping).not.toBeNull();

    apiPostMock.mockResolvedValueOnce({ data: { statusCode: 200, data: { ok: true, status: 200 } } });
    await userEvent.click(ping);
    await waitFor(() => expect(success).toHaveBeenCalledWith("Aloqa bor — sayt javob berdi"));
    expect(await screen.findByText("Aloqa bor — sayt javob berdi")).toBeInTheDocument();
    expect(apiPostMock).toHaveBeenCalledWith("integrations/7/healthcheck", {});

    // Backend yiqilganda HTTP xato BERMAYDI — sababi `reason` bo'yicha o'zbekcha chiqadi.
    apiPostMock.mockResolvedValueOnce({
      data: { statusCode: 502, message: "x", data: { ok: false, status: 401, reason: "auth_rejected" } },
    });
    await userEvent.click(ping);
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("Aloqa o'rnatilmadi", {
        description: "Sayt kirish kalitini qabul qilmadi (HTTP 401).",
      }),
    );
    expect(success).toHaveBeenCalledTimes(1);

    // ⭐ Eski backend: ok:false + «integration healthcheck completed» — bu matn xato bo'lib CHIQMAYDI.
    apiPostMock.mockResolvedValueOnce({
      data: { statusCode: 200, message: "integration healthcheck completed", data: { ok: false, status: 404 } },
    });
    await userEvent.click(ping);
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("Aloqa o'rnatilmadi", { description: "Sayt HTTP 404 qaytardi" }),
    );
    expect(screen.queryByText(/healthcheck completed/)).toBeNull();
  });

  it("hamkorda \"Aloqani sinash\" yo'q (tashqi API yo'q), \"Yangilash\" bor", () => {
    renderWithProviders(
      <ConnectionOverview connection={partner} metrics={undefined} onFix={vi.fn()} onRefresh={vi.fn()} />,
    );
    expect(bannerButton(/Aloqani sinash/)).toBeNull();
    expect(bannerButton(/Yangilash/)).not.toBeNull();
  });
});

describe("ConnectionOverview — sayt (buyurtma manbasi)", () => {
  const site = (imported: unknown): Connection =>
    ({
      uid: "integration:3",
      kind: "integration",
      id: "3",
      name: "Lidershop",
      role: "source",
      category: "marketplace",
      is_active: true,
      subtitle: "",
      raw: {
        id: "3",
        slug: "lidershop",
        base_url: "https://api.lidershop.uz",
        auth_type: "login",
        market_id: "3949",
        is_active: true,
        imported_orders: imported,
      },
    }) as unknown as Connection;

  const hiddenTabs = new Set(["shipments", "settlement"]);

  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({ data: { data: null } });
  });

  it("⭐ olingan buyurtmalar ko'rinadi; posilka, webhook va o'lchanmagan foiz chizilmaydi", () => {
    renderWithProviders(
      <ConnectionOverview
        connection={site({ total: 49, today: 1, last_at: "2026-11-24T18:57:57.000Z" })}
        metrics={undefined}
        onFix={vi.fn()}
        hiddenTabs={hiddenTabs}
      />,
    );
    const block = screen.getByTestId("ovw-imports");
    expect(within(block).getByText("49 ta")).toBeInTheDocument();
    expect(within(block).getByText("Buyurtmalarni ko'rish").closest("a")).toHaveAttribute(
      "href",
      "/orders?orderMarketId=3949",
    );
    expect(screen.queryByTestId("ovw-shipments")).toBeNull();
    expect(screen.queryByTestId("ovw-webhooks")).toBeNull();
    expect(screen.queryByText("Muvaffaqiyat · 24 soat")).toBeNull();
    // Chalg'ituvchi yo'llanma yo'q.
    expect(screen.queryByText(/Navbatni hoziroq yuborish/)).toBeNull();
    expect(screen.queryByText(/hali ishlatilmagan bo'lishi mumkin/)).toBeNull();
  });

  it("son noma'lum (eski backend) — «—», 0 emas", () => {
    renderWithProviders(
      <ConnectionOverview connection={site(undefined)} metrics={undefined} onFix={vi.fn()} hiddenTabs={hiddenTabs} />,
    );
    const block = screen.getByTestId("ovw-imports");
    expect(within(block).queryByText("0 ta")).toBeNull();
    expect(within(block).getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});
