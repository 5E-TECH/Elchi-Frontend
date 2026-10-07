import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { aiApiGet } from "../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { post: mocks.post, get: mocks.get, patch: vi.fn(), delete: vi.fn() },
}));

import OrderCreate from "./index";

/**
 * /new-orders/create — "QO'LDA" VA "AI BILAN" REJIMLARI (DUFZDG5r).
 */

const marketState = {
  role: { id: "7", role: "market", region: null, name: "Test market" },
} as never;
const adminState = {
  role: { id: "1", role: "superadmin", region: null, name: "Admin" },
} as never;

const tab = (name: "Qo'lda" | "AI bilan") =>
  within(screen.getByRole("tablist")).getByRole("tab", { name });

const aiPanel = () => screen.getByTestId("ai-mode-panel");
const manualPanel = () => screen.getByTestId("manual-mode-panel");

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  mocks.get.mockReset();
  mocks.get.mockImplementation(aiApiGet);
  mocks.post.mockReset();
  mocks.post.mockResolvedValue({ data: { statusCode: 200, data: { ok: true, orders: [] } } });
});

describe("OrderCreate — rejim tablari", () => {
  it("sukut bo'yicha \"Qo'lda\" tabi faol va qo'lda forma avvalgidek ko'rinadi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    expect(tab("Qo'lda")).toHaveAttribute("aria-selected", "true");
    expect(tab("AI bilan")).toHaveAttribute("aria-selected", "false");
    expect(manualPanel()).not.toHaveClass("hidden");
    expect(aiPanel()).toHaveClass("hidden");
    expect(within(manualPanel()).getByPlaceholderText("Ism kiriting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buyurtma yaratish" })).toBeInTheDocument();
  });

  it("\"AI bilan\" tabida Step2Combined o'rniga AI paneli chiqadi, StepActions ko'rinmaydi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    fireEvent.click(tab("AI bilan"));

    expect(tab("AI bilan")).toHaveAttribute("aria-selected", "true");
    expect(aiPanel()).not.toHaveClass("hidden");
    expect(manualPanel()).toHaveClass("hidden");
    expect(within(aiPanel()).getByLabelText("Buyurtma matni")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buyurtma yaratish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Orqaga" })).not.toBeInTheDocument();
  });

  it("tab almashganda qo'lda forma qiymatlari yo'qolmaydi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    fireEvent.change(within(manualPanel()).getByPlaceholderText("Ism kiriting"), { target: { value: "Vali" } });

    fireEvent.click(tab("AI bilan"));
    fireEvent.click(tab("Qo'lda"));

    expect((within(manualPanel()).getByPlaceholderText("Ism kiriting") as HTMLInputElement).value).toBe("Vali");
  });

  it("AI→Qo'lda→AI: kiritilgan matn saqlanib qoladi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    fireEvent.click(tab("AI bilan"));
    fireEvent.change(within(aiPanel()).getByLabelText("Buyurtma matni"), { target: { value: "Vali 90 123 45 67" } });

    fireEvent.click(tab("Qo'lda"));
    fireEvent.click(tab("AI bilan"));

    expect((within(aiPanel()).getByLabelText("Buyurtma matni") as HTMLTextAreaElement).value).toBe("Vali 90 123 45 67");
  });

  it("admin/registrator uchun market tanlanmagan bo'lsa AI tabi \"Avval marketni tanlang\" va Step1Market ni ko'rsatadi", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });

    fireEvent.click(tab("AI bilan"));

    expect(within(aiPanel()).getByText(/Avval marketni tanlang/)).toBeInTheDocument();
    expect(within(aiPanel()).queryByLabelText("Buyurtma matni")).not.toBeInTheDocument();
    expect(within(aiPanel()).getByText("Market tanlash")).toBeInTheDocument();
  });

  it("market roli bilan AI tabi darhol ishlaydi (market so'ralmaydi)", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    fireEvent.click(tab("AI bilan"));

    expect(within(aiPanel()).queryByText(/Avval marketni tanlang/)).not.toBeInTheDocument();
    expect(within(aiPanel()).getByLabelText("Buyurtma matni")).toBeInTheDocument();
  });

  it("AI tugmalari qo'lda formani submit QILMAYDI — POST /orders chaqirilmaydi", async () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    fireEvent.click(tab("AI bilan"));
    fireEvent.change(within(aiPanel()).getByLabelText("Buyurtma matni"), { target: { value: "Vali 90 123 45 67" } });

    fireEvent.click(within(aiPanel()).getByRole("button", { name: "Tahlil qilish" }));
    // Enter bilan implicit submit ham qo'lda buyurtma yaratmasin.
    fireEvent.submit(aiPanel().closest("form") as HTMLFormElement);

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("orders/ai-parse", expect.anything(), expect.anything()));
    expect(mocks.post.mock.calls.map(([url]) => url)).not.toContain("orders");
  });

  it("backend `reason: \"disabled\"` qaytarsa tushuntirish chiqadi va \"Qo'lda yaratish\" Qo'lda tabiga o'tkazadi", async () => {
    mocks.post.mockResolvedValue({ data: { statusCode: 200, data: { ok: false, reason: "disabled" } } });
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    fireEvent.click(tab("AI bilan"));
    fireEvent.change(within(aiPanel()).getByLabelText("Buyurtma matni"), { target: { value: "matn" } });
    fireEvent.click(within(aiPanel()).getByRole("button", { name: "Tahlil qilish" }));

    fireEvent.click(await within(aiPanel()).findByRole("button", { name: "Qo'lda yaratish" }));

    expect(tab("Qo'lda")).toHaveAttribute("aria-selected", "true");
    expect(manualPanel()).not.toHaveClass("hidden");
  });

  it("market tanlangach pastdagi \"Yangi buyurtmalar\" jadvali ikkala tabda ham ko'rinadi", async () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    expect(await screen.findByText("Jami 0 ta buyurtma")).toBeInTheDocument();

    fireEvent.click(tab("AI bilan"));

    expect(screen.getByText("Jami 0 ta buyurtma")).toBeVisible();
    expect(mocks.get).toHaveBeenCalledWith("orders/markets/7/new", expect.anything());
  });

  it("640px dan kichikda tablar dropdown, kattada yonma-yon (tabs.tsx naqshi)", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    const tabs = screen.getByTestId("create-mode-tabs");

    const mobile = tabs.querySelector(".sm\\:hidden") as HTMLElement;
    expect(within(mobile).getByRole("button", { name: "Qo'lda" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("tablist")).toHaveClass("hidden", "sm:grid", "grid-cols-2");

    fireEvent.click(within(mobile).getByRole("button", { name: "Qo'lda" }));
    fireEvent.click(within(mobile).getByRole("tab", { name: "AI bilan" }));
    expect(aiPanel()).not.toHaveClass("hidden");
  });

  it("ai-availability `enabled:false` bo'lsa AI tabi UMUMAN ko'rinmaydi, faqat qo'lda oqim (HD5zOyBp #9)", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "orders/ai-availability"
        ? Promise.resolve({ data: { statusCode: 200, data: { enabled: false, state: "disabled" } } })
        : aiApiGet(url),
    );
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await waitFor(() => expect(screen.queryByTestId("create-mode-tabs")).not.toBeInTheDocument());
    expect(screen.queryByTestId("ai-mode-panel")).not.toBeInTheDocument();
    expect(manualPanel()).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Buyurtma yaratish" })).toBeInTheDocument();
  });

  it("ai-availability so'rovi yiqilsa (eski backend) tab YASHIRILMAYDI", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "orders/ai-availability" ? Promise.reject(new Error("404")) : aiApiGet(url),
    );
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("orders/ai-availability"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId("create-mode-tabs")).toBeInTheDocument();
    expect(tab("AI bilan")).toBeInTheDocument();
  });
});

describe("OrderCreate — telefonda mijoz bloki (duIKLi7n)", () => {
  it("keng maydonlar faqat sm: dan boshlab 2 ustunni egallaydi — telefonda yashirin ikkinchi ustun yo'q", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const panel = manualPanel();
    const unprefixed = Array.from(panel.querySelectorAll("*")).filter((el) =>
      el.classList.contains("col-span-2"),
    );
    expect(unprefixed).toHaveLength(0);
    expect(panel.querySelectorAll(".sm\\:col-span-2").length).toBeGreaterThan(0);
  });

  it("+998 prefiksi bosishni inputga o'tkazadi (pointer-events-none)", () => {
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    const prefixes = within(manualPanel()).getAllByText("+998");
    expect(prefixes.length).toBeGreaterThan(0);
    prefixes.forEach((prefix) => expect(prefix).toHaveClass("pointer-events-none"));
  });
});
