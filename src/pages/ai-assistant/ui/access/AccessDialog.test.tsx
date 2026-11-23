import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RootState } from "../../../../app/config/store";
import { renderWithProviders } from "../../../../test/test-utils";
import { AccessDialog } from "./AccessDialog";

/**
 * «KIRISH HUQUQI» OYNASI (F7PWp6cK, ega 2026-11-23) — superadmin adminlarga AI yordamchi ruxsatini beradi / oladi va
 * kunlik limitni yozadi. Saqlash — faqat o'zgargan qatorlar, har biri alohida `PATCH ai/assistant/access`.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const ACCESS = {
  feature_enabled: true,
  default_daily_limit: 100,
  model: "claude",
  items: [
    { user_id: "2", enabled: true, daily_limit: 50, effective_daily_limit: 50, updated_by: "1", updated_at: null },
    { user_id: "3", enabled: false, daily_limit: null, effective_daily_limit: 100, updated_by: "1", updated_at: null },
  ],
};
const ADMINS = [
  { id: "3", name: "Dilnoza Karimova", phone_number: "+998935120846", role: "admin" },
  { id: "2", name: "Aziz Rahimov", phone_number: "+998913302774", role: "admin" },
];

const envelope = (data: unknown) => ({ statusCode: 200, data });

beforeEach(() => {
  mocks.get.mockImplementation((url: string, options?: { params?: Record<string, unknown> }) => {
    if (url === "ai/assistant/access") return Promise.resolve({ data: envelope(ACCESS) });
    if (url === "users" && options?.params?.role === "admin") {
      return Promise.resolve({ data: envelope({ items: ADMINS, meta: { page: 1, limit: 100, total: 2 } }) });
    }
    return Promise.reject(new Error(`kutilmagan GET ${url}`));
  });
  mocks.patch.mockResolvedValue({ data: envelope({ ok: true }) });
});

afterEach(() => {
  vi.clearAllMocks();
});

const superadmin: Partial<RootState> = {
  user: {
    user: { id: "1", name: "Shodiyor Ergashev", phone_number: "+998900001122", role: "superadmin" } as never,
    isAuthenticated: true,
    accessToken: "test.token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
  role: { id: "1", role: "superadmin", region: null, name: null },
};

const renderDialog = () => {
  const onClose = vi.fn();
  renderWithProviders(<AccessDialog open onClose={onClose} />, { route: "/ai-assistant", preloadedState: superadmin });
  return { onClose };
};

const findDialog = () => screen.findByRole("dialog", { name: "AI yordamchiga kirish huquqi" });
const accessSwitch = (name: string) => screen.getByRole("switch", { name });
const patchBodies = () => mocks.patch.mock.calls.map(([, body]) => body);

describe("«Kirish huquqi» oynasi", () => {
  it("superadmin doim kiradi; adminlar ism bo'yicha, kalit va limit; ogohlantirish va sukut limit", async () => {
    renderDialog();
    const dialog = await findDialog();
    expect(await within(dialog).findByText("Aziz Rahimov")).toBeInTheDocument();

    expect(within(dialog).getByText("Yordamchi barcha moliyani ko'radi")).toBeInTheDocument();
    expect(within(dialog).getByText("Shodiyor Ergashev")).toBeInTheDocument();
    expect(within(dialog).getByText("Doim kiradi")).toBeInTheDocument();
    expect(within(dialog).getByText("Ruxsat berilgan: 1 / 2")).toBeInTheDocument();

    expect(accessSwitch("Aziz Rahimov")).toHaveAttribute("aria-checked", "true");
    expect(accessSwitch("Dilnoza Karimova")).toHaveAttribute("aria-checked", "false");
    // Limit faqat yoqilgan adminda.
    expect(within(dialog).getAllByRole("textbox", { name: "Kunlik limit" })).toHaveLength(1);
    expect(within(dialog).getByRole("textbox", { name: "Kunlik limit" })).toHaveValue("50");
    expect(within(dialog).getByText("100 so'rov / kun")).toBeInTheDocument();
  });

  it("⭐ saqlash — faqat o'zgargan qatorlar, har biri alohida PATCH; keyin oyna yopiladi", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    const dialog = await findDialog();
    await within(dialog).findByText("Aziz Rahimov");

    const limit = within(dialog).getByRole("textbox", { name: "Kunlik limit" });
    await user.clear(limit);
    await user.type(limit, "30");
    await user.click(accessSwitch("Dilnoza Karimova"));
    expect(within(dialog).getByText("Ruxsat berilgan: 2 / 2")).toBeInTheDocument();
    expect(within(dialog).getByText("bo'sh — sukut bo'yicha 100")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.patch.mock.calls.map(([url]) => url)).toEqual(["ai/assistant/access", "ai/assistant/access"]);
    expect(patchBodies()).toEqual([
      { user_id: "2", enabled: true, daily_limit: 30 },
      { user_id: "3", enabled: true, daily_limit: null },
    ]);
    expect(await screen.findByText("Ruxsatlar saqlandi")).toBeInTheDocument();
  });

  it("o'zgarish yo'q — so'rovsiz yopiladi", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    const dialog = await findDialog();
    await within(dialog).findByText("Aziz Rahimov");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect(onClose).toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("limit 10 000 dan katta — maydonda xato, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    const dialog = await findDialog();
    await within(dialog).findByText("Aziz Rahimov");
    const limit = within(dialog).getByRole("textbox", { name: "Kunlik limit" });
    await user.clear(limit);
    await user.type(limit, "20000");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("0 dan 10 000 gacha butun son kiriting");
    expect(limit).toHaveFocus();
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("⭐ ikkinchi PATCH yiqilsa — xato oynada (kim uchun), qayta urinishda faqat qolgani yuboriladi", async () => {
    const user = userEvent.setup();
    mocks.patch
      .mockResolvedValueOnce({ data: envelope({ ok: true }) })
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ data: envelope({ ok: true }) });
    const { onClose } = renderDialog();
    const dialog = await findDialog();
    await within(dialog).findByText("Aziz Rahimov");

    await user.click(accessSwitch("Aziz Rahimov"));
    await user.click(accessSwitch("Dilnoza Karimova"));
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(await within(dialog).findByText("Saqlab bo'lmadi")).toBeInTheDocument();
    expect(within(dialog).getByText(/Dilnoza Karimova uchun o'zgarish saqlanmadi/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(patchBodies()).toEqual([
      { user_id: "2", enabled: false, daily_limit: 50 },
      { user_id: "3", enabled: true, daily_limit: null },
      { user_id: "3", enabled: true, daily_limit: null },
    ]);
  });

  it("yuklab bo'lmasa — xato va «Qayta urinish»", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "ai/assistant/access"
        ? Promise.reject(new Error("network"))
        : Promise.resolve({ data: envelope({ items: ADMINS, meta: { page: 1, limit: 100, total: 2 } }) }),
    );
    renderDialog();
    const dialog = await findDialog();
    expect(await within(dialog).findByText("Ruxsatlarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
  });
});
