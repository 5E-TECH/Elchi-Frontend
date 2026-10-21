import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import {
  IPADOS_UA,
  fireBeforeInstallPrompt,
  resetInstallEnv,
  restoreInstallEnv,
  setDevice,
  setStandalone,
} from "../test/installEnv";
import { AppInstallStatusBlock } from "./AppInstallStatusBlock";

/** Sozlamalar → Bildirishnomalar → «Ilova» (maket common-settings-notifications-pwa): 4 holat, doim ko'rinadi. */
describe("AppInstallStatusBlock", () => {
  beforeEach(resetInstallEnv);
  afterEach(restoreInstallEnv);

  const block = () => screen.getByTestId("pwa-install-status");

  it("installed — «O'rnatilgan», tugmasiz", () => {
    setStandalone(true);
    renderWithProviders(<AppInstallStatusBlock />);
    expect(block()).toHaveAttribute("data-status", "installed");
    expect(block()).toHaveTextContent("Elchi ilovasiO'rnatilganShu qurilmada ilova sifatida ochilgan");
    expect(within(block()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("installable — «O'rnatilmagan» + «O'rnatish» brauzer oynasini ochadi", async () => {
    const event = fireBeforeInstallPrompt("dismissed");
    renderWithProviders(<AppInstallStatusBlock />);
    expect(block()).toHaveTextContent("Elchi ilovasiO'rnatilmaganHozir brauzer orqali ochilgan");
    await userEvent.click(within(block()).getByRole("button", { name: "O'rnatish" }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it("ios (iPadOS) — «Qanday qo'shiladi» yo'riqnoma oynasini ochadi", async () => {
    setDevice(IPADOS_UA, 5);
    renderWithProviders(<AppInstallStatusBlock />);
    expect(block()).toHaveTextContent("iPhone va iPad'da Safari orqali bosh ekranga qo'shiladi");
    await userEvent.click(within(block()).getByRole("button", { name: "Qanday qo'shiladi" }));
    expect(await screen.findByRole("dialog", { name: "Bosh ekranga qo'shing" })).toBeInTheDocument();
  });

  it("unsupported — «Qo'llab-quvvatlanmaydi», tugmasiz", () => {
    renderWithProviders(<AppInstallStatusBlock />);
    expect(block()).toHaveTextContent(
      "Qo'llab-quvvatlanmaydiBu brauzerda o'rnatib bo'lmaydi — Chrome, Edge yoki Safari'da oching",
    );
    expect(within(block()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("telefonda ham tugma o'z kengligida (maketda `flex: none`, butun kenglikka cho'zilmaydi)", () => {
    fireBeforeInstallPrompt();
    renderWithProviders(<AppInstallStatusBlock />);
    const install = within(block()).getByRole("button", { name: "O'rnatish" });
    expect(install).toHaveClass("shrink-0");
    expect(install.className).not.toContain("w-full");
  });

  it("o'rnatildi — tugma yo'qoladi, fokus `<body>` ga emas, holat blokiga o'tadi", async () => {
    fireBeforeInstallPrompt("accepted");
    renderWithProviders(<AppInstallStatusBlock />);
    await userEvent.click(within(block()).getByRole("button", { name: "O'rnatish" }));
    await waitFor(() => expect(block()).toHaveAttribute("data-status", "installed"));
    expect(block()).toHaveFocus();
  });
});
