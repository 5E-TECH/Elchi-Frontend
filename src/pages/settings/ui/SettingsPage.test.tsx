import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { ThemeProvider } from "../../../app/providers/theme/ThemeContext";
import { DEFAULT_SETTINGS, type AppSettings } from "../../../entities/settings";
import SettingsPage from "./SettingsPage";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  settings: null as AppSettings | null,
  update: { isPending: false, isError: false },
}));

vi.mock("../../../entities/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../entities/settings")>();
  return {
    ...actual,
    useSettings: () => ({ data: mocks.settings ?? actual.DEFAULT_SETTINGS }),
    useUpdateSettings: () => ({ mutate: mocks.mutate, mutateAsync: vi.fn(), ...mocks.update }),
  };
});

const renderPage = (options: Parameters<typeof renderWithProviders>[1] = {}) =>
  renderWithProviders(
    <ThemeProvider>
      <SettingsPage />
    </ThemeProvider>,
    options,
  );

/**
 * jsdom'da media so'rovlar yo'q: desktop (vertikal) va telefon (gorizontal) tablistlari ikkalasi ham DOM'da.
 * Desktop ro'yxati — `aria-orientation="vertical"`.
 */
const desktopNav = () =>
  screen
    .getAllByRole("tablist", { name: "Sozlamalar bo'limlari" })
    .find((list) => list.getAttribute("aria-orientation") === "vertical")!;

const openTab = async (name: RegExp) => {
  renderPage();
  await userEvent.click(within(desktopNav()).getByRole("tab", { name }));
};

beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.settings = null;
  mocks.update = { isPending: false, isError: false };
});

describe("SettingsPage — tuzilma (maketlar common-settings-*)", () => {
  it("sarlavha, 5 bo'lim (nom + izoh) va «Saqlandi» holati", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Sozlamalar" })).toBeInTheDocument();
    expect(
      screen.getByText("Faqat sizning hisobingiz uchun · o'zgarishlar avtomatik saqlanadi"),
    ).toBeInTheDocument();
    const tabs = within(desktopNav()).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Ko'rinishMavzu va til",
      "Bosh sahifaKo'rsatiladigan bloklar",
      "InterfeysYon panel holati",
      "SkanerKamera, ovoz va tebranish",
      "BildirishnomalarShu qurilmaga xabarlar",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Saqlandi");
  });

  it("saqlash holati: «Saqlanmoqda…» va «Saqlashda xatolik»", () => {
    mocks.update = { isPending: true, isError: false };
    const { unmount } = renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Saqlanmoqda…");
    unmount();
    mocks.update = { isPending: false, isError: true };
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Saqlashda xatolik");
  });

  it("vertikal bo'limlar ro'yxati ↓ / End bilan yuradi", () => {
    renderPage();
    const [first] = within(desktopNav()).getAllByRole("tab");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(within(desktopNav()).getByRole("tab", { name: /^Bosh sahifa/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(within(desktopNav()).getByRole("tab", { name: /^Bildirishnomalar/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(desktopNav()).getByRole("tab", { name: /^Bildirishnomalar/ })).toHaveFocus();
  });

  it("boshqa sahifadan `state.tab` bilan — o'sha bo'lim ochiladi", () => {
    renderPage({ route: { pathname: "/settings", state: { tab: "notifications" } } });
    expect(within(desktopNav()).getByRole("tab", { name: /^Bildirishnomalar/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("notifications-scope-notice")).toBeInTheDocument();
  });
});

describe("SettingsPage — Ko'rinish", () => {
  afterEach(() => document.documentElement.classList.remove("dark"));

  it("mavzu radio: «Tungi» → darhol tungi va `themeChosen: true` bilan saqlanadi", async () => {
    renderPage();
    const dark = screen.getByRole("radio", { name: /Tungi/ });
    expect(screen.getByRole("radio", { name: /Kunduzgi/ })).toBeChecked();
    await userEvent.click(dark);
    expect(dark).toBeChecked();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(mocks.mutate).toHaveBeenCalledWith({ appearance: { theme: "dark", themeChosen: true } });
  });

  it("til radio: 3 variant, joriy — O'zbekcha", () => {
    renderPage();
    const group = screen.getByRole("radiogroup", { name: "Til" });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(within(group).getByRole("radio", { name: /O'zbekcha/ })).toBeChecked();
    expect(within(group).getByRole("radio", { name: /English/ })).not.toBeChecked();
  });
});

describe("SettingsPage — Bosh sahifa", () => {
  it("5 ta blok maket tartibida, «N / 5 ta yoqilgan», o'chirilgani «Yashirilgan»", async () => {
    const actual = await vi.importActual<typeof import("../../../entities/settings")>(
      "../../../entities/settings",
    );
    mocks.settings = {
      ...actual.DEFAULT_SETTINGS,
      dashboard: {
        widgets: { ...actual.DEFAULT_SETTINGS.dashboard.widgets, performanceChart: false },
      },
    };
    await openTab(/^Bosh sahifa/);
    const switches = screen.getAllByRole("switch");
    const order = [
      "Asosiy ko'rsatkichlar",
      "Moliyaviy tahlil",
      "Top marketlar va filiallar",
      "Top kuryerlar va to'liq reyting",
      "Hududlar bo'yicha",
    ];
    expect(switches).toHaveLength(order.length);
    order.forEach((name, index) =>
      expect(switches[index]).toBe(screen.getByRole("switch", { name })),
    );
    expect(screen.getByRole("switch", { name: "Top kuryerlar va to'liq reyting" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByText(/ta yoqilgan/).textContent).toBe("4 / 5 ta yoqilgan");
    expect(screen.getByText("Yashirilgan")).toBeInTheDocument();
    expect(screen.queryByText("Buyurtmalar vaqti")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "Moliyaviy tahlil" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ dashboard: { widgets: { financial: false } } });
    expect(screen.getByRole("link", { name: /Bosh sahifani ochish/ })).toHaveAttribute("href", "/");
  });

  it("menejerda «Bosh sahifani ochish» — /branch-dashboard", async () => {
    renderPage({
      preloadedState: { role: { id: "m1", role: "manager", region: null, name: "m" } } as never,
    });
    await userEvent.click(within(desktopNav()).getByRole("tab", { name: /^Bosh sahifa/ }));
    expect(screen.getByRole("link", { name: /Bosh sahifani ochish/ })).toHaveAttribute(
      "href",
      "/branch-dashboard",
    );
  });
});

describe("SettingsPage — Interfeys va Skaner", () => {
  it("yon panel radio: «Yig'ilgan» → `sidebarOpen: false`, «Ochiq» → `true`", async () => {
    renderPage({ preloadedState: { sidebar: { isOpen: true, isMobileMenuOpen: false } } as never });
    await userEvent.click(within(desktopNav()).getByRole("tab", { name: /^Interfeys/ }));
    expect(screen.getByRole("radio", { name: /Ochiq/ })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: /Yig'ilgan/ }));
    expect(mocks.mutate).toHaveBeenLastCalledWith({ interface: { sidebarOpen: false } });
    expect(screen.getByRole("radio", { name: /Yig'ilgan/ })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: /Ochiq/ }));
    expect(mocks.mutate).toHaveBeenLastCalledWith({ interface: { sidebarOpen: true } });
  });

  it("ovoz tanlash saqlanadi; «eshitib ko'rish» tanlovni o'zgartirmaydi", async () => {
    await openTab(/^Skaner/);
    const success = screen.getByRole("radiogroup", { name: "Muvaffaqiyat ovozi" });
    expect(within(success).getAllByRole("radio")).toHaveLength(6);
    expect(within(success).getByRole("radio", { name: "Klassik" })).toBeChecked();

    await userEvent.click(
      within(success).getByRole("button", { name: "Puls — muvaffaqiyat ovozini eshitib ko'rish" }),
    );
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(within(success).getByRole("radio", { name: "Klassik" })).toBeChecked();

    const error = screen.getByRole("radiogroup", { name: "Xato ovozi" });
    await userEvent.click(within(error).getByRole("radio", { name: "Raqamli" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ scanner: { sounds: { error: "digital" } } });
    expect(screen.getByText("USB skaner tayyor")).toBeInTheDocument();
  });

  it("«Kamera» kartasi (maket common-settings-scanner): sukut qiymatlari va «Kamerani sinash» → /scan", async () => {
    await openTab(/^Skaner/);
    const card = screen.getByRole("region", { name: "Kamera" });
    expect(within(card).getByRole("link", { name: "Kamerani sinash" })).toHaveAttribute("href", "/scan");

    const facing = within(card).getByRole("radiogroup", { name: "Asosiy kamera" });
    expect(within(facing).getByRole("radio", { name: /^Orqa kamera/ })).toBeChecked();
    expect(within(facing).getByRole("radio", { name: /^Old kamera/ })).not.toBeChecked();

    for (const name of ["Chiroq — avtomatik", "Uzluksiz skanerlash", "Ovoz", "Tebranish"]) {
      expect(within(card).getByRole("switch", { name })).toHaveAttribute("aria-checked", "true");
    }

    const frame = within(card).getByRole("radiogroup", { name: "Ramka o'lchami" });
    expect(within(frame).getAllByRole("radio")).toHaveLength(3);
    expect(within(frame).getByRole("radio", { name: /^O'rta/ })).toBeChecked();
  });

  it("kamera sozlamalari saqlanadi va qurilmadagi ko'zguga darhol yoziladi (kamera shundan o'qiydi)", async () => {
    window.localStorage.clear();
    await openTab(/^Skaner/);
    const card = screen.getByRole("region", { name: "Kamera" });

    await userEvent.click(within(card).getByRole("radio", { name: /^Old kamera/ }));
    expect(mocks.mutate).toHaveBeenLastCalledWith({ scanner: { camera: { facing: "user" } } });
    expect(window.localStorage.getItem("scanner-camera-facing")).toBe("user");

    await userEvent.click(within(card).getByRole("radio", { name: /^Katta/ }));
    expect(mocks.mutate).toHaveBeenLastCalledWith({ scanner: { camera: { frame: "lg" } } });
    expect(window.localStorage.getItem("scanner-frame-size")).toBe("lg");

    await userEvent.click(within(card).getByRole("switch", { name: "Uzluksiz skanerlash" }));
    expect(mocks.mutate).toHaveBeenLastCalledWith({ scanner: { camera: { continuous: false } } });
    expect(window.localStorage.getItem("scanner-continuous")).toBe("false");

    await userEvent.click(within(card).getByRole("switch", { name: "Chiroq — avtomatik" }));
    expect(mocks.mutate).toHaveBeenLastCalledWith({ scanner: { camera: { torchAuto: false } } });

    await userEvent.click(within(card).getByRole("switch", { name: "Tebranish" }));
    expect(mocks.mutate).toHaveBeenLastCalledWith({ scanner: { feedback: { vibration: false } } });
    expect(window.localStorage.getItem("scanner-vibration")).toBe("false");

    await userEvent.click(within(card).getByRole("switch", { name: "Ovoz" }));
    expect(mocks.mutate).toHaveBeenLastCalledWith({ scanner: { feedback: { sound: false } } });
    expect(window.localStorage.getItem("scanner-sound-enabled")).toBe("false");
    window.localStorage.clear();
  });

  it("saqlangan kamera sozlamasi ko'rsatiladi; marketda «Kamerani sinash» yo'q", async () => {
    mocks.settings = {
      ...DEFAULT_SETTINGS,
      scanner: {
        ...DEFAULT_SETTINGS.scanner,
        camera: { facing: "user", frame: "sm", torchAuto: false, continuous: false },
        feedback: { sound: true, vibration: false },
      },
    };
    renderPage({ preloadedState: { role: { id: "k1", role: "market", region: null, name: "k" } } as never });
    await userEvent.click(within(desktopNav()).getByRole("tab", { name: /^Skaner/ }));
    const card = screen.getByRole("region", { name: "Kamera" });
    expect(within(card).queryByRole("link", { name: "Kamerani sinash" })).not.toBeInTheDocument();
    expect(within(card).getByRole("radio", { name: /^Old kamera/ })).toBeChecked();
    expect(within(card).getByRole("radio", { name: /^Kichik/ })).toBeChecked();
    expect(within(card).getByRole("switch", { name: "Uzluksiz skanerlash" })).toHaveAttribute("aria-checked", "false");
    expect(within(card).getByRole("switch", { name: "Tebranish" })).toHaveAttribute("aria-checked", "false");
    expect(within(card).getByRole("switch", { name: "Ovoz" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("SettingsPage — Bildirishnomalar tabi", () => {
  const openNotifications = () => openTab(/^Bildirishnomalar/);

  it("qurilma bloki (push kaliti) va backend hali qo'llamasligini OCHIQ aytadi", async () => {
    await openNotifications();
    expect(screen.getByText("Qurilma bildirishnomalari")).toBeInTheDocument();
    // jsdom'da Web Push yo'q — kalit o'chiq va sababi yozilgan.
    const device = screen.getByRole("switch", { name: "Shu qurilmaga bildirishnomalar" });
    expect(device).toBeDisabled();
    expect(device).toHaveAccessibleDescription("Bu brauzerda mavjud emas");
    expect(screen.getByRole("link", { name: /Qutini ochish/ })).toHaveAttribute("href", "/inbox");

    const notice = screen.getByTestId("notifications-scope-notice");
    expect(within(notice).getByText("Hozircha bu sozlamalar faqat saqlanadi")).toBeInTheDocument();
    expect(within(notice).getByText(/xabar yuborishda hali hisobga olinmaydi/)).toBeInTheDocument();
  });

  it("muhim xabarlar kalitini o'chirib bo'lmaydi va izohi bor", async () => {
    await openNotifications();
    const critical = screen.getByRole("switch", { name: "Muhim xabarlar" });
    expect(critical).toHaveAttribute("aria-checked", "true");
    expect(critical).toBeDisabled();
    expect(screen.getByText(/Muhim xabarlarni o'chirib bo'lmaydi/)).toBeInTheDocument();
  });

  it("6 ta xizmat kategoriyasi + marketing ALOHIDA «Reklama va aksiyalar» blokida", async () => {
    await openNotifications();
    for (const name of ["Buyurtma", "Moliya", "Filial", "Logistika", "Hisob", "Tizim"]) {
      expect(screen.getByRole("switch", { name })).toHaveAttribute("aria-checked", "true");
    }
    // Marketing umumiy ro'yxatda emas.
    expect(screen.queryByRole("switch", { name: "Marketing" })).not.toBeInTheDocument();
    const marketing = screen.getByTestId("notifications-marketing");
    expect(within(marketing).getByText("Reklama va aksiyalar")).toBeInTheDocument();
    expect(
      within(marketing).getByRole("switch", { name: "Reklama xabarlarini olish" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("reklamadan voz kechish (opt-out) — marketing ovozi o'chiriladi", async () => {
    await openNotifications();
    await userEvent.click(screen.getByRole("switch", { name: "Reklama xabarlarini olish" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ notifications: { mute: { marketing: true } } });
  });

  it("kategoriyani o'chirish va o'chirilganini qaytarish", async () => {
    const actual = await vi.importActual<typeof import("../../../entities/settings")>(
      "../../../entities/settings",
    );
    mocks.settings = {
      ...actual.DEFAULT_SETTINGS,
      notifications: { ...actual.DEFAULT_SETTINGS.notifications, muted_categories: ["logistics"] },
    };
    await openNotifications();

    const logistics = screen.getByRole("switch", { name: "Logistika" });
    expect(logistics).toHaveAttribute("aria-checked", "false");
    await userEvent.click(logistics);
    expect(mocks.mutate).toHaveBeenLastCalledWith({
      notifications: { mute: { logistics: false } },
    });

    await userEvent.click(screen.getByRole("switch", { name: "Buyurtma" }));
    expect(mocks.mutate).toHaveBeenLastCalledWith({ notifications: { mute: { order: true } } });
  });

  it("kanal kalitlari: Ilova ichida / Jonli / Telegram / SMS", async () => {
    await openNotifications();
    for (const name of ["Ilova ichida", "Jonli (real vaqtda)", "Telegram", "SMS"]) {
      expect(screen.getByRole("switch", { name })).toHaveAttribute("aria-checked", "true");
    }
    await userEvent.click(screen.getByRole("switch", { name: "SMS" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ notifications: { channels: { sms: false } } });
  });

  it("sokin soatlar: Toshkent vaqti, o'chiq bo'lsa vaqt tanlab bo'lmaydi", async () => {
    await openNotifications();
    expect(screen.getByText("Toshkent vaqti (UTC+5)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("22:00")).toBeDisabled();
    expect(screen.getByDisplayValue("08:00")).toBeDisabled();

    await userEvent.click(screen.getByRole("switch", { name: "Sokin soatlarni yoqish" }));
    expect(mocks.mutate).toHaveBeenCalledWith({
      notifications: { quiet_hours: { enabled: true } },
    });
  });

  it("yoqilgan sokin soatlar saqlangan vaqtni ko'rsatadi va to'liq vaqt saqlanadi", async () => {
    const actual = await vi.importActual<typeof import("../../../entities/settings")>(
      "../../../entities/settings",
    );
    mocks.settings = {
      ...actual.DEFAULT_SETTINGS,
      notifications: {
        ...actual.DEFAULT_SETTINGS.notifications,
        quiet_hours: { enabled: true, from: "23:30", to: "07:00" },
      },
    };
    await openNotifications();
    const from = screen.getByDisplayValue("23:30");
    expect(from).toBeEnabled();
    expect(screen.getByDisplayValue("07:00")).toBeEnabled();

    fireEvent.change(from, { target: { value: "21:15" } });
    expect(mocks.mutate).toHaveBeenCalledWith({
      notifications: { quiet_hours: { from: "21:15" } },
    });
  });
});
