import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConnectionLog from "./ConnectionLog";
import { renderWithProviders } from "../../../test/test-utils";
import type { Connection } from "../useConnections";

/**
 * HODISALAR TABI — BITTA VAQTDA BITTA JADVAL.
 *
 * ⚠️ NIMA BUZILGAN EDI. Chiquvchi va kiruvchi jurnallar (to'lov tizimida
 * ustiga to'lovlar ro'yxati) BIRDAN, ustma-ust chizilardi. Bir ekranda
 * UCHTA "Yangilash" tugmasi, UCHTA filtr qatori va uchta jadval turardi:
 * operator qaysi filtr qaysi jadvalga tegishli ekanini taxmin qilardi.
 *
 * ⚠️ BITTA UMUMIY JADVALGA BIRLASHTIRILMADI — ataylab. Maydonlari umuman
 * boshqa (yetkazish urinishlari / sinxron qilingan buyurtma soni / to'lov
 * summasi); umumlashtirilgan ustunlar uchalasining ma'nosini yo'qotardi.
 */

const apiGetMock = vi.fn();

vi.mock("../../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiGetMock(...args),
  },
}));

const conn = (over: Partial<Connection> = {}): Connection =>
  ({
    uid: "integration:12",
    kind: "integration",
    id: "12",
    name: "Payme",
    role: "payment",
    category: "payment",
    is_active: true,
    subtitle: "",
    raw: { slug: "payme" },
    ...over,
  }) as Connection;

/** Ekranda nechta "Yangilash" tugmasi bor. */
const refreshCount = () =>
  Array.from(document.querySelectorAll("button")).filter((b) =>
    /Yangilash/i.test(b.textContent ?? ""),
  ).length;

/** Ko'rinish almashtirgichi — v2 `SegmentedControl` (`role="radiogroup"` → `radio`). */
const clickView = async (label: RegExp) => {
  const user = userEvent.setup();
  const group = await screen.findByRole("radiogroup", { name: "Jurnal ko'rinishi" });
  await user.click(within(group).getByRole("radio", { name: label }));
};

describe("Hodisalar tabi — ko'rinish almashtirgichi", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({ data: { data: { items: [], meta: {} } } });
  });

  it("⭐ EKRANDA BITTA 'Yangilash' bo'ladi", async () => {
    /**
     * Asosiy tekshiruv: ilgari uchta edi. Bu son bilvosita "bitta jadval"
     * ni ham isbotlaydi — har bir ko'rinish o'z tugmasini olib yuradi.
     */
    renderWithProviders(<ConnectionLog connection={conn()} />);
    await waitFor(() => expect(refreshCount()).toBe(1));
  });

  it("⭐ to'lov tizimida UCH ko'rinish taklif qiladi", async () => {
    renderWithProviders(<ConnectionLog connection={conn()} />);

    await waitFor(() => expect(screen.getByText(/Onlayn to'lovlar/)).toBeTruthy());
    expect(screen.getByText(/Kiruvchi webhooklar/)).toBeTruthy();
    expect(screen.getByText(/Sinxron tarixi/)).toBeTruthy();
  });

  it("⭐ to'lov BO'LMAGAN ulanishda pul ko'rinishi YO'Q", async () => {
    /**
     * Pul ro'yxati faqat to'lov rolida ma'noli. Boshqa rolda ko'rsatsak
     * operator bo'sh jadval ko'rib "buzuqmi?" deb o'ylardi.
     */
    renderWithProviders(
      <ConnectionLog connection={conn({ role: "carrier", category: "cargo" })} />,
    );

    await waitFor(() => expect(screen.getByText(/Kiruvchi webhooklar/)).toBeTruthy());
    expect(screen.queryByText(/Onlayn to'lovlar/)).toBeNull();
    // Almashtirgich baribir bitta "Yangilash" qoldiradi.
    expect(refreshCount()).toBe(1);
  });

  it("⭐ ko'rinish almashganda jadval ALMASHADI", async () => {
    renderWithProviders(<ConnectionLog connection={conn()} />);

    // Boshlanishda to'lovlar ko'rinishi — banner shundan bilinadi.
    await waitFor(() => expect(screen.getByText(/kassaga yozilmaydi/)).toBeTruthy());

    await clickView(/Sinxron tarixi/);

    await waitFor(() => expect(screen.queryByText(/kassaga yozilmaydi/)).toBeNull());
    // Almashgandan keyin ham bitta tugma.
    expect(refreshCount()).toBe(1);
  });

  it("hamkorda almashtirgich KO'RSATILMAYDI", async () => {
    /**
     * Hamkorda yagona ko'rinish bor (biz yuborgan hodisalar) — bitta
     * variantli almashtirgich shovqin bo'lardi.
     */
    renderWithProviders(
      <ConnectionLog connection={conn({ kind: "partner", uid: "partner:7", id: "7" })} />,
    );

    await waitFor(() => expect(refreshCount()).toBe(1));
    expect(screen.queryByText(/Sinxron tarixi/)).toBeNull();
    expect(screen.queryByText(/Kiruvchi webhooklar/)).toBeNull();
  });
});

describe("Kiruvchi webhooklar — \"Imzo xato\" pili (tokhPLMP)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({
      data: {
        data: {
          items: [],
          meta: { page: 1, limit: 20, total: 9, totalPages: 1 },
          counts: { all: 9, processed: 5, verified: 1, rejected: 3, invalid_signature: 2 },
        },
      },
    });
  });

  it("har pillda backend sanog'i; \"Imzo xato\" `invalid_signature=true` yuboradi (status emas)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionLog connection={conn({ kind: "integration", role: "carrier", category: "cargo" } as Partial<Connection>)} />);
    await clickView(/Kiruvchi webhooklar/);

    const pill = await screen.findByRole("button", { name: /Imzo xato\s*2/ });
    expect(screen.getByRole("button", { name: /Qo'llanildi\s*5/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rad etildi\s*3/ })).toBeInTheDocument();

    await user.click(pill);
    await waitFor(() => {
      const params = (apiGetMock.mock.calls.at(-1)?.[1] as { params: Record<string, unknown> }).params;
      expect(params).toMatchObject({ invalid_signature: "true" });
      expect(params).not.toHaveProperty("status");
    });
  });
});

/**
 * UMUMIY YETKAZISH JURNALI (Dj70iDbD) — eski `/integrations/partners` dan ko'chgan: «Barcha hamkorlar» filtri
 * va webhook ma'lumotini ko'rish. Sahifa o'chgan, shuning uchun bu imkoniyatlarni endi shu panel qo'riqlaydi.
 */
describe("Biz yuborgan hodisalar — umumiy jurnal (Dj70iDbD)", () => {
  const beePost = conn({ kind: "partner", uid: "partner:1", id: "1", name: "BeePost" });
  const baraka = conn({ kind: "partner", uid: "partner:2", id: "2", name: "Baraka Shop" });
  const metrics = { uid: "partner:1", kind: "partner", id: "1", events: 10, delivered: 9, failed: 1, queued: 0, success_rate: 90 } as never;

  const partnersResponse = {
    data: {
      statusCode: 200,
      data: [
        { id: "1", name: "BeePost", webhook_url: null, is_active: true, createdAt: "2026-09-10T00:00:00.000Z" },
        { id: "2", name: "Baraka Shop", webhook_url: null, is_active: true, createdAt: "2026-09-10T00:00:00.000Z" },
      ],
    },
  };
  const row = (id: string, partner_id: string, over: Record<string, unknown> = {}) => ({
    id,
    partner_id,
    order_id: `10${id}`,
    external_order_id: `EX-${id}`,
    event_type: "order.status_changed",
    new_status: "sold",
    status: "permanently_failed",
    attempts: 8,
    max_attempts: 8,
    last_error: "HTTP 500",
    next_retry_at: null,
    delivered_at: null,
    created_at: "2026-09-15T10:00:00.000Z",
    payload: { event: "order.status_changed", external_order_id: `EX-${id}` },
    ...over,
  });
  const journal = (rows: unknown[], total = rows.length) => ({
    data: { statusCode: 200, data: { data: rows, total, page: 1, limit: 20, totalPages: 1 } },
  });
  const mockApi = (webhooks: () => Promise<unknown>) =>
    apiGetMock.mockImplementation((url: string) => {
      if (url === "admin/partners/webhooks") return webhooks();
      if (url === "admin/partners") return Promise.resolve(partnersResponse);
      return Promise.resolve({ data: { statusCode: 200, data: {} } });
    });
  /** `admin/partners/webhooks` so'rovlarining parametrlari, tartib bilan. */
  const journalParams = () =>
    apiGetMock.mock.calls.filter(([url]) => url === "admin/partners/webhooks").map(([, options]) => options.params);
  const pickPartner = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(await screen.findByRole("combobox", { name: "Hamkor bo'yicha filtr" }));
    await user.click(await screen.findByRole("option", { name }));
  };

  beforeEach(() => apiGetMock.mockReset());

  it("⭐ sukut — ochiq hamkor: so'rovda `partner_id`, «Hamkor» ustuni yo'q, metrika bor", async () => {
    mockApi(() => Promise.resolve(journal([row("1", "1")])));
    renderWithProviders(<ConnectionLog connection={beePost} metrics={metrics} />);

    expect((await screen.findAllByText("EX-1")).length).toBeGreaterThan(0);
    expect(journalParams().at(-1)).toMatchObject({ partner_id: "1", status: "all", page: 1 });
    expect(screen.queryByRole("columnheader", { name: "Hamkor" })).toBeNull();
    expect(screen.getByText("Natija · 24 soat")).toBeInTheDocument();
  });

  it("⭐ «Barcha hamkorlar»: `partner_id` ketmaydi, qatorda hamkor nomi, metrika yashiriladi", async () => {
    const user = userEvent.setup();
    mockApi(() => Promise.resolve(journal([row("1", "1"), row("2", "2")])));
    renderWithProviders(<ConnectionLog connection={beePost} metrics={metrics} />);

    await pickPartner(user, "Barcha hamkorlar");

    expect(await screen.findByRole("columnheader", { name: "Hamkor" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("BeePost")).toBeInTheDocument();
    expect(within(table).getByText("Baraka Shop")).toBeInTheDocument();
    await waitFor(() => expect(journalParams().at(-1)).toEqual({ partner_id: undefined, status: "all", page: 1, limit: 20 }));
    // Metrika ochiq hamkorniki — umumiy jurnal yonida noto'g'ri raqam bo'lardi.
    expect(screen.queryByText("Natija · 24 soat")).toBeNull();
  });

  it("boshqa hamkor tanlansa — so'rov o'sha hamkorga, qaytganda metrika yana chiqadi", async () => {
    const user = userEvent.setup();
    mockApi(() => Promise.resolve(journal([row("2", "2")])));
    renderWithProviders(<ConnectionLog connection={beePost} metrics={metrics} />);

    await pickPartner(user, "Baraka Shop");
    await waitFor(() => expect(journalParams().at(-1)).toMatchObject({ partner_id: "2" }));
    expect(screen.queryByText("Natija · 24 soat")).toBeNull();

    await pickPartner(user, "BeePost");
    await waitFor(() => expect(journalParams().at(-1)).toMatchObject({ partner_id: "1" }));
    expect(await screen.findByText("Natija · 24 soat")).toBeInTheDocument();
  });

  it("⭐ filtr almashganda sahifa boshiga qaytadi", async () => {
    const user = userEvent.setup();
    mockApi(() => Promise.resolve(journal([row("1", "1")], 45)));
    renderWithProviders(<ConnectionLog connection={beePost} />);

    await user.click(await screen.findByRole("button", { name: "Keyingi sahifa" }));
    await waitFor(() => expect(journalParams().at(-1)).toMatchObject({ partner_id: "1", page: 2 }));

    await pickPartner(user, "Barcha hamkorlar");
    await waitFor(() => expect(journalParams().at(-1)).toMatchObject({ partner_id: undefined, page: 1 }));
  });

  it("⭐ boshqa hamkor ochilganda filtr oldingi hamkordan qolmaydi", async () => {
    const user = userEvent.setup();
    mockApi(() => Promise.resolve(journal([row("1", "1")])));
    /** Konsol ro'yxatidagi tanlov: bitta panel, ulanish almashadi. */
    const Console = () => {
      const [connection, setConnection] = useState(beePost);
      return (
        <>
          <button type="button" onClick={() => setConnection(baraka)}>
            Baraka Shop ni ochish
          </button>
          <ConnectionLog connection={connection} />
        </>
      );
    };
    renderWithProviders(<Console />);

    await pickPartner(user, "Barcha hamkorlar");
    await waitFor(() => expect(journalParams().at(-1)).toMatchObject({ partner_id: undefined }));

    await user.click(screen.getByRole("button", { name: "Baraka Shop ni ochish" }));
    await waitFor(() => expect(journalParams().at(-1)).toMatchObject({ partner_id: "2" }));
    expect(screen.queryByRole("columnheader", { name: "Hamkor" })).toBeNull();
  });

  it("⭐ webhook ma'lumoti ochiladi va yopiladi; yiqilganda necha urinishda to'xtagani yoziladi", async () => {
    const user = userEvent.setup();
    mockApi(() => Promise.resolve(journal([row("1", "1")])));
    renderWithProviders(<ConnectionLog connection={beePost} />);

    const toggle = await screen.findByRole("button", { name: "№101 — webhook ma'lumotini ko'rish" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Webhook ma'lumoti")).toBeInTheDocument();
    expect(screen.getByText("8 urinishdan keyin to'xtatildi")).toBeInTheDocument();
    expect(document.getElementById("partner-payload-1")).toHaveTextContent('"external_order_id": "EX-1"');

    await user.click(toggle);
    expect(screen.queryByText("Webhook ma'lumoti")).toBeNull();
  });

  it("yetkazilmagan hodisani qayta navbatga qo'yadi", async () => {
    const user = userEvent.setup();
    mockApi(() => Promise.resolve(journal([row("1", "1")])));
    renderWithProviders(<ConnectionLog connection={beePost} />);

    // Matnli va ikonka tugma ikkalasi DOM'da, kenglikka qarab bittasi ko'rinadi (jsdom'da CSS yo'q).
    const [retry] = await screen.findAllByRole("button", { name: "№101 hodisasini qayta yuborish" });
    await user.click(retry);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith("admin/partners/webhooks/1/retry"));
  });

  it("sahifalash ko'p yozuvda chiqadi", async () => {
    mockApi(() => Promise.resolve(journal([row("1", "1")], 45)));
    renderWithProviders(<ConnectionLog connection={beePost} />);

    expect(await screen.findByRole("navigation", { name: /sahifa/i })).toBeInTheDocument();
  });

  it("⭐ xato «yozuv yo'q» deb ko'rsatilmaydi, bo'sh jurnal esa xato deb ko'rsatilmaydi", async () => {
    mockApi(() => Promise.reject(new Error("500")));
    const failed = renderWithProviders(<ConnectionLog connection={beePost} />);
    expect(await screen.findByText("Jurnalni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText("Hali yuborilgan hodisa yo'q")).toBeNull();
    failed.unmount();

    mockApi(() => Promise.resolve(journal([])));
    renderWithProviders(<ConnectionLog connection={beePost} />);
    expect(await screen.findByText("Hali yuborilgan hodisa yo'q")).toBeInTheDocument();
    expect(screen.queryByText("Jurnalni yuklab bo'lmadi")).toBeNull();
  });
});
