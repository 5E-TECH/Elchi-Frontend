import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { ThemeProvider } from "../../../app/providers/theme/ThemeContext";
import type { AppSettings } from "../../../entities/settings";
import SettingsPage from "./SettingsPage";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  settings: null as AppSettings | null,
}));

vi.mock("../../../entities/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../entities/settings")>();
  return {
    ...actual,
    useSettings: () => ({ data: mocks.settings ?? actual.DEFAULT_SETTINGS }),
    useUpdateSettings: () => ({ mutate: mocks.mutate, mutateAsync: vi.fn(), isPending: false }),
  };
});

const renderPage = () =>
  renderWithProviders(
    <ThemeProvider>
      <SettingsPage />
    </ThemeProvider>,
  );

describe("SettingsPage tabs in dark mode", () => {
  afterEach(() => document.documentElement.classList.remove("dark"));

  it("does not paint inactive tab titles with --color-maindark (it equals the dark card background)", () => {
    document.documentElement.classList.add("dark");
    renderPage();

    for (const title of ["Dashboard", "Interfeys", "Bildirishnomalar"]) {
      const node = screen.getAllByText(title).find((el) => el.tagName === "P")!;
      expect(node.style.color).not.toContain("--color-maindark");
      expect(node.style.color).toBe("var(--color-dashboard-text-muted)");
    }
  });
});

describe("SettingsPage — Bildirishnomalar tabi", () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    mocks.settings = null;
  });

  const openTab = async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Bildirishnomalar/ }));
  };

  it("4-tab bor va backend hali qo'llamasligini OCHIQ aytadi", async () => {
    await openTab();
    const notice = screen.getByTestId("notifications-scope-notice");
    expect(within(notice).getByText("Hozircha bu sozlamalar faqat saqlanadi")).toBeInTheDocument();
    expect(within(notice).getByText(/xabar yuborishda hali hisobga olinmaydi/)).toBeInTheDocument();
  });

  it("muhim (critical) kalitini o'chirib bo'lmaydi va izohi bor", async () => {
    await openTab();
    const critical = screen.getByRole("switch", { name: "Muhim (critical) xabarlar" });
    expect(critical).toHaveAttribute("aria-checked", "true");
    expect(critical).toBeDisabled();
    expect(screen.getByText(/Muhim xabarlarni o'chirib bo'lmaydi/)).toBeInTheDocument();
  });

  it("6 ta xizmat kategoriyasi + marketing ALOHIDA «Reklama va aksiyalar» blokida", async () => {
    await openTab();
    for (const name of ["Buyurtma", "Moliya", "Filial", "Logistika", "Hisob", "Tizim"]) {
      expect(screen.getByRole("switch", { name })).toHaveAttribute("aria-checked", "true");
    }
    // Marketing umumiy ro'yxatda emas.
    expect(screen.queryByRole("switch", { name: "Marketing" })).not.toBeInTheDocument();
    const marketing = screen.getByTestId("notifications-marketing");
    expect(within(marketing).getByText("Reklama va aksiyalar")).toBeInTheDocument();
    expect(within(marketing).getByRole("switch", { name: "Reklama xabarlarini olish" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("reklamadan voz kechish (opt-out) — marketing ovozi o'chiriladi", async () => {
    await openTab();
    await userEvent.click(screen.getByRole("switch", { name: "Reklama xabarlarini olish" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ notifications: { mute: { marketing: true } } });
  });

  it("kategoriyani o'chirish va o'chirilganini qaytarish", async () => {
    const actual = await vi.importActual<typeof import("../../../entities/settings")>("../../../entities/settings");
    mocks.settings = {
      ...actual.DEFAULT_SETTINGS,
      notifications: { ...actual.DEFAULT_SETTINGS.notifications, muted_categories: ["logistics"] },
    };
    await openTab();

    const logistics = screen.getByRole("switch", { name: "Logistika" });
    expect(logistics).toHaveAttribute("aria-checked", "false");
    await userEvent.click(logistics);
    expect(mocks.mutate).toHaveBeenLastCalledWith({ notifications: { mute: { logistics: false } } });

    await userEvent.click(screen.getByRole("switch", { name: "Buyurtma" }));
    expect(mocks.mutate).toHaveBeenLastCalledWith({ notifications: { mute: { order: true } } });
  });

  it("kanal kalitlari: Ilova ichida / Jonli / Telegram / SMS", async () => {
    await openTab();
    for (const name of ["Ilova ichida", "Jonli (real vaqtda)", "Telegram", "SMS"]) {
      expect(screen.getByRole("switch", { name })).toHaveAttribute("aria-checked", "true");
    }
    await userEvent.click(screen.getByRole("switch", { name: "SMS" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ notifications: { channels: { sms: false } } });
    // Push qatori ham bor (haqiqiy qurilma obunasi).
    expect(screen.getByText("Push (brauzer va telefon)")).toBeInTheDocument();
  });

  it("sokin soatlar: Toshkent vaqti, o'chiq bo'lsa vaqt tanlab bo'lmaydi", async () => {
    await openTab();
    expect(screen.getByText("Toshkent vaqti (UTC+5)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("22:00")).toBeDisabled();
    expect(screen.getByDisplayValue("08:00")).toBeDisabled();

    await userEvent.click(screen.getByRole("switch", { name: "Sokin soatlarni yoqish" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ notifications: { quiet_hours: { enabled: true } } });
  });

  it("yoqilgan sokin soatlar saqlangan vaqtni ko'rsatadi", async () => {
    const actual = await vi.importActual<typeof import("../../../entities/settings")>("../../../entities/settings");
    mocks.settings = {
      ...actual.DEFAULT_SETTINGS,
      notifications: {
        ...actual.DEFAULT_SETTINGS.notifications,
        quiet_hours: { enabled: true, from: "23:30", to: "07:00" },
      },
    };
    await openTab();
    expect(screen.getByDisplayValue("23:30")).toBeEnabled();
    expect(screen.getByDisplayValue("07:00")).toBeEnabled();
  });
});
