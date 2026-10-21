import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AiStatusCard } from "./AiStatusCard";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import { expectNoRawBackendText, mockEnvelope, mockRejection } from "../../../test/mockEnvelope";

const apiGetMock = vi.fn();

vi.mock("../../../shared/api/api", () => ({
  api: { get: (...a: unknown[]) => apiGetMock(...a) },
}));

/** api-gateway `GET ai/status` konverti (backend `origin/main`, `successRes(AiStatusResponse)`). */
const statusBody = (patch: Record<string, unknown> = {}, capPatch: Record<string, unknown> = {}) => ({
  enabled: true,
  key_state: "ok",
  models: { order: "claude-sonnet-5", vision: "claude-sonnet-5", classify: "claude-haiku-4-5" },
  model_policy: { ok: true, order: "ok", vision: "ok", classify: "ok" },
  cap: {
    period_key: "2026-10-21",
    spent_usd: 5.82,
    cap_usd: 25,
    override_usd: 0,
    effective_cap_usd: 25,
    ratio: 0.2328,
    state: "ok",
    reset_at: "2026-10-21T19:00:00.000Z",
    ...capPatch,
  },
  usage_persist_failures: 0,
  ...patch,
});

/** `GET orders/ai-availability` — gateway bayrog'i (`AI_ORDER_ENABLED`) + kesh holati. */
const availability = (enabled: boolean, state = enabled ? "enabled" : "disabled") =>
  mockEnvelope({ enabled, state });

const mockApi = ({
  status = () => Promise.resolve(mockEnvelope(statusBody())),
  flag = () => Promise.resolve(availability(true)),
}: { status?: () => Promise<unknown>; flag?: () => Promise<unknown> } = {}) => {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "ai/status") return status();
    if (url === "orders/ai-availability") return flag();
    return Promise.reject(mockRejection(404));
  });
};

const card = () => screen.getByRole("region", { name: "AI holati" });
const settings = () => within(card()).getByRole("list", { name: "AI kaliti va modellar" });

describe("AiStatusCard (OS-2)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    mockApi();
  });

  afterEach(async () => {
    await i18n.changeLanguage("uz");
  });

  it("⭐ yoqilgan (maket `superadmin-ops-system`): badge, kalit (qiymatsiz), 3 model, limit «5,82 $ / 25,00 $ · 23%»", async () => {
    renderWithProviders(<AiStatusCard />);
    expect(await within(card()).findByText("5,82 $ / 25,00 $ · 23%")).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith("ai/status");
    expect(within(card()).getByText("Yoqilgan")).toBeInTheDocument();
    expect(within(card()).getByText("AI bilan buyurtma yaratish: kalit, modellar va kunlik limit")).toBeInTheDocument();

    const tiles = within(settings()).getAllByRole("listitem");
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toHaveTextContent("API kaliti");
    expect(tiles[0]).toHaveTextContent("Anthropic");
    expect(tiles[0]).toHaveTextContent("Sozlangan");
    expect(tiles[0]).toHaveTextContent("Kalit qiymati hech qachon ko'rsatilmaydi");
    expect(tiles[1]).toHaveTextContent("Buyurtma ajratish (matn)claude-sonnet-5MosAI_ORDER_MODEL");
    expect(tiles[2]).toHaveTextContent("Buyurtma ajratish (rasm)claude-sonnet-5MosAI_ORDER_VISION_MODEL");
    expect(tiles[3]).toHaveTextContent("AI_CLASSIFY_MODEL · arzon model yetarli");

    const meter = within(card()).getByRole("meter", { name: "Bugungi AI limiti: 5,82 $ sarflandi, 25,00 $ dan 23%" });
    expect(meter).toHaveAttribute("aria-valuenow", "23");
    expect(within(card()).getByText("Ertaga, 00:00 da yangilanadi (Toshkent vaqti)")).toBeInTheDocument();
    expect(within(card()).getByText("Xarajat jurnaliga yozilmagan chaqiruvlar:")).toBeInTheDocument();
    expect(within(card()).getByText("0 ta")).toBeInTheDocument();
    // S2: limitni oshirish faqat serverda — kartada amal tugmasi yo'q.
    expect(within(card()).queryAllByRole("button")).toHaveLength(0);
    expect(within(card()).queryByRole("alert")).toBeNull();
  });

  it("⭐ S2 limit tugadi (maket `-ai-cap`): «Limit tugadi», danger ogohlantirish, «faqat serverda oshiriladi», tugma yo'q", async () => {
    mockApi({ status: () => Promise.resolve(mockEnvelope(statusBody({}, { spent_usd: 25, ratio: 1, state: "exceeded" }))) });
    renderWithProviders(<AiStatusCard />);
    const alert = await within(card()).findByRole("alert");
    expect(alert).toHaveTextContent("Kunlik limit tugadi — AI ertaga 00:00 gacha o'chiq");
    expect(alert).toHaveTextContent(
      "Bugungi 25,00 $ to'liq sarflandi. Buyurtma yaratishda «AI bilan» tabida «AI kunlik limiti tugadi» xabari chiqadi, buyurtmalar qo'lda kiritiladi.",
    );
    expect(within(card()).getAllByText("Limit tugadi")).toHaveLength(2);
    expect(within(card()).getByText("25,00 $ / 25,00 $ · 100%")).toBeInTheDocument();
    expect(
      within(card()).getByText("AI ertaga, 00:00 da qayta yoqiladi (Toshkent vaqti) · limit faqat serverda oshiriladi"),
    ).toBeInTheDocument();
    expect(within(card()).getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
    expect(within(card()).queryAllByRole("button")).toHaveLength(0);
  });

  it("⭐ S3 kalit nomi noto'g'ri + noma'lum model (maket `-ai-config`): «AI o'chiq», «Noma'lum model», limit hisoblanmaydi", async () => {
    mockApi({
      status: () =>
        Promise.resolve(
          mockEnvelope(
            statusBody(
              {
                enabled: false,
                key_state: "misnamed",
                models: { order: "claude-sonnet-5", vision: "claude-sonet-5", classify: "claude-haiku-4-5" },
                model_policy: { ok: false, order: "ok", vision: "unknown", classify: "ok" },
              },
              { spent_usd: 0, ratio: 0 },
            ),
          ),
        ),
    });
    renderWithProviders(<AiStatusCard />);
    expect(await within(card()).findByText("AI o'chiq — kalit nomi noto'g'ri")).toBeInTheDocument();
    expect(within(card()).getByText("AI o'chiq")).toBeInTheDocument();
    expect(within(card()).getAllByText("Noma'lum model")).toHaveLength(2);

    const status = within(card()).getByRole("status");
    expect(status).toHaveTextContent(
      "Kalit serverda boshqa nom bilan berilgan, shuning uchun AI uni ko'rmaydi. Kalit ANTHROPIC_API_KEY nomi bilan berilishi kerak.",
    );
    const alert = within(card()).getByRole("alert");
    expect(alert).toHaveTextContent("Noma'lum model: rasmdan buyurtma ajratish");
    expect(alert).toHaveTextContent(
      "claude-sonet-5 nomi narx jadvalida yo'q — nomi xato yozilgan bo'lishi mumkin. AI yoqilganda bu chaqiruvlar xato beradi. Model nomini serverdagi sozlamada tekshiring.",
    );
    expect(within(alert).getByText("claude-sonet-5").tagName).toBe("STRONG");

    const tiles = within(settings()).getAllByRole("listitem");
    expect(tiles[0]).toHaveTextContent("Kalit nomi noto'g'ri");
    expect(tiles[0]).toHaveTextContent("ANTHROPIC_API_KEY nomi bilan berilishi kerak");
    expect(tiles[0]).toHaveAttribute("data-problem", "true");
    expect(tiles[2]).toHaveTextContent("AI_ORDER_VISION_MODEL · narx jadvalida yo'q");
    expect(tiles[2]).toHaveAttribute("data-problem", "true");
    expect(tiles[1]).not.toHaveAttribute("data-problem");

    expect(within(card()).getByText("0,00 $ / 25,00 $ · 0%")).toBeInTheDocument();
    expect(within(card()).getByText("AI o'chiq — bugun sarflanmagan, limit hisoblanmaydi")).toBeInTheDocument();
    expect(within(card()).queryByRole("meter")).toBeNull();
  });

  it("kalit sozlanmagan (maket `-error`): «AI o'chiq — kalit sozlanmagan», «Kalit yo'q»", async () => {
    mockApi({
      status: () => Promise.resolve(mockEnvelope(statusBody({ enabled: false, key_state: "missing" }, { spent_usd: 0, ratio: 0 }))),
    });
    renderWithProviders(<AiStatusCard />);
    expect(await within(card()).findByText("AI o'chiq — kalit sozlanmagan")).toBeInTheDocument();
    expect(within(card()).getByRole("status")).toHaveTextContent(
      "Buyurtma yaratishda «AI bilan» tabi ko'rinmaydi, buyurtmalar qo'lda yaratilaveradi. Yoqish uchun serverdagi sozlamaga ANTHROPIC_API_KEY qo'shing.",
    );
    const tiles = within(settings()).getAllByRole("listitem");
    expect(tiles[0]).toHaveTextContent("Kalit yo'q");
    expect(tiles[0]).toHaveTextContent("ANTHROPIC_API_KEY serverda berilmagan");
  });

  it("⭐ gateway bayrog'i o'chiq (`orders/ai-availability.enabled: false`) — «AI o'chiq» (maket yo'q — eng yaqini `-error`)", async () => {
    mockApi({ flag: () => Promise.resolve(availability(false)) });
    renderWithProviders(<AiStatusCard />);
    expect(await within(card()).findByText("AI o'chiq — serverda o'chirib qo'yilgan")).toBeInTheDocument();
    expect(within(card()).getByText("AI o'chiq")).toBeInTheDocument();
    expect(within(card()).queryByText("Yoqilgan")).toBeNull();
    expect(within(card()).getByRole("status")).toHaveTextContent("AI_ORDER_ENABLED");
    // Bugun sarflangan — «limit hisoblanmaydi» (sarflanmagan deb yozilmaydi), o'lchagich yo'q.
    expect(within(card()).getByText("AI o'chiq — limit hisoblanmaydi")).toBeInTheDocument();
    expect(within(card()).queryByRole("meter")).toBeNull();
  });

  it("bayroq so'rovi yiqilsa — hisobga olinmaydi (holat `ai/status` dan)", async () => {
    mockApi({ flag: () => Promise.reject(mockRejection(403)) });
    renderWithProviders(<AiStatusCard />);
    expect(await within(card()).findByText("Yoqilgan")).toBeInTheDocument();
    expectNoRawBackendText();
  });

  it("⭐ zaif model + 80% + qo'shimcha limit + yozilmagan chaqiruvlar (maket `-partial`)", async () => {
    mockApi({
      status: () =>
        Promise.resolve(
          mockEnvelope(
            statusBody(
              {
                models: { order: "claude-sonnet-4-6", vision: "claude-sonnet-5", classify: "claude-haiku-4-5" },
                model_policy: { ok: false, order: "weak", vision: "ok", classify: "ok" },
                usage_persist_failures: 3,
              },
              { spent_usd: 29.4, override_usd: 10, effective_cap_usd: 35, ratio: 0.84, state: "warn" },
            ),
          ),
        ),
    });
    renderWithProviders(<AiStatusCard />);
    const alert = await within(card()).findByRole("alert");
    expect(within(card()).getByText("Yoqilgan")).toBeInTheDocument();
    expect(within(card()).getAllByText("Zaif model")).toHaveLength(2);
    expect(alert).toHaveTextContent("Zaif model: buyurtma ajratish sifati tushadi");
    expect(alert).toHaveTextContent(
      "Matndan buyurtma ajratish uchun claude-sonnet-4-6 tanlangan — bu ish uchun kuchsiz. Tumandan viloyatni topish va narxni hisoblash xato chiqishi mumkin. Serverdagi sozlamada kuchliroq modelga almashtiring — AI shu paytgacha ishlayveradi.",
    );
    expect(within(card()).getByText("80% dan oshdi")).toBeInTheDocument();
    expect(within(card()).getByText("29,40 $ / 35,00 $ · 84%")).toBeInTheDocument();
    expect(
      within(card()).getByText("Asosiy limit 25,00 $ · bugun uchun +10,00 $ oshirilgan · Ertaga, 00:00 da 25,00 $ ga qaytadi"),
    ).toBeInTheDocument();
    expect(within(card()).getByText("3 ta")).toBeInTheDocument();
  });

  it("limit holatini o'qib bo'lmadi (`cap.state: unknown`) — «Noma'lum», ogohlantirish, summa va o'lchagich yo'q", async () => {
    mockApi({ status: () => Promise.resolve(mockEnvelope(statusBody({}, { spent_usd: 0, ratio: 0, state: "unknown" }))) });
    renderWithProviders(<AiStatusCard />);
    expect(await within(card()).findByText("Kunlik limit holatini o'qib bo'lmadi")).toBeInTheDocument();
    expect(within(card()).getAllByText("Noma'lum")).toHaveLength(2);
    expect(within(card()).getByText("Bugungi xarajatni o'qib bo'lmadi")).toBeInTheDocument();
    expect(within(card()).queryByText(/\$ \//)).toBeNull();
    expect(within(card()).queryByRole("meter")).toBeNull();
  });

  it("⭐ xato 504 (maket `-down`): ichki ogohlantirish «(504)», «Qayta urinish» — tiklanadi, fokus kartada", async () => {
    let calls = 0;
    mockApi({
      status: () => {
        calls += 1;
        return calls <= 1 ? Promise.reject(mockRejection(504)) : Promise.resolve(mockEnvelope(statusBody()));
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<AiStatusCard />);
    const alert = await within(card()).findByRole("alert", {}, { timeout: 5000 });
    expect(alert).toHaveTextContent("AI holatini olib bo'lmadi");
    expect(alert).toHaveTextContent("AI xizmati javob bermadi (504). Tizim holatida «AI buyurtma» qatorini tekshiring.");
    expect(within(card()).getByText("Noma'lum")).toBeInTheDocument();
    expectNoRawBackendText();

    await user.click(within(alert).getByRole("button", { name: "Qayta urinish" }));
    expect(await within(card()).findByText("Yoqilgan")).toBeInTheDocument();
    await waitFor(() => expect(card()).toHaveFocus());
  });

  it("⭐ boshqa xato (403 / ulanmagan, maket `-critical`): bo'sh holat, xom matn yo'q", async () => {
    mockApi({ status: () => Promise.reject(mockRejection(403)) });
    renderWithProviders(<AiStatusCard />);
    const alert = await within(card()).findByRole("alert");
    expect(alert).toHaveTextContent("AI holatini olib bo'lmadi");
    expect(alert).toHaveTextContent("AI xizmati ulanmagan yoki javob bermadi. Buyurtmalar qo'lda yaratilaveradi.");
    expect(within(alert).getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    expectNoRawBackendText();
  });

  it("javob shakli buzuq (konvert ichida `models` yo'q) — xato holati", async () => {
    mockApi({ status: () => Promise.resolve(mockEnvelope({ enabled: true })) });
    renderWithProviders(<AiStatusCard />);
    expect(await within(card()).findByText("AI holatini olib bo'lmadi")).toBeInTheDocument();
  });

  it("yuklanish (maket `-loading`): skelet, «AI holati tekshirilmoqda», aria-busy", () => {
    mockApi({ status: () => new Promise(() => undefined) });
    renderWithProviders(<AiStatusCard />);
    expect(card()).toHaveAttribute("aria-busy", "true");
    expect(within(card()).getByRole("status", { name: "AI holati tekshirilmoqda" })).toBeInTheDocument();
  });

  it("ru / en: dollar formati («12,40 $» / «$12.40»), matnlar tarjima qilingan", async () => {
    await i18n.changeLanguage("ru");
    const { unmount } = renderWithProviders(<AiStatusCard />);
    const ruCard = await screen.findByRole("region", { name: "Состояние AI" });
    // ru foizi — bo'linmas bo'sh joy bilan («23 %»; Testing Library normalizatori uni oddiy bo'sh joyga aylantiradi).
    expect(await within(ruCard).findByText("5,82 $ / 25,00 $ · 23 %")).toBeInTheDocument();
    expect(within(ruCard).getByRole("meter").getAttribute("aria-label")).toContain("23\u00a0%");
    expect(within(ruCard).getByText("Включён")).toBeInTheDocument();
    unmount();

    await i18n.changeLanguage("en");
    renderWithProviders(<AiStatusCard />);
    const enCard = await screen.findByRole("region", { name: "AI status" });
    expect(await within(enCard).findByText("$5.82 / $25.00 · 23%")).toBeInTheDocument();
    expect(within(enCard).getByText("Enabled")).toBeInTheDocument();
  });
});
