import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import SmsSettingsTab from "./SmsSettingsTab";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api }));

const STATUS = {
  enabled: true,
  provider: "eskiz",
  default_account: true,
  otp_account: false,
  credential_secret_configured: true,
  used_today: 1284,
  daily_cap: 5000,
  max_fanout: 200,
  quiet_hours: { start: 18 * 60, end: 9 * 60 },
  tariffs: { transactional: 115, promo: 160, security: null },
};

const ACCOUNTS = [
  {
    id: "a1",
    provider: "eskiz",
    sender_profile: "default",
    login: "sms@elchipochta.uz",
    sender: "ELCHI",
    is_active: true,
  },
];

const asRole = (role: "superadmin" | "admin") => ({ preloadedState: { role: { role } } as never });

describe("SmsSettingsTab", () => {
  beforeEach(() => {
    api.get.mockReset().mockImplementation((url: string) => {
      if (url.endsWith("status")) return Promise.resolve({ data: { data: STATUS } });
      if (url.endsWith("accounts")) return Promise.resolve({ data: { data: ACCOUNTS } });
      return Promise.resolve({ data: { data: null } });
    });
    api.post.mockReset().mockResolvedValue({ data: {} });
    api.put.mockReset().mockResolvedValue({ data: {} });
  });

  it("status card: badges, today's usage, quiet hours and tariffs", async () => {
    renderWithProviders(<SmsSettingsTab />, asRole("admin"));

    expect(await screen.findByText("SMS yoqilgan")).toBeInTheDocument();
    expect(screen.getByText("Eskiz")).toBeInTheDocument();
    expect(screen.getByText("Sozlangan")).toBeInTheDocument();
    expect(screen.getByText("Sozlanmagan")).toBeInTheDocument();
    expect(screen.getByText("1 284 / 5 000 ta")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Kunlik chegaraning 26 foizi ishlatilgan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("18:00–09:00")).toBeInTheDocument();
    expect(screen.getByText("Xizmat xabari — 115 so'm")).toBeInTheDocument();
    // Admin — provayder akkauntlari yo'q (faqat superadmin, avvalgidek).
    expect(screen.queryByText("Provayder akkauntlari")).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("notifications/sms/accounts");
  });

  it("consent: grant and revoke send the phone (+998…) and source as before", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SmsSettingsTab />, asRole("admin"));

    const grant = screen.getByRole("button", { name: "Rozilikni qayd etish" });
    expect(grant).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Telefon" }), "901234567");
    await user.click(grant);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("notifications/sms/consents", {
        phone: "+998901234567",
        source: "operator",
      }),
    );
    expect(await screen.findByText("Saqlandi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rozilikni bekor qilish" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("notifications/sms/consents/revoke", {
        phone: "+998901234567",
      }),
    );
  });

  it("superadmin: accounts table and PUT accounts; the password is cleared after saving", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SmsSettingsTab />, asRole("superadmin"));

    const table = await screen.findByRole("table", { name: "Provayder akkauntlari ro'yxati" });
    expect(within(table).getByText("sms@elchipochta.uz")).toBeInTheDocument();
    expect(within(table).getByText("Faol")).toBeInTheDocument();

    const save = screen.getByRole("button", { name: "Akkauntni saqlash" });
    expect(save).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Login (email)" }), "new@elchipochta.uz");
    const password = screen.getByLabelText(/^Parol/, { selector: "input" });
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Parolni ko'rsatish" }));
    expect(password).toHaveAttribute("type", "text");
    await user.type(password, "s3cret");
    await user.type(screen.getByRole("textbox", { name: "Alfa-nom" }), "ELCHI");
    await user.click(save);

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("notifications/sms/accounts", {
        provider: "eskiz",
        sender_profile: "default",
        login: "new@elchipochta.uz",
        password: "s3cret",
        sender: "ELCHI",
      }),
    );
    expect(await screen.findByText("Akkaunt saqlandi")).toBeInTheDocument();
    expect(password).toHaveValue("");
  });

  it("without SMS_CREDENTIAL_SECRET: warning and the account cannot be saved", async () => {
    api.get.mockImplementation((url: string) => {
      if (url.endsWith("status"))
        return Promise.resolve({
          data: { data: { ...STATUS, credential_secret_configured: false } },
        });
      if (url.endsWith("accounts")) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: null } });
    });
    const user = userEvent.setup();
    renderWithProviders(<SmsSettingsTab />, asRole("superadmin"));

    expect(await screen.findByText(/SMS_CREDENTIAL_SECRET sozlanmagan/)).toBeInTheDocument();
    expect(await screen.findByText("Hali akkaunt qo'shilmagan")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Login (email)" }), "a@b.uz");
    await user.type(screen.getByLabelText(/^Parol/, { selector: "input" }), "x");
    await user.type(screen.getByRole("textbox", { name: "Alfa-nom" }), "ELCHI");
    expect(screen.getByRole("button", { name: "Akkauntni saqlash" })).toBeDisabled();
  });
});
