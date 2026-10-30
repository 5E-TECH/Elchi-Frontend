import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({
  createAdmin: vi.fn(),
  createManager: vi.fn(),
  createRegistrator: vi.fn(),
  createMarket: vi.fn(),
  createCourier: vi.fn(),
  createLogist: vi.fn(),
  useBranches: vi.fn(),
  navigate: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigate };
});
vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    createAdmin: { mutateAsync: mocks.createAdmin, isPending: false },
    createManager: { mutateAsync: mocks.createManager, isPending: false },
    createRegistrator: { mutateAsync: mocks.createRegistrator, isPending: false },
    createMarket: { mutateAsync: mocks.createMarket, isPending: false },
    createCourier: { mutateAsync: mocks.createCourier, isPending: false },
    createLogist: { mutateAsync: mocks.createLogist, isPending: false },
  }),
}));
vi.mock("../../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../entities/branch")>()),
  useBranches: mocks.useBranches,
}));
vi.mock("../../../../shared/api/api", () => ({ api: { get: mocks.get, post: mocks.post } }));

import { CreateUserForm } from "./CreateUserForm";

const superadminState = {
  role: { id: "1", role: "superadmin", region: null, name: "Superadmin" },
} as never;

const hybridManagerState = {
  role: { id: "70", role: "manager", region: null, name: "Menejer" },
  user: {
    user: {
      id: "70",
      role: "manager",
      region: { id: "12", name: "Samarqand viloyati" },
      branch: { branch: { id: "44", name: "Urgut filiali", type: "HYBRID", region_id: "12" } },
    },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

type User = ReturnType<typeof userEvent.setup>;

const fill = async (user: User, container: HTMLElement, name: string, value: string) => {
  const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`input not found: ${name}`);
  await user.type(input, value);
};

const sentSms = {
  status: "sent",
  failure_reason: null,
  failure_message: null,
  requested_at: new Date().toISOString(),
  sent_at: new Date().toISOString(),
  delivered_at: null,
  resend_available_at: new Date(Date.now() + 60_000).toISOString(),
  resends_left_today: 5,
};

const createdResponse = (data: Record<string, unknown>) => ({ data: { statusCode: 201, message: "ok", data } });

beforeEach(() => {
  for (const fn of [mocks.createAdmin, mocks.createManager, mocks.createRegistrator, mocks.createMarket, mocks.createCourier, mocks.createLogist]) {
    fn.mockReset().mockResolvedValue({ statusCode: 201 });
  }
  mocks.navigate.mockReset();
  mocks.get.mockReset().mockResolvedValue({ data: { statusCode: 200, data: { user_id: "91", password_sms: sentSms } } });
  mocks.post.mockReset();
  mocks.useBranches.mockReset().mockReturnValue({ data: { data: [] }, isLoading: false });
});

describe("CreateUserForm — parol SMS (aidsxJ2H, maket `superadmin-users-create-password-sms`)", () => {
  it("sukut «Tizim yaratsin va SMS yuborsin»: parol maydoni yo'q, belgi yoqiq va o'zgarmaydi, SMS namunasi; tugma «Yaratish va SMS yuborish»", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await user.click(screen.getByRole("radio", { name: /^Kuryer/ }));

    const group = screen.getByRole("group", { name: "Parolni qanday berish" });
    expect(within(group).getByRole("radio", { name: /^Tizim yaratsin va SMS yuborsin/ })).toBeChecked();
    expect(within(group).getByRole("radio", { name: /^Qo'lda kiritish/ })).not.toBeChecked();
    expect(container.querySelector('input[name="password"]')).toBeNull();
    const mustChange = screen.getByRole("checkbox", { name: "Birinchi kirishda parolni almashtirishni talab qilish" });
    expect(mustChange).toBeChecked();
    expect(mustChange).toBeDisabled();
    expect(screen.getByText("Login va parol SMS orqali boradi")).toBeInTheDocument();
    expect(screen.getByText("SMS matni namunasi")).toBeInTheDocument();

    await fill(user, container, "phone", "901234567");
    expect(within(group).getByText(/\+998 90 123 45 67 raqamiga SMS qilib yuboriladi/)).toBeInTheDocument();
    expect(screen.getByText(/Login: \+998901234567, parol: ••••••••••••/)).toBeInTheDocument();
    expect(screen.getByText("Login shu raqam bo'ladi, parol ham shu raqamga keladi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yaratish va SMS yuborish" })).toBeInTheDocument();
  });

  it("SMS rejimi: so'rovda faqat `password_mode: generate_sms` (parolsiz); natija oynasi, `navigate(-1)` va «Muvaffaqiyatli» xabari yo'q", async () => {
    mocks.createCourier.mockResolvedValue(
      createdResponse({ id: 91, name: "Sardor Qodirov", phone_number: "+998901234567", role: "courier", password_mode: "generate_sms", password_sms: sentSms }),
    );
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await user.click(screen.getByRole("radio", { name: /^Kuryer/ }));
    await fill(user, container, "fullName", "Sardor Qodirov");
    await fill(user, container, "phone", "901234567");
    await fill(user, container, "homeRate", "25000");
    await fill(user, container, "centerRate", "18000");
    await user.click(screen.getByRole("button", { name: "Yaratish va SMS yuborish" }));

    await waitFor(() => expect(mocks.createCourier).toHaveBeenCalledTimes(1));
    const payload = mocks.createCourier.mock.calls[0][0];
    expect(payload).toMatchObject({ name: "Sardor Qodirov", phone_number: "+998901234567", password_mode: "generate_sms" });
    expect(payload).not.toHaveProperty("password");
    expect(payload).not.toHaveProperty("must_change_password");

    const dialog = await screen.findByRole("dialog", { name: "Foydalanuvchi yaratildi" });
    expect(within(dialog).getByText("SMS yuborildi")).toBeInTheDocument();
    expect(within(dialog).getByText("Login: +998 90 123 45 67")).toBeInTheDocument();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("users/91/password/sms-status"));
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.queryByText("Muvaffaqiyatli")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Foydalanuvchiga o'tish" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/all-users/91");
  });

  it("«Yana yaratish» — oyna yopiladi, forma bo'shaydi (rol saqlanadi)", async () => {
    mocks.createAdmin.mockResolvedValue(createdResponse({ id: 5, name: "Yangi Admin", role: "admin", password_mode: "generate_sms", password_sms: sentSms }));
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await fill(user, container, "fullName", "Yangi Admin");
    await fill(user, container, "phone", "901234567");
    await fill(user, container, "salary", "5000000");
    await user.click(screen.getByRole("combobox", { name: "To'lov kuni" }));
    await user.click(screen.getByRole("option", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "Yaratish va SMS yuborish" }));

    const dialog = await screen.findByRole("dialog", { name: "Foydalanuvchi yaratildi" });
    expect(mocks.createAdmin.mock.calls[0][0]).toEqual({
      name: "Yangi Admin",
      phone_number: "+998901234567",
      password_mode: "generate_sms",
      salary: 5000000,
      payment_day: 5,
    });
    await user.click(within(dialog).getByRole("button", { name: "Yana yaratish" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Foydalanuvchi yaratildi" })).not.toBeInTheDocument());
    expect(container.querySelector<HTMLInputElement>('input[name="fullName"]')?.value).toBe("");
    expect(screen.getByRole("form", { name: "Admin qo'shish" })).toBeInTheDocument();
  });

  it("«Qo'lda kiritish»: parol maydoni chiqadi, siyosat tekshiriladi; belgi olib tashlansa `must_change_password: false`; avvalgidek `navigate(-1)`", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await user.click(screen.getByRole("radio", { name: /^Market/ }));
    await user.click(screen.getByRole("radio", { name: /^Qo'lda kiritish/ }));
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(screen.getByText("Kirish ma'lumotlarini o'zingiz bering")).toBeInTheDocument();
    const mustChange = screen.getByRole("checkbox", { name: "Birinchi kirishda parolni almashtirishni talab qilish" });
    expect(mustChange).toBeEnabled();
    expect(mustChange).toBeChecked();

    await fill(user, container, "fullName", "Zarafshon Market");
    await fill(user, container, "phone", "901234567");
    await fill(user, container, "username", "zarafshon");
    await fill(user, container, "password", "abc");
    await fill(user, container, "homeRate", "30000");
    await fill(user, container, "centerRate", "20000");
    await user.click(screen.getByRole("radio", { name: "Markazgacha" }));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Parol kamida 8 ta belgidan iborat bo'lsin")).toBeInTheDocument();
    expect(mocks.createMarket).not.toHaveBeenCalled();

    await user.clear(container.querySelector<HTMLInputElement>('input[name="password"]')!);
    await fill(user, container, "password", "zarafshon26");
    // xtXKLUwT: takror maydoni — bo'sh va mos kelmasa yuborilmaydi; so'rovga kirmaydi.
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Parolni qayta kiriting")).toBeInTheDocument();
    await fill(user, container, "passwordRepeat", "zarafshon27");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Parollar mos kelmadi")).toBeInTheDocument();
    expect(mocks.createMarket).not.toHaveBeenCalled();
    await user.clear(container.querySelector<HTMLInputElement>('input[name="passwordRepeat"]')!);
    await fill(user, container, "passwordRepeat", "zarafshon26");
    await user.click(mustChange);
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.createMarket).toHaveBeenCalledTimes(1));
    expect(mocks.createMarket.mock.calls[0][0]).toMatchObject({
      password_mode: "manual",
      password: "zarafshon26",
      must_change_password: false,
    });
    expect(mocks.createMarket.mock.calls[0][0]).not.toHaveProperty("passwordRepeat");
    expect(mocks.navigate).toHaveBeenCalledWith(-1);
    expect(screen.queryByRole("dialog", { name: "Foydalanuvchi yaratildi" })).not.toBeInTheDocument();
  });

  it("logist SMS rejimida — asosiy amal «Viloyatlarni belgilash» → «Logist biriktirish»", async () => {
    mocks.createLogist.mockResolvedValue(createdResponse({ id: 57, name: "Aziz Rahimov", role: "logist", password_mode: "generate_sms", password_sms: sentSms }));
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await user.click(screen.getByRole("radio", { name: /^Logist/ }));
    await fill(user, container, "fullName", "Aziz Rahimov");
    await fill(user, container, "phone", "901234567");
    await fill(user, container, "salary", "6000000");
    await user.click(screen.getByRole("button", { name: "Yaratish va SMS yuborish" }));

    const dialog = await screen.findByRole("dialog", { name: "Foydalanuvchi yaratildi" });
    expect(mocks.createLogist.mock.calls[0][0]).toMatchObject({ password_mode: "generate_sms" });
    expect(mocks.createLogist.mock.calls[0][0]).not.toHaveProperty("password");
    await user.click(within(dialog).getByRole("button", { name: "Viloyatlarni belgilash" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/regions/logist-assignment?logist=57");
  });

  it("HYBRID menejer market yaratsa — natija oynasida qayta yuborish yo'q (backend: menejer — faqat o'z kuryeri)", async () => {
    mocks.createMarket.mockResolvedValue(createdResponse({ id: 77, name: "Urgut Market", role: "market", password_mode: "generate_sms", password_sms: sentSms }));
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: hybridManagerState });
    await user.click(screen.getByRole("radio", { name: /^Market/ }));
    await fill(user, container, "fullName", "Urgut Market");
    await fill(user, container, "phone", "901234567");
    await fill(user, container, "username", "urgut_m");
    await fill(user, container, "homeRate", "30000");
    await fill(user, container, "centerRate", "20000");
    await user.click(screen.getByRole("radio", { name: "Uygacha" }));
    await user.click(screen.getByRole("button", { name: "Yaratish va SMS yuborish" }));

    const dialog = await screen.findByRole("dialog", { name: "Foydalanuvchi yaratildi" });
    expect(within(dialog).queryByRole("button", { name: /SMSni qayta yuborish/ })).not.toBeInTheDocument();
    expect(mocks.get.mock.calls.filter(([url]) => String(url).includes("password/sms-status"))).toEqual([]);
  });
});
