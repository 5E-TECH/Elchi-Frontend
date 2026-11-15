import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiAdvisorSettings } from "../../../entities/ai-advisor";
import { queryKeys } from "../../../shared/config/queryKeys";
import { advisorEnvelope, advisorHttpError, createAdvisorFixtures } from "../../../test/aiAdvisorFixtures";
import { renderWithProviders } from "../../../test/test-utils";
import { RulesSettingsDialog } from "./RulesSettingsDialog";

/**
 * Qoidalar sozlamasi oynasi (maket `superadmin-ai-assistant-settings-rules-dialog` + «Boshqa holatlar», tasdiq —
 * `-settings-confirm`; D3): faqat «Qoidalar» (ichki tablar yo'q), 8 qoida — nom, izoh, kalit, chegaralar; «Avval: …»
 * ko'rsatmasi; mijoz tekshiruvi; tasdiq (o'zgarishlar «eski → yangi») → PATCH (`version` + o'zgarganlar — `severity` /
 * `telegram` yo'q) → toast; server `INVALID_RULE` — maydonda; 409 — qayta o'qish + info izoh; boshqa xato — danger.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const fx = createAdvisorFixtures();
let serverSettings: AiAdvisorSettings;

beforeEach(() => {
  serverSettings = structuredClone(fx.settings);
  mocks.get.mockImplementation((url: string) =>
    url === "ai/advisor/settings"
      ? Promise.resolve({ data: advisorEnvelope(serverSettings) })
      : Promise.reject(new Error(`kutilmagan GET ${url}`)),
  );
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const renderDialog = ({ open = true }: { open?: boolean } = {}) => {
  const onClose = vi.fn();
  const result = renderWithProviders(<RulesSettingsDialog open={open} onClose={onClose} />, { route: "/ai-assistant" });
  result.queryClient.setQueryData(queryKeys.aiAdvisor.settings, { kind: "available", data: fx.settings });
  return { ...result, onClose };
};

const findDialog = () => screen.findByRole("dialog", { name: "AI yordamchi sozlamalari" });
const settingsCalls = () => mocks.get.mock.calls.filter(([url]) => url === "ai/advisor/settings");
const field = (name: string) => screen.getByRole("textbox", { name });
const ruleSwitch = (name: string) => screen.getByRole("switch", { name });

describe("Qoidalar sozlamasi — ko'rinish", () => {
  it("sarlavha, izoh, faqat «Qoidalar» (ichki tablar yo'q), 8 qoida, chegaralar, R8 ratio yo'q; ochilganda qayta o'qiladi", async () => {
    renderDialog();
    const panel = await findDialog();
    expect(within(panel).getByText("Faqat superadmin · har o'zgarish faoliyat jurnaliga yoziladi")).toBeInTheDocument();
    expect(within(panel).getByText(/^Qoidalar AI'siz ishlaydi: har 30 daqiqada/)).toBeInTheDocument();
    expect(within(panel).queryByRole("tablist")).toBeNull();
    expect(within(panel).queryByText(/Budjet|Bilim bazasi|Hisobotlar/)).toBeNull();

    const switches = within(panel).getAllByRole("switch");
    expect(switches.map((node) => node.getAttribute("aria-checked"))).toEqual(Array(8).fill("true"));
    expect(ruleSwitch("Smena kamomadi")).toHaveAccessibleDescription(
      "Smenadagi kamomad chegaradan katta yoki bir kassada ketma-ket manfiy smenalar",
    );
    expect(ruleSwitch("Tuzatishlar ko'paydi")).toHaveAccessibleDescription("Tuzatishlar 30 kunlik o'rtachadan 2 barobar ko'p");

    // 9 maydon: R1 ×2, R2 ×3, R3, R4, R5 ×2; R6–R8 — faqat kalit.
    expect(within(panel).getAllByRole("textbox")).toHaveLength(9);
    expect(field("Bir smenadagi kamomad")).toHaveValue("50 000");
    expect(field("Ketma-ket manfiy smenalar")).toHaveValue("3");
    expect(field("Qarz chegarasi")).toHaveValue("2 000 000");
    expect(field("Odatdagidan oshish")).toHaveValue("3");
    expect(field("To'lovsiz kunlar")).toHaveValue("7");
    expect(field("Filial kassasi")).toHaveValue("5 000 000");
    expect(screen.queryByRole("textbox", { name: "Nisbat" })).toBeNull();
    expect(within(panel).getByText("Mediana + 3 × mediana og'ishi")).toBeInTheDocument();
    expect(within(panel).getByText("Qarz bo'lsa")).toBeInTheDocument();

    await waitFor(() => expect(settingsCalls()).toHaveLength(1));
  });

  it("o'zgartirilgan maydon — «Avval: …», R3 izohi joriy qiymat bilan, kalit — « · avval yoqilgan edi»", async () => {
    const user = userEvent.setup();
    renderDialog();
    await findDialog();

    await user.clear(field("Bir smenadagi kamomad"));
    await user.type(field("Bir smenadagi kamomad"), "30000");
    expect(field("Bir smenadagi kamomad")).toHaveValue("30 000");
    expect(field("Bir smenadagi kamomad")).toHaveAccessibleDescription("Avval: 50 000 so'm");

    await user.clear(field("Odatdagidan oshish"));
    await user.type(field("Odatdagidan oshish"), "2,5");
    expect(field("Odatdagidan oshish")).toHaveAccessibleDescription("Mediana + 2,5 × mediana og'ishi · avval 3 ×");

    await user.clear(field("To'lovsiz kunlar"));
    await user.type(field("To'lovsiz kunlar"), "10");
    expect(field("To'lovsiz kunlar")).toHaveAccessibleDescription("Qarz bo'lsa · avval 7 kun");

    await user.click(ruleSwitch("Tuzatishlar ko'paydi"));
    expect(ruleSwitch("Tuzatishlar ko'paydi")).toHaveAttribute("aria-checked", "false");
    expect(ruleSwitch("Tuzatishlar ko'paydi")).toHaveAccessibleDescription(
      "Tuzatishlar 30 kunlik o'rtachadan 2 barobar ko'p · avval yoqilgan edi",
    );
  });
});

describe("Qoidalar sozlamasi — saqlash", () => {
  it("⭐ tasdiq (o'zgarishlar ro'yxati, izoh) → PATCH {version, rules} (severity / telegram yo'q) → toast, oyna yopiladi", async () => {
    const user = userEvent.setup();
    mocks.patch.mockImplementation((_url: string, body: { rules: Record<string, Record<string, unknown>> }) => {
      const next = structuredClone(serverSettings);
      for (const [rule, patch] of Object.entries(body.rules)) Object.assign(next.rules[rule as "R1"], patch);
      return Promise.resolve({ data: advisorEnvelope({ ...next, version: 5 }) });
    });
    const { onClose, queryClient } = renderDialog();
    await findDialog();

    await user.clear(field("Bir smenadagi kamomad"));
    await user.type(field("Bir smenadagi kamomad"), "30000");
    await user.click(ruleSwitch("Tuzatishlar ko'paydi"));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    const confirm = await screen.findByRole("alertdialog", { name: "Sozlamalarni saqlaysizmi?" });
    expect(within(confirm).getByText("2 ta o'zgarish · faoliyat jurnaliga yoziladi")).toBeInTheDocument();
    expect(within(confirm).getAllByRole("term").map((node) => node.textContent)).toEqual([
      "Smena kamomadi · Bir smenadagi kamomad",
      "Tuzatishlar ko'paydi",
    ]);
    expect(within(confirm).getAllByRole("definition").map((node) => node.textContent)).toEqual([
      "50 000 yangi qiymat: 30 000 so'm",
      "Yoqilgan yangi qiymat: O'chirilgan",
    ]);
    expect(within(confirm).getByText("O'chirilgan qoida bo'yicha ogohlantirish chiqmaydi.")).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.patch).toHaveBeenCalledWith(
      "ai/advisor/settings",
      { version: 4, rules: { R1: { shortage_uzs: 30_000 }, R8: { enabled: false } } },
      expect.anything(),
    );
    expect(JSON.stringify(mocks.patch.mock.calls[0][1])).not.toMatch(/severity|telegram|budget|schedule/);
    expect(await screen.findByText("Sozlamalar saqlandi")).toBeInTheDocument();
    expect(screen.getByText("Qoidalar keyingi tekshiruvdan qo'llanadi")).toBeInTheDocument();
    expect(queryClient.getQueryData(queryKeys.aiAdvisor.settings)).toMatchObject({ kind: "available", data: { version: 5 } });
  });

  it("«Orqaga» — PATCH ketmaydi, oyna ochiq, o'zgarishlar joyida", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await findDialog();
    await user.click(ruleSwitch("Zarar"));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Sozlamalarni saqlaysizmi?" });
    expect(within(confirm).getByText("1 ta o'zgarish · faoliyat jurnaliga yoziladi")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(ruleSwitch("Zarar")).toHaveAttribute("aria-checked", "false");
  });

  it("o'zgarish yo'q — tasdiqsiz yopiladi", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await findDialog();
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("noto'g'ri qiymat (maket «Boshqa holatlar») — maydonda xato, fokus, tasdiq va PATCH yo'q; yozilganda xato ketadi", async () => {
    const user = userEvent.setup();
    renderDialog();
    await findDialog();
    await user.clear(field("Ketma-ket manfiy smenalar"));
    await user.type(field("Ketma-ket manfiy smenalar"), "0");
    await user.clear(field("Filial kassasi"));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(field("Ketma-ket manfiy smenalar")).toHaveAttribute("aria-invalid", "true");
    expect(field("Ketma-ket manfiy smenalar")).toHaveAccessibleDescription("1 dan katta son kiriting");
    expect(field("Filial kassasi")).toHaveAccessibleDescription("Qiymat kiriting");
    expect(field("Ketma-ket manfiy smenalar")).toHaveFocus();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(mocks.patch).not.toHaveBeenCalled();

    await user.type(field("Ketma-ket manfiy smenalar"), "4");
    expect(field("Ketma-ket manfiy smenalar")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("server INVALID_RULE {field, min, max} — o'sha maydonda xato va fokus, oyna ochiq", async () => {
    const user = userEvent.setup();
    mocks.patch.mockRejectedValue(advisorHttpError(400, { ...fx.errors.invalidRule, min: 5 }));
    const { onClose } = renderDialog();
    await findDialog();
    await user.clear(field("Ketma-ket manfiy smenalar"));
    await user.type(field("Ketma-ket manfiy smenalar"), "4");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(field("Ketma-ket manfiy smenalar")).toHaveAccessibleDescription("4 dan katta son kiriting"));
    expect(field("Ketma-ket manfiy smenalar")).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText("Sozlamalar saqlanmadi")).toBeNull();
  });

  it("409 — sozlamalar qayta o'qiladi, o'zgarish yangi versiyaga ko'chadi (boshqa oynadagisi qoladi), info izoh; qayta saqlash", async () => {
    const user = userEvent.setup();
    renderDialog();
    await findDialog();
    await waitFor(() => expect(settingsCalls()).toHaveLength(1));
    // Boshqa oynada: versiya 5, R2 o'chirilgan.
    serverSettings = { ...structuredClone(fx.settings), version: 5, rules: { ...fx.settings.rules, R2: { ...fx.settings.rules.R2, enabled: false } } };
    mocks.patch
      .mockRejectedValueOnce(advisorHttpError(409, fx.errors.settingsConflict))
      .mockResolvedValueOnce({ data: advisorEnvelope({ ...serverSettings, version: 6 }) });

    await user.clear(field("Bir smenadagi kamomad"));
    await user.type(field("Bir smenadagi kamomad"), "30000");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Saqlash" }));

    expect(await screen.findByText("Sozlamalar boshqa oynada o'zgartirilgan")).toBeInTheDocument();
    await waitFor(() => expect(ruleSwitch("Kuryer qarzi o'smoqda")).toHaveAttribute("aria-checked", "false"));
    expect(field("Bir smenadagi kamomad")).toHaveValue("30 000");

    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText("1 ta o'zgarish · faoliyat jurnaliga yoziladi")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(2));
    expect(mocks.patch.mock.calls[1][1]).toEqual({ version: 5, rules: { R1: { shortage_uzs: 30_000 } } });
  });

  it("boshqa xato (500, INVALID_SETTING) — «Sozlamalar saqlanmadi / Hech narsa o'zgarmadi — qayta urining.»", async () => {
    const user = userEvent.setup();
    mocks.patch.mockRejectedValue(advisorHttpError(500));
    const { onClose } = renderDialog();
    await findDialog();
    await user.click(ruleSwitch("Zarar"));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Saqlash" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sozlamalar saqlanmadi");
    expect(alert).toHaveTextContent("Hech narsa o'zgarmadi — qayta urining.");
    expect(onClose).not.toHaveBeenCalled();
    expect(ruleSwitch("Zarar")).toHaveAttribute("aria-checked", "false");
  });
});

describe("Qoidalar sozlamasi — telefon", () => {
  it("pastki varaqa; kalit bosish maydoni ≥ 44 px (max-md:min-h-11)", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    renderDialog();
    await findDialog();
    expect(ruleSwitch("Smena kamomadi").className).toContain("max-md:min-h-11");
    expect(ruleSwitch("Smena kamomadi").className).toContain("max-md:min-w-11");
  });
});
