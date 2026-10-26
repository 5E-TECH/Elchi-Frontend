import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import type { PasswordSms } from "../../../../entities/user/types/user";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../../shared/api/api", () => ({ api: { get: mocks.get, post: mocks.post } }));

import { PasswordSmsResultDialog } from "./PasswordSmsResultDialog";

const inSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

const smsOf = (patch: Partial<PasswordSms> = {}): PasswordSms => ({
  status: "sent",
  failure_reason: null,
  failure_message: null,
  requested_at: new Date().toISOString(),
  sent_at: new Date().toISOString(),
  delivered_at: null,
  resend_available_at: inSeconds(48),
  resends_left_today: 5,
  ...patch,
});

const statusResponse = (sms: PasswordSms | null) => ({
  data: { statusCode: 200, data: { user_id: "91", must_change_password: true, password_sms: sms } },
});

const props = {
  open: true,
  user: { id: "91", name: "Sardor Qodirov", phoneNumber: "+998901234567", role: "courier", roleLabel: "Kuryer" },
  viewerRole: "superadmin",
  primaryLabel: "Foydalanuvchiga o'tish",
  onPrimary: vi.fn(),
  onCreateAnother: vi.fn(),
  onClose: vi.fn(),
};

const statusCalls = () => mocks.get.mock.calls.filter(([url]) => url === "users/91/password/sms-status").length;

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
  props.onPrimary.mockReset();
  props.onCreateAnother.mockReset();
  props.onClose.mockReset();
});

describe("PasswordSmsResultDialog (maket `superadmin-users-create-password-result-dialog`)", () => {
  it("yuborildi → holat so'raladi → «Yetkazildi»; parol ko'rinmaydi; sanoq bilan qayta yuborish o'chiq", async () => {
    mocks.get.mockResolvedValue(statusResponse(smsOf({ status: "delivered", delivered_at: new Date().toISOString() })));
    renderWithProviders(<PasswordSmsResultDialog {...props} initialSms={smsOf()} />);

    const dialog = await screen.findByRole("dialog", { name: "Foydalanuvchi yaratildi" });
    expect(within(dialog).getByText("Login va parol foydalanuvchining telefoniga SMS qilib yuborildi")).toBeInTheDocument();
    expect(within(dialog).getByText("Sardor Qodirov")).toBeInTheDocument();
    expect(within(dialog).getByText("Login: +998 90 123 45 67")).toBeInTheDocument();
    expect(within(dialog).getByText("Kuryer")).toBeInTheDocument();
    expect(within(dialog).getByText("SMS yuborildi")).toBeInTheDocument();
    expect(await within(dialog).findByText("Yetkazildi")).toBeInTheDocument();
    expect(statusCalls()).toBeGreaterThanOrEqual(1);

    const resend = within(dialog).getByRole("button", { name: /SMSni qayta yuborish/ });
    expect(resend).toBeDisabled();
    expect(resend).toHaveTextContent(/0:4\d/);
    expect(within(dialog).getByText(/bugun yana 5 marta/)).toBeInTheDocument();
    expect(
      within(dialog).getByText("Parol tizimda ochiq ko'rinishda saqlanmaydi. Foydalanuvchi birinchi kirishda yangi parol o'rnatadi."),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Foydalanuvchiga o'tish" }));
    expect(props.onPrimary).toHaveBeenCalledTimes(1);
    await userEvent.click(within(dialog).getByRole("button", { name: "Yana yaratish" }));
    expect(props.onCreateAnother).toHaveBeenCalledTimes(1);
  });

  it("yuborilmadi (Eskiz TEST — provider_rejected): sabab va «Qo'lda kiritish» tavsiyasi; qayta yuborish → yangi holat", async () => {
    mocks.get.mockResolvedValue(
      statusResponse(smsOf({ status: "failed", failure_reason: "provider_rejected", resend_available_at: inSeconds(-1) })),
    );
    const pending = smsOf({ status: "pending", sent_at: null, resend_available_at: inSeconds(60), resends_left_today: 4 });
    mocks.post.mockResolvedValue({
      data: { statusCode: 200, data: { user_id: "91", must_change_password: true, password_sms: pending } },
    });
    renderWithProviders(
      <PasswordSmsResultDialog
        {...props}
        initialSms={smsOf({ status: "failed", failure_reason: "provider_rejected", failure_message: "x", resend_available_at: inSeconds(-1) })}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Foydalanuvchi yaratildi" });
    expect(within(dialog).getByText("Foydalanuvchi yaratildi, lekin parol SMS'i yuborilmadi")).toBeInTheDocument();
    expect(within(dialog).getByText("SMS yuborilmadi")).toBeInTheDocument();
    expect(
      within(dialog).getByText("SMS provayder xabarni rad etdi (balans yoki shablon tasdig'ini tekshiring)"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/«Qo'lda kiritish»ni tanlang/)).toBeInTheDocument();

    const resend = within(dialog).getByRole("button", { name: /SMSni qayta yuborish/ });
    expect(resend).toBeEnabled();
    // Qayta yuborilgach holat yana so'raladi — endi navbatdagi yangi SMS.
    mocks.get.mockResolvedValue(statusResponse(pending));
    await userEvent.click(resend);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("users/91/password/resend-sms"));
    expect(await screen.findByText("Yangi parol SMS orqali yuborildi")).toBeInTheDocument();
    expect(await within(dialog).findByText("Navbatda")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /SMSni qayta yuborish/ })).toBeDisabled();
  });

  it("429 PASSWORD_SMS_COOLDOWN — retry_after_seconds gacha o'chiq; PASSWORD_SMS_DAILY_LIMIT — kunlik limit matni", async () => {
    const failed = smsOf({ status: "failed", failure_reason: "invalid_phone", resend_available_at: inSeconds(-1) });
    mocks.get.mockResolvedValue(statusResponse(failed));
    mocks.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 429, data: { statusCode: 429, code: "PASSWORD_SMS_COOLDOWN", retry_after_seconds: 37 } },
    });
    renderWithProviders(<PasswordSmsResultDialog {...props} initialSms={failed} />);

    const dialog = await screen.findByRole("dialog", { name: "Foydalanuvchi yaratildi" });
    expect(within(dialog).getByText("Telefon raqami noto'g'ri — SMS yuborilmadi")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /SMSni qayta yuborish/ }));
    expect(await screen.findByText("Biroz kuting")).toBeInTheDocument();
    const resend = within(dialog).getByRole("button", { name: /SMSni qayta yuborish/ });
    expect(resend).toBeDisabled();
    expect(resend).toHaveTextContent(/0:3\d/);
  });

  it("kunlik limit (resends_left_today = 0) — tugma o'chiq, matn", async () => {
    const sms = smsOf({ status: "failed", failure_reason: "not_delivered", resend_available_at: inSeconds(-1), resends_left_today: 0 });
    mocks.get.mockResolvedValue(statusResponse(sms));
    renderWithProviders(<PasswordSmsResultDialog {...props} initialSms={sms} />);

    const dialog = await screen.findByRole("dialog", { name: "Foydalanuvchi yaratildi" });
    expect(within(dialog).getByText("Bugungi qayta yuborish limiti tugadi")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /SMSni qayta yuborish/ })).toBeDisabled();
  });

  it("huquq yo'q (menejer yaratgan market) — holat so'ralmaydi, qayta yuborish yo'q", async () => {
    renderWithProviders(
      <PasswordSmsResultDialog
        {...props}
        viewerRole="manager"
        user={{ ...props.user, role: "marketing", roleLabel: "Market" }}
        initialSms={smsOf()}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Foydalanuvchi yaratildi" });
    expect(within(dialog).getByText("SMS yuborildi")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /SMSni qayta yuborish/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByText("SMS kelmadimi?")).not.toBeInTheDocument();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("admin yaratgan admin emas — admin kuryerga qayta yubora oladi; admin → admin — yo'q", async () => {
    mocks.get.mockResolvedValue(statusResponse(smsOf()));
    const { unmount } = renderWithProviders(
      <PasswordSmsResultDialog {...props} viewerRole="admin" user={{ ...props.user, role: "admin", roleLabel: "Admin" }} initialSms={smsOf()} />,
    );
    await screen.findByRole("dialog", { name: "Foydalanuvchi yaratildi" });
    expect(screen.queryByRole("button", { name: /SMSni qayta yuborish/ })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<PasswordSmsResultDialog {...props} viewerRole="admin" initialSms={smsOf()} />);
    expect(await screen.findByRole("button", { name: /SMSni qayta yuborish/ })).toBeInTheDocument();
  });
});
