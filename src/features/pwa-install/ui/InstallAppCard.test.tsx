import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { DASHBOARD_DISMISS_KEY } from "../lib/dismissal";
import {
  IPHONE_UA,
  fireAppInstalled,
  fireBeforeInstallPrompt,
  resetInstallEnv,
  restoreInstallEnv,
  setDevice,
  setStandalone,
} from "../test/installEnv";
import { InstallAppCard } from "./InstallAppCard";

/**
 * «Ilovani o'rnatish» kartasi (maketlar courier-inbox-pwa-install, courier-dashboard-pwa-install, iOS varianti —
 * courier-inbox-pwa-ios-dialog). Ega javobi KI-S3: /inbox — doim, yopishsiz; bosh sahifa — bir marta, yopiladi.
 */
describe("InstallAppCard", () => {
  beforeEach(resetInstallEnv);
  afterEach(restoreInstallEnv);

  it("installable (inbox): sarlavha, izoh, «O'rnatish» — brauzer oynasi; yopish tugmasi yo'q", async () => {
    const event = fireBeforeInstallPrompt("accepted");
    renderWithProviders(<InstallAppCard placement="inbox" />);
    const card = screen.getByRole("region", { name: "Elchi'ni ilova sifatida o'rnating" });
    expect(card).toHaveTextContent("Ish stolidan yoki boshlash menyusidan alohida oynada ochiladi.");
    expect(card).toHaveTextContent("Bosh ekrandan bir bosishda, alohida oynada ochiladi.");
    expect(within(card).queryByRole("button", { name: "Taklifni yopish" })).not.toBeInTheDocument();

    await userEvent.click(within(card).getByRole("button", { name: "O'rnatish" }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
    // Qabul qilindi — ilova o'rnatilgan, karta yo'qoladi.
    await waitFor(() => expect(screen.queryByRole("region")).not.toBeInTheDocument());
  });

  it("brauzer oynasi oldin yopilgan bo'lsa — brauzer menyusidan o'rnatish izohi (toast)", async () => {
    fireBeforeInstallPrompt("dismissed");
    renderWithProviders(<InstallAppCard placement="inbox" />);
    const install = screen.getByRole("button", { name: "O'rnatish" });
    await userEvent.click(install);
    expect(screen.queryByText("Brauzer menyusidan o'rnating")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "O'rnatish" }));
    expect(await screen.findByText("Brauzer menyusidan o'rnating")).toBeInTheDocument();
  });

  it("appinstalled — karta yo'qoladi", () => {
    fireBeforeInstallPrompt();
    renderWithProviders(<InstallAppCard placement="inbox" />);
    expect(screen.getByRole("button", { name: "O'rnatish" })).toBeInTheDocument();
    fireAppInstalled();
    expect(screen.queryByRole("button", { name: "O'rnatish" })).not.toBeInTheDocument();
  });

  it("installed (standalone) va unsupported — hech narsa chizilmaydi", () => {
    const { container, unmount } = renderWithProviders(<InstallAppCard placement="inbox" />);
    expect(container.querySelector("[data-testid^=pwa-install-card]")).toBeNull();
    unmount();
    // Yangi ochilish: ilova ichida (standalone) — brauzer hodisa yuborsa ham karta yo'q.
    resetInstallEnv();
    setStandalone(true);
    fireBeforeInstallPrompt();
    renderWithProviders(<InstallAppCard placement="dashboard" />);
    expect(screen.queryByTestId("pwa-install-card-dashboard")).not.toBeInTheDocument();
  });

  it("iOS: «Elchi'ni bosh ekranga qo'shing» + «Qanday qo'shiladi» → 3 qadamli oyna, «Tushunarli» yopadi", async () => {
    setDevice(IPHONE_UA, 5);
    renderWithProviders(<InstallAppCard placement="inbox" />);
    const card = screen.getByRole("region", { name: "Elchi'ni bosh ekranga qo'shing" });
    expect(card).toHaveTextContent("Qo'shish — 3 qadam.");
    await userEvent.click(within(card).getByRole("button", { name: "Qanday qo'shiladi" }));

    const dialog = await screen.findByRole("dialog", { name: "Bosh ekranga qo'shing" });
    const steps = within(within(dialog).getByRole("list", { name: "Qo'shish qadamlari" })).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual([
      "1«Ulashish» tugmasini bosingSafari pastidagi (iPad'da yuqoridagi) kvadrat va strelka belgisi",
      "2«Bosh ekranga qo'shish» ni tanlangRo'yxatni pastga suring — band ochilgan menyuning o'rtasida",
      "3«Qo'shish» ni bosingElchi belgisi bosh ekranda paydo bo'ladi — ilovani shu yerdan oching",
    ]);
    expect(dialog).toHaveTextContent("Faqat Safari'da ishlaydi.");
    expect(within(dialog).getByRole("button", { name: "Keyinroq" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Tushunarli" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("bosh sahifa: izohda «taklif Sozlamalar va Bildirishnomalarda qoladi», «Taklifni yopish» — bir marta", async () => {
    fireBeforeInstallPrompt();
    const { unmount } = renderWithProviders(<InstallAppCard placement="dashboard" />);
    const card = screen.getByTestId("pwa-install-card-dashboard");
    expect(card).toHaveTextContent(
      "Ish stolidan alohida oynada ochiladi. Yopsangiz, taklif Sozlamalar va Bildirishnomalarda qoladi.",
    );
    await userEvent.click(within(card).getByRole("button", { name: "Taklifni yopish" }));
    expect(screen.queryByTestId("pwa-install-card-dashboard")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DASHBOARD_DISMISS_KEY)).toBe("1");
    unmount();

    // Qayta ochilganda bosh sahifada yo'q, /inbox da — bor (yopishsiz).
    renderWithProviders(
      <>
        <InstallAppCard placement="dashboard" />
        <InstallAppCard placement="inbox" />
      </>,
    );
    expect(screen.queryByTestId("pwa-install-card-dashboard")).not.toBeInTheDocument();
    expect(screen.getByTestId("pwa-install-card-inbox")).toBeInTheDocument();
  });

  it("bosh sahifa: localStorage bloklangan bo'lsa ham yopiladi (xato yutiladi)", async () => {
    fireBeforeInstallPrompt();
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    renderWithProviders(<InstallAppCard placement="dashboard" />);
    await userEvent.click(screen.getByRole("button", { name: "Taklifni yopish" }));
    expect(screen.queryByTestId("pwa-install-card-dashboard")).not.toBeInTheDocument();
    set.mockRestore();
  });

  it("telefonda tugma kenglikni faqat bosh sahifa kartasida egallaydi; /inbox da — o'z kengligida, o'ngda", () => {
    fireBeforeInstallPrompt();
    renderWithProviders(
      <>
        <InstallAppCard placement="inbox" />
        <InstallAppCard placement="dashboard" />
      </>,
    );
    const [inboxActions, dashboardActions] = screen.getAllByTestId("pwa-install-card-actions");
    expect(inboxActions.className).toContain("ml-auto");
    expect(inboxActions.className).not.toContain("max-md:w-full");
    expect(within(inboxActions).getByRole("button", { name: "O'rnatish" }).className).not.toContain("max-md:flex-1");
    expect(dashboardActions.className).toContain("max-md:w-full");
    expect(within(dashboardActions).getByRole("button", { name: "O'rnatish" }).className).toContain("max-md:flex-1");
  });

  it("iOS oynasi: izoh sarlavha ostida, butun kenglikda (14px) va oynaning aria-describedby'si", async () => {
    setDevice(IPHONE_UA, 5);
    renderWithProviders(<InstallAppCard placement="inbox" />);
    await userEvent.click(screen.getByRole("button", { name: "Qanday qo'shiladi" }));
    const dialog = await screen.findByRole("dialog", { name: "Bosh ekranga qo'shing" });
    const body = within(dialog).getByTestId("pwa-ios-body");
    expect(body.tagName).toBe("P");
    expect(body).toHaveClass("text-sm");
    expect(dialog).toHaveAttribute("aria-describedby", body.id);
    expect(dialog).toHaveAccessibleDescription(
      "Elchi alohida ilova bo'lib ochiladi va bildirishnomalar qurilmangizga keladi — ilova yopiq bo'lsa ham.",
    );
  });

  it("fokus yo'qolmaydi: «Taklifni yopish» va qabul qilingan «O'rnatish» dan keyin — sahifa sarlavhasiga", async () => {
    fireBeforeInstallPrompt("accepted");
    const { unmount } = renderWithProviders(
      <main>
        <h1>Bosh sahifa</h1>
        <InstallAppCard placement="dashboard" />
      </main>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Taklifni yopish" }));
    expect(screen.queryByTestId("pwa-install-card-dashboard")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    unmount();

    renderWithProviders(
      <main>
        <h1>Bildirishnomalar</h1>
        <InstallAppCard placement="inbox" />
      </main>,
    );
    await userEvent.click(screen.getByRole("button", { name: "O'rnatish" }));
    await waitFor(() => expect(screen.queryByTestId("pwa-install-card-inbox")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());
  });
});
