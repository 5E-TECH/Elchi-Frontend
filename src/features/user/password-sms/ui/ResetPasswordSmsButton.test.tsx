import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../../shared/api/api", () => ({ api: { get: mocks.get, post: mocks.post } }));

import { ResetPasswordSmsButton } from "./ResetPasswordSmsButton";

const inSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();
const smsOf = (patch: Record<string, unknown> = {}) => ({
  status: "pending",
  failure_reason: null,
  failure_message: null,
  requested_at: new Date().toISOString(),
  sent_at: null,
  delivered_at: null,
  resend_available_at: inSeconds(60),
  resends_left_today: 4,
  ...patch,
});
const stateResponse = (sms: unknown) => ({
  data: { statusCode: 200, data: { user_id: "91", must_change_password: true, password_sms: sms } },
});
const apiError = (status: number, data: unknown) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data, headers: {} },
  });

const user = { id: "91", name: "Sardor Qodirov", phoneNumber: "+998901234567", role: "courier", roleLabel: "Kuryer" };
const action = { name: "Parolni tiklash va SMS yuborish" };

const openConfirm = async () => {
  renderWithProviders(<ResetPasswordSmsButton user={user} viewerRole="superadmin" />);
  await userEvent.click(screen.getByRole("button", action));
  return screen.findByRole("alertdialog", { name: "Parolni tiklaysizmi?" });
};

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
});

describe("ResetPasswordSmsButton (xtXKLUwT)", () => {
  it("avval tasdiq: oqibatlar aytiladi; «Bekor qilish» — so'rov ketmaydi", async () => {
    const confirm = await openConfirm();
    expect(within(confirm).getByText(/\+998 90 123 45 67 raqamiga SMS qilib yuboriladi/)).toBeInTheDocument();
    expect(within(confirm).getByText("Eski parol darhol ishlamay qoladi")).toBeInTheDocument();
    expect(within(confirm).getByText("Foydalanuvchi barcha qurilmalardan chiqariladi")).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("tasdiqdan keyin resend-sms, natija oynasi va 60 s sanoq; parol ko'rinmaydi", async () => {
    const sms = smsOf();
    mocks.post.mockResolvedValue(stateResponse(sms));
    mocks.get.mockResolvedValue(stateResponse(sms));
    const confirm = await openConfirm();
    await userEvent.click(within(confirm).getByRole("button", { name: "Parolni tiklash" }));

    const dialog = await screen.findByRole("dialog", { name: "Parol tiklandi" });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith("users/91/password/resend-sms");
    expect(within(dialog).getByRole("button", { name: /SMSni qayta yuborish/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /SMSni qayta yuborish/ })).toHaveTextContent(/\d:\d\d/);
    // Sarlavhadagi «×» va pastdagi asosiy tugma — ikkalasi «Yopish».
    await userEvent.click(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Parol tiklandi" })).not.toBeInTheDocument());
  });

  it("javobda `failed` — «Parol tiklanmadi»", async () => {
    const sms = smsOf({ status: "failed", failure_reason: "sms_disabled", resend_available_at: inSeconds(-1) });
    mocks.post.mockResolvedValue(stateResponse(sms));
    mocks.get.mockResolvedValue(stateResponse(sms));
    const confirm = await openConfirm();
    await userEvent.click(within(confirm).getByRole("button", { name: "Parolni tiklash" }));
    const dialog = await screen.findByRole("dialog", { name: "Parol tiklanmadi" });
    expect(within(dialog).getByText("SMS yuborish hozir o'chirilgan")).toBeInTheDocument();
  });

  it("403 (begona kuryer) — backend matni tasdiq oynasida; 429 — kutish vaqti", async () => {
    mocks.post.mockRejectedValueOnce(apiError(403, { statusCode: 403, message: "Menejer faqat o'z kuryeriga parol yubora oladi" }));
    const confirm = await openConfirm();
    await userEvent.click(within(confirm).getByRole("button", { name: "Parolni tiklash" }));
    expect(await within(confirm).findByText("Menejer faqat o'z kuryeriga parol yubora oladi")).toBeInTheDocument();

    mocks.post.mockRejectedValueOnce(
      apiError(429, { statusCode: 429, code: "PASSWORD_SMS_COOLDOWN", retry_after_seconds: 48 }),
    );
    await userEvent.click(within(confirm).getByRole("button", { name: "Parolni tiklash" }));
    expect(await within(confirm).findByText("Qayta yuborish 0:48 dan keyin mumkin")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Parol tiklandi" })).not.toBeInTheDocument();
  });
});
